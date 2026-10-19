const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Increase payload limit (50MB) for multi-file folder uploads with assets
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB using environment variable or local database
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio';
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch(err => console.error('MongoDB Connection Error (Fallback Mode Enabled):', err.message));

// MongoDB Schema supporting single HTML files or multi-file project maps
const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    entryHtml: { type: String, required: true },
    filesMap: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now }
});

const Project = mongoose.model('Project', projectSchema);

// --- API ROUTES ---

// Get all uploaded projects
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await Project.find().sort({ createdAt: -1 });
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve projects' });
    }
});

// Save a new uploaded HTML file or folder project
app.post('/api/projects', async (req, res) => {
    try {
        const { title, entryHtml, filesMap } = req.body;
        if (!title || !entryHtml) {
            return res.status(400).json({ error: 'Title and HTML content are required' });
        }
        const newProject = new Project({ title, entryHtml, filesMap: filesMap || {} });
        await newProject.save();
        res.status(201).json(newProject);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save project' });
    }
});

// Delete a project by ID
app.delete('/api/projects/:id', async (req, res) => {
    try {
        await Project.findByIdAndDelete(req.params.id);
        res.json({ message: 'Project deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// Fallback route to serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for Vercel or run locally
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;