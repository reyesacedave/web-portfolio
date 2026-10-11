const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cached database connection for Vercel Serverless
let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        console.warn('MONGODB_URI is not defined in environment variables.');
        return;
    }
    try {
        await mongoose.connect(MONGODB_URI);
        isConnected = true;
        console.log('Connected to MongoDB Atlas');
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}

// Database Schema & Model
const ItemSchema = new mongoose.Schema({
    name: String,
    type: String, // 'file' or 'folder'
    parentId: String,
    content: String
});

// Prevent overwrite model error in serverless warm starts
const Item = mongoose.models.Item || mongoose.model('Item', ItemSchema);

// API Routes (Ensuring DB connects per request safely)
app.get('/api/items', async (req, res) => {
    try {
        await connectDB();
        let items = await Item.find();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/items', async (req, res) => {
    try {
        await connectDB();
        let newItem = new Item(req.body);
        await newItem.save();
        res.json(newItem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/items/:id', async (req, res) => {
    try {
        await connectDB();
        await Item.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback: Send index.html for frontend routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;