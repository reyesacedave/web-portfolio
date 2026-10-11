const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// Enable JSON parsing
app.use(express.json());

// Serve all static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connected to MongoDB Atlas'))
        .catch(err => console.error('MongoDB connection error:', err));
}

// Database Schema & Model
const ItemSchema = new mongoose.Schema({
    name: String,
    type: String, // 'file' or 'folder'
    parentId: String,
    content: String
});

const Item = mongoose.model('Item', ItemSchema);

// API Routes
app.get('/api/items', async (req, res) => {
    try {
        let items = await Item.find();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/items', async (req, res) => {
    try {
        let newItem = new Item(req.body);
        await newItem.save();
        res.json(newItem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/items/:id', async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback: Send index.html for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;