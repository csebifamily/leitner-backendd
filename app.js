import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import User from './model/User.js';
import Word from './model/Word.js';
import mongoose from 'mongoose';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: 'https://csebifamily.github.io',
    credentials: true
}));

async function sendResetEmail(toEmail, resetToken) {
  const transporter = nodemailer.createTransport({
    service: 'Gmail', // vagy 'Outlook', 'Yahoo', stb.
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const resetLink = `https://csebifamily.github.io/reset-password/${resetToken}`;

  const info = await transporter.sendMail({
    from: '"Leitner szótanuló" <csebij1996@gmail.com>',
    to: toEmail,
    subject: 'Jelszó visszaállítás',
    html: `<p>Kattints az alábbi linkre a jelszó visszaállításához:</p>
           <a href="${resetLink}">${resetLink}</a>`,
  });

  console.log('E-mail elküldve:', info.messageId);
}


//Összes szó statisztika lekérdezés
app.get('/api/words', verifyToken('access'), async (req, res) => {

    const today = new Date();
    today.setHours(0,0,0,0);

    const userId = new mongoose.Types.ObjectId(req.user.id);

    const totalWords = await Word.countDocuments({ userId });

    const levelsAggregation = await Word.aggregate([
        { $match: { userId } },
        { $group: { _id: "$level", count: { $sum: 1 } } }
    ]);

    const levels = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0
    };
    for (const lvl of levelsAggregation) {
        levels[lvl._id] = lvl.count;
    }

    console.log(levels)

    // 3. Hány szó esedékes ma? (nextReview <= ma)
    const dueToday = await Word.countDocuments({
        userId,
        nextReview: { $lte: today }
    })

    const nextReviewWord = await Word.findOne({
        userId,
        nextReview: { $gt: today }
    }).sort({ nextReview: 1 }).select('nextReview');

    const nextReviewDay = nextReviewWord ? nextReviewWord.nextReview : null;
    const relativeDay = getRelativeDay(nextReviewDay)
    
    res.status(200).json({ nickname: req.user.nickname, totalWords, levels, dueToday, relativeDay });
    
})

//Első szint gyakorlásához a szavak lekérése
app.get('/api/elso-szint-gyakorlas', verifyToken('access'), async (req, res) => {
    const userId = req.user.id;
    const level = 1;

    try {
        const words = await Word.find({ userId, level }).lean();

        for (let i = words.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [words[i], words[j]] = [words[j], words[i]];
        }
        console.log(words);

        res.status(200).json({ words });
    } catch (error) {
        res.status(500).json({ error: 'Szerver hiba!' })
    }
})

//Játékkor a szavak ellenőrzése, hogy megfelelő volt-e a válasz
app.post('/api/game-result-gyakorlas', verifyToken('access'), async (req, res) => {
    const { _id } = req.body;
    const translation = req.body.translation.trim().toLowerCase();

    try {
        const word = await Word.findById({ _id });
        
        if(!word) return res.status(404).json({ error: 'Nem található ilyen szó!' });

        const match = word.translation === translation;
        if(!match) return res.status(200).json({ message: 'Nem ez a szó jelentése!', success: false })

        res.status(200).json({ message: 'Gratulálok, helyes válasz!', success: true })

    } catch (error) {
        res.status(500).json({ error: 'Szerver hiba!' })
    }
})

//összes szó id alapján
app.get('/api/wordsById', verifyToken('access'), async (req, res) => {

    const userId = new mongoose.Types.ObjectId(req.user.id);

    const words = await Word.find({ userId });
    res.json({ words })
})

//Szó törlése ID alapján
app.delete('/api/word/:id', verifyToken('access'), async (req, res) => {
    const userId = req.user.id;
    const wordId = req.params.id;

    try {
        
        const deletedWord = await Word.findOneAndDelete({ _id: wordId, userId });

        if(!deletedWord) return res.status(404).json({ error: 'Nem található ilyen szó!' })

        res.status(200).json({ message: 'Szó sikeresen törölve!' });

    } catch (error) {
        res.status(500).json({ error: 'Szerver hiba!' })
    }
})

//Szó ID alapján
app.get('/api/word/:id', verifyToken('access'), async (req, res) => {
    const userId = req.user.id;
    const wordId = req.params.id;

    try {
        
        const word = await Word.findOne({ _id: wordId, userId });

        if(!word) return res.status(404).json({ error: 'Nem található ilyen szó!' })

        res.status(200).json({ word });

    } catch (error) {
        res.status(500).json({ error: 'Szerver hiba!' })
    }
})

app.post('/api/login-user', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if(!user) return res.status(401).json({ error: 'Hibás felhasználónév vagy jelszó!' })

        const isMatch = await bcrypt.compare(password, user.password);

        if(!isMatch) return res.status(401).json({ error: 'Hibás felhasználónév vagy jelszó!' })

        const accessToken = jwt.sign({id: user._id, nickname: user.nickname}, process.env.ACCESS_SECRET, { expiresIn: '15s' });
        const refreshToken = jwt.sign({ id: user._id, nickname: user.nickname }, process.env.REFRESH_SECRET, { expiresIn: '30d' })
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 1000*60*60*24*30
        });

        res.json({ accessToken });
        
    } catch (error) {
        res.status(500).json({ error: 'Szerver hiba!' });
    }
})

app.post('/api/new-password', async (req, res) => {
    const { password, token } = req.body;

    try {
        const verify = jwt.verify(token, process.env.RESET_SECRET);

        const user = await User.findById(verify.id)
        if(!user) return res.status(404).json({ error: 'Nem található felhasználó!' });

        const hashedPassword = await bcrypt.hash(password, 10);

        user.password = hashedPassword;
        await user.save();
        res.status(200).json({ message: 'Sikeres jelszó módosítás!' });
   
    } catch (error) {
        return res.status(402).json({ error: 'Lejárt az időd vagy hibás token!' });
    }
})

app.post('/api/forgot-password-ellenorzes', (req, res) => {
    const { token } = req.body;

    try {
        const verify = jwt.verify(token, process.env.RESET_SECRET);
        res.status(200).json({ message: 'success' });
   
    } catch (error) {
        return res.status(401).json({ error: 'Lejárt az időd vagy hibás link!' });
    }

})

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if(!user) return res.status(401).json({ error: 'Nem található ilyen e-mail cím!' })

    const token = jwt.sign({ id: user._id }, process.env.RESET_SECRET, { expiresIn: '15m' })
    
    sendResetEmail(user.email, token);
    res.status(200).json({ message: 'E-Mail elküldve!' }) 
    
})

app.get('/api/get-new-access-token', verifyToken('refresh'), (req, res) => {

    const accessToken = jwt.sign({
        id: req.user.id,
        nickname: req.user.nickname
    }, process.env.ACCESS_SECRET, { expiresIn: '15s' });

    res.json({ accessToken });

})

app.post('/api/logout-user', (req, res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: false,
        sameSite: 'strict'
    })
    res.status(200).json({ success: 'Sikeres kijelentkezés!' })
})

app.post('/api/register', async (req, res) => {
    const { nickname, email, username, password } = req.body;
    try {

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      nickname,
      username,
      email,
      password: hashedPassword
    });

    const savedUser = await newUser.save();
    res.status(200).json({ message: 'Sikeres regisztráció!' });
    } catch (error) {
        if(error.code === 11000) {
            const mezo = Object.keys(error.keyPattern)[0];
            const mezoAlakitas = mezo === 'username' ? 'felhasználónév' : 'e-mail cím';
            res.status(400).json({ error: `A(z) ${mezoAlakitas} már használatban van.` })
        } else {
            res.status(500).json({ error: 'Valami hiba történt a regisztráció során!' })
        }
    }


})

//szó szerkesztése
app.put('/api/edit-word', verifyToken('access'), async (req, res) => {
   const { _id, word, translation } = req.body;

    try {
        const editedWord = await Word.findOneAndUpdate({_id}, {
        word, translation
        });

        if(word === editedWord.word && translation === editedWord.translation) return res.status(200).json({ message: 'Nem történt változás a szavakban!' }) 
        if(!editedWord) return res.status(404).json({ error: 'Nem található a szó!' })

        res.status(200).json({ message: 'Sikeres módosítás!' })
    } catch (error) {
        res.status(500).json({ error: 'Szerver hiba!' })
    }
})

//Új szó felvétele
app.post('/api/new-word', verifyToken('access'), async (req, res) => {
    try {
        const userId = req.user.id;
        const word = req.body.word.trim().toLowerCase();
        const translation = req.body.translation.trim().toLowerCase();

        const matchWord = await Word.findOne({ userId, word });

        if(matchWord) return res.status(409).json({ error: 'Ez a szó már szerepel a szótáradban!' })

        const newWord = new Word({
            userId,
            word,
            translation,
            language: 'angol',
        })

        await newWord.save();
        res.status(201).json({ message: 'Szó sikeresen hozzáadva.' });

    } catch (error) {
        res.status(500).json({ error: 'Hiba a szó felvétele során.' })
    }
})

const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
    console.log(`Sikeres csatlakozás a ${PORT} porton!`);
});





function getRelativeDay(targetDate) {

    const today = new Date();
    today.setHours(0,0,0,0);

    const target = new Date(targetDate);
    target.setHours(0,0,0,0);

    const diffInDay = (target-today) / (1000*60*60*24);

    if(diffInDay <= 0) return '-';
    if(diffInDay === 1) return 'holnap';
    if(diffInDay === 2) return 'holnapután';
    if(diffInDay < 7) return `${diffInDay} nap múlva`;
    if(diffInDay % 7 === 0) return `${diffInDay / 7} hét múlva`;

    const weeks = Math.floor(diffInDay / 7);
    const days = diffInDay % 7;
    return `${weeks} hét és ${days} nap múlva`;
    //Eredmény: '1.1428571428571428 hét és 1 nap múlva'
}

function verifyToken(type) {
    return function authToken(req, res, next) {

    let token;

    if(type === 'access') {
        const auth = req.headers['authorization'];
        token = auth && auth.split(' ')[1];
    } else if(type === 'refresh') {
        token = req.cookies['refreshToken']
    }
    
    if(!token) return res.status(403).json({ error: 'nincs token' });

    jwt.verify(token, type === 'access' ? process.env.ACCESS_SECRET : process.env.REFRESH_SECRET, (err, user) => {
        if(err) return res.status(403).json({ error: 'érvénytelen token' })
        req.user = user;
        next();
    })
    }
}
