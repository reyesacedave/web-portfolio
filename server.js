const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/student_portfolio';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

const itemSchema = new mongoose.Schema({
  name: String,
  type: String,
  parentId: { type: String, default: 'root' },
  content: { type: String, default: '' }
});
const Item = mongoose.model('Item', itemSchema);

const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: String
});
const Setting = mongoose.model('Setting', settingSchema);

app.get('/api/profile-photo', async (req, res) => {
  await connectDB();
  try {
    const photo = await Setting.findOne({ key: 'profile_photo' });
    res.json({ photo: photo ? photo.value : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile-photo', async (req, res) => {
  await connectDB();
  try {
    const { photo } = req.body;
    await Setting.findOneAndUpdate(
      { key: 'profile_photo' },
      { value: photo },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/items', async (req, res) => {
  await connectDB();
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items', async (req, res) => {
  await connectDB();
  try {
    const newItem = new Item({
      name: req.body.name,
      type: req.body.type,
      parentId: req.body.parentId || 'root',
      content: req.body.content || ''
    });
    const saved = await newItem.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  await connectDB();
  try {
    await Item.findByIdAndDelete(req.params.id);
    await Item.deleteMany({ parentId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('Server running on port ' + PORT));
}

module.exports = app;