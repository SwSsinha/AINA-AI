// --- Gemini AI Response Parsing ---
function parseGeminiResponse(rawText) {
    if (!rawText) return null;
    // Remove markdown/code block wrappers if present
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
    }
    // Try to parse JSON
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // If parsing fails, try to extract the first JSON object from the text
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (err) {
                return null;
            }
        }
        return null;
    }
}
// --- Source Diversity Calculation ---
function calculateSourceDiversity(videos) {
    if (!videos || videos.length === 0) return 0;
    const uniqueChannels = new Set(videos.map(v => v.channel)).size;
    // Source Diversity as a percentage of unique channels out of total videos
    return Number(((uniqueChannels / videos.length) * 100).toFixed(2));
}
require('dotenv').config(); // This MUST be the first line
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Correct SDK import

// --- Initialize Gemini Client ---
// Use your API key from the .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware Setup ---
app.use(cors());
app.use(express.json());

// --- File Upload Setup (Multer) ---
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- Helper Function for AI Prompt ---
function createAnalysisPrompt(videoTitles) {
    // This prompt instructs the AI to return a clean JSON object, which is easy to parse.
    const prompt = `
        You are an expert digital wellness analyst. I have provided a list of YouTube video titles from a user's watch history. Your task is to perform a detailed analysis and return a summary in a specific JSON format.

        Here is the list of video titles:
        ${videoTitles.join('\n')}

        Based on this list, perform the following two analyses:

        1.  **Sentiment Analysis:**
            Classify the overall emotional tone of the content. Estimate the percentage of titles that fall into these categories: "Positive", "Negative", and "Neutral". The total must sum to 100.

        2.  **Topic Analysis:**
            Identify the top 5 most frequent topics or themes. For each topic, provide the topic name and an estimated count of videos related to it.

        IMPORTANT: Your final output must be ONLY a valid JSON object. Do not include any other text, explanations, or markdown formatting like \`\`\`json. The JSON object must follow this exact structure:
        {
          "sentimentAnalysis": {
            "positivePercent": <number>,
            "negativePercent": <number>,
            "neutralPercent": <number>
          },
          "topicAnalysis": [
            { "topic": "<string>", "count": <number> },
            { "topic": "<string>", "count": <number> },
            { "topic": "<string>", "count": <number> },
            { "topic": "<string>", "count": <number> },
            { "topic": "<string>", "count": <number> }
          ]
        }
    `;
    return prompt;
}

// --- API Routes ---
app.get('/', (req, res) => {
    res.json({ message: 'Aina AI backend is running!' });
});

app.post('/analyze', upload.single('historyFile'), async (req, res) => { // Added 'async'
    if (!req.file) {
        return res.status(400).json({ error: 'No file was uploaded.' });
    }
    if (!req.file.originalname.toLowerCase().endsWith('.html')) {
        return res.status(400).json({ error: 'Invalid file type. Please upload your watch-history.html file.' });
    }

    try {
        const htmlContent = req.file.buffer.toString('utf-8');
        const $ = cheerio.load(htmlContent);
        const extractedVideos = [];
        const seen = new Set();
        const videoEntries = $('.content-cell.mdl-cell.mdl-cell--6-col.mdl-typography--body-1');

        videoEntries.each((index, element) => {
            const links = $(element).find('a');
            if (links.length >= 2) {
                const title = $(links[0]).text().trim();
                const channel = $(links[1]).text().trim();
                const key = `${title}:::${channel}`;
                if (title && !seen.has(key)) {
                    seen.add(key);
                    extractedVideos.push({ title, channel });
                }
            }
        });

        // --- AI Analysis Step ---
        // CRITICAL FIX: Send ALL titles to the AI, not just a small slice.
        const allTitles = extractedVideos.map(v => v.title);
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Correct model name
        const prompt = createAnalysisPrompt(allTitles);
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiResponseText = response.text();

        console.log("--- Raw AI Response ---");
        console.log(aiResponseText);
        
        // --- Prepare Final Response ---
        // For now, we will just confirm it works and show the raw text. 
        // In Phase 5, we'll parse this text.
        res.json({
            message: "AI analysis completed successfully!",
            rawAIResponse: aiResponseText
        });

    } catch (error) {
        console.error('Error during processing:', error);
        res.status(500).json({ error: 'Failed to process the file.' });
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Aina AI backend listening on http://localhost:${PORT}`);
});