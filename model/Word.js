import mongoose from "../database/db.js";

const wordSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    word: {
        type: String,
        required: true
    },
    translation: {
        type: String,
        required: true
    },
    language: {
        type: String,
        required: true
    },
    level: {
        type: Number,
        default: 1,
        min: 1,
        max: 5
    },
    lastReview: {
        type: Date,
        default: null
    },
    nextReview: {
        type: Date,
        default: () => {
            const today = new Date();
            today.setHours(0,0,0,0);
            return today;
        }
    },
    correctCount: {
        type: Number,
        default: 0
    },
    incorrectCount: {
        type: Number,
        default: 0
    }

}, { timestamps: true });

const Word = mongoose.model('Word', wordSchema);

export default Word;