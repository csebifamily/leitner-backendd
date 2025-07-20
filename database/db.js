import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB kapcsolódási hiba:'));
db.once('open', () => {
    console.log('Csatlakozva a mongoDB-hez!');
})

export default mongoose;