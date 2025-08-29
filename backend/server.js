require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cheerio = require('cheerio');
// CORRECT SDK IMPORT based on your documentation
const { GoogleGenAI } = require('@google/genai');

// --- Initialize Gemini Client (New Syntax) ---
// The API key from .env is picked up automatically by the new SDK
const ai = new GoogleGenAI({});

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware & File Upload ---
app.use(cors());
app.use(express.json());
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- Helper Functions ---
function createAnalysisPrompt(videoTitles) {
    const prompt = `
        Analyze the following list of YouTube video titles and return a JSON object with two keys: "sentimentAnalysis" and "topicAnalysis".
        - "sentimentAnalysis" should contain the percentage of "Positive", "Negative", and "Neutral" titles.
        - "topicAnalysis" should be an array of the top 5 topics with their estimated counts.
        IMPORTANT: Your output must be only the raw JSON object, with no extra text or markdown.

        Titles:
        ${videoTitles.join('\n')}
    `;
    return prompt;
}

function parseGeminiResponse(rawText) {
    try {
        let cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("Failed to parse AI response:", error);
        return null;
    }
}

function calculateSourceDiversity(videos) {
    const channelCounts = new Map();
    videos.forEach(video => {
        channelCounts.set(video.channel, (channelCounts.get(video.channel) || 0) + 1);
    });
    return Array.from(channelCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([channel, count]) => ({ channel, count }));
}

// --- API Routes ---
app.post('/analyze', upload.single('historyFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file was uploaded.' });
    }

    try {
        // == PHASE 3: PARSE HTML ==
        const htmlContent = req.file.buffer.toString('utf-8');
        const $ = cheerio.load(htmlContent);
        const extractedVideos = [];
        $('.content-cell.mdl-cell.mdl-cell--6-col.mdl-typography--body-1').each((i, el) => {
            const links = $(el).find('a');
            if (links.length >= 2) {
                const title = $(links[0]).text().trim();
                const channel = $(links[1]).text().trim();
                if (title && channel) {
                    extractedVideos.push({ title, channel });
                }
            }
        });

        // == PHASE 4 & 5: AI ANALYSIS & FINAL REPORT ==
        const allTitles = extractedVideos.map(v => v.title);
        
        // CORRECT API CALL SYNTAX
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // CORRECT model name
            contents: createAnalysisPrompt(allTitles),
        });

        const aiResults = parseGeminiResponse(response.text);
        if (!aiResults) {
            throw new Error("Failed to parse the response from the AI model.");
        }

        const statistics = {
            totalVideos: extractedVideos.length,
            uniqueChannels: new Set(extractedVideos.map(v => v.channel)).size
        };
        
        const sourceDiversity = calculateSourceDiversity(extractedVideos);

        const finalReport = {
            statistics,
            sentimentAnalysis: aiResults.sentimentAnalysis,
            topicAnalysis: aiResults.topicAnalysis,
            sourceDiversity
        };

        res.json(finalReport);

    } catch (error) {
        console.error('Error during processing:', error);
        res.status(500).json({ error: 'An error occurred during analysis.' });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 Aina AI backend is live and listening on http://localhost:${PORT}`);
});