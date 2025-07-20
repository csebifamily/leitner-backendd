import mongoose from "../database/db.js";

const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;