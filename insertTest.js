import mongoose from 'mongoose';
import Word from './model/Word.js';

const userId = new mongoose.Types.ObjectId('6876b63e87df7f53c5729e1b'); // Létező userId

const reviewIntervals = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 14
};

const words = [
  ['apple', 'alma'],
  ['book', 'könyv'],
  ['car', 'autó'],
  ['dog', 'kutya'],
  ['elephant', 'elefánt'],
  ['fish', 'hal'],
  ['grape', 'szőlő'],
  ['house', 'ház'],
  ['island', 'sziget'],
  ['jacket', 'kabát'],
  ['key', 'kulcs'],
  ['lamp', 'lámpa'],
  ['moon', 'hold'],
  ['notebook', 'füzet'],
  ['orange', 'narancs'],
  ['pen', 'toll'],
  ['queen', 'királynő'],
  ['river', 'folyó'],
  ['sun', 'nap'],
  ['tree', 'fa'],
  ['umbrella', 'esernyő'],
  ['village', 'falu'],
  ['window', 'ablak'],
  ['xylophone', 'xilofon'],
  ['yogurt', 'joghurt'],
  ['zebra', 'zebra'],
  ['train', 'vonat'],
  ['mountain', 'hegy'],
  ['cloud', 'felhő'],
  ['bread', 'kenyér']
];

const now = new Date();
const msInDay = 86400000;

// Állítsuk be a magyar idő szerinti mai nap 0:00-t
const todayMidnight = new Date(now);
todayMidnight.setHours(0, 0, 0, 0);

const docs = words.map(([word, translation], i) => {
  const level = (i % 5) + 1;
  const days = reviewIntervals[level];

  // 5 első szó legyen ma esedékes
  const isDueToday = i < 5;

  return {
    userId,
    word,
    translation,
    language: 'angol',
    level,
    lastReview: isDueToday
      ? new Date(todayMidnight.getTime() - days * msInDay)
      : new Date(now.getTime() - days * msInDay),
    nextReview: isDueToday
      ? new Date(todayMidnight) // magyar éjfél
      : new Date(now.getTime() + days * msInDay),
    correctCount: Math.floor(Math.random() * 5),
    incorrectCount: Math.floor(Math.random() * 3)
  };
});

try {
  await Word.insertMany(docs);
  console.log('✅ 30 szó beszúrva, ebből 5 ma esedékes');
} catch (err) {
  console.error('❌ Hiba:', err);
} finally {
  await mongoose.disconnect();
}
