const mongoose = require('mongoose');

let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) throw new Error('MONGODB_URI is not defined');
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
}

const ItemSchema = new mongoose.Schema({
    name: String,
    type: String,
    parentId: String,
    content: String
});

const Item = mongoose.models.Item || mongoose.model('Item', ItemSchema);

export default async function handler(req, res) {
    try {
        await connectDB();

        if (req.method === 'GET') {
            let items = await Item.find();
            return res.json(items);
        } 
        
        if (req.method === 'POST') {
            let newItem = new Item(req.body);
            await newItem.save();
            return res.json(newItem);
        } 
        
        if (req.method === 'DELETE') {
            let id = req.query.id || req.url.split('/').pop();
            await Item.findByIdAndDelete(id);
            return res.json({ success: true });
        }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}