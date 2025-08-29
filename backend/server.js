require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Gemini API setup
const { GoogleGenAI } = require('@google/genai');
const cheerio = require('cheerio');
// Initialize Gemini client (API key is read from GEMINI_API_KEY env variable)
const ai = new GoogleGenAI({});

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware Setup ---
app.use(cors()); // Allows your React frontend to talk to this backend
app.use(express.json()); // Allows us to read JSON in request bodies

// --- File Upload Setup (Multer) ---
// We'll store the uploaded file in memory so we can process it directly
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- API Routes ---

// A simple root route to check if the server is running
app.get('/', (req, res) => {
    res.json({ message: 'Aina AI backend is running!' });
});

// The main endpoint for analyzing the user's history file
app.post('/analyze', upload.single('historyFile'), (req, res) => {
    // 1. --- Validate the File ---
    if (!req.file) {
        return res.status(400).json({ error: 'No file was uploaded.' });
    }
    if (!req.file.originalname.toLowerCase().endsWith('.html')) {
        return res.status(400).json({ error: 'Invalid file type. Please upload your watch-history.html file.' });
    }

    try {
        // 2. --- Parse the HTML ---
        const htmlContent = req.file.buffer.toString('utf-8');
        const $ = cheerio.load(htmlContent);

        const extractedVideos = [];
        const seen = new Set(); // To handle potential duplicate entries in the history file

        const videoEntries = $('.content-cell.mdl-cell.mdl-cell--6-col.mdl-typography--body-1');

        videoEntries.each((index, element) => {
            const links = $(element).find('a');

            if (links.length >= 2) {
                const title = $(links[0]).text().trim();
                const channel = $(links[1]).text().trim();
                
                // Deduplication logic
                const key = `${title}:::${channel}`;
                if (title && !seen.has(key)) {
                    seen.add(key);
                    extractedVideos.push({ title, channel });
                }
            }
        });

        // 3. --- Calculate Basic Statistics ---
        const totalVideos = extractedVideos.length;
        const uniqueChannels = new Set(extractedVideos.map(v => v.channel)).size;

        // 4. --- Send the Response ---
        res.json({
            success: true,
            filename: req.file.originalname,
            statistics: {
                totalVideos,
                uniqueChannels
            },
            // Send a small sample back to the client for preview
            sample: extractedVideos.slice(0, 5) 
        });

    } catch (error) {
        console.error('Error during file processing:', error);
        res.status(500).json({ error: 'Failed to process the file.' });
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Aina AI backend listening on http://localhost:${PORT}`);
});