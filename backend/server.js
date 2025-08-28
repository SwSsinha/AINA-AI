// Basic Express server for Aina AI backend (Phase 1.2)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// Multer setup: memory storage (privacy-first). Limits are configurable via env.
const storage = multer.memoryStorage();
const upload = multer({
	storage,
	limits: {
		fileSize: parseInt(process.env.MAX_UPLOAD_BYTES || '10485760', 10), // default 10MB
	},
});

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
	res.json({ status: 'ok', message: 'Aina AI backend running' });
});

// POST /analyze - receives watch-history.html via multipart/form-data (field: historyFile)
app.post('/analyze', upload.single('historyFile'), (req, res) => {
	// Basic validation: file present and appears to be HTML
	if (!req.file) {
		return res.status(400).json({ error: 'Missing file: historyFile' });
	}

	const { originalname = '', mimetype = '', size = 0 } = req.file;
	const isHtml = mimetype.includes('html') || originalname.toLowerCase().endsWith('.html');
	if (!isHtml) {
		return res.status(400).json({ error: 'Invalid file type. Expected an HTML file.' });
	}

				// Read uploaded file content (utf-8) for parsing in later steps
				const html = req.file.buffer.toString('utf-8');

				// Load into Cheerio for parsing
				let $;
				try {
					$ = cheerio.load(html);
				} catch (err) {
					// eslint-disable-next-line no-console
					console.error('cheerio parse error:', err && err.message);
					return res.status(400).json({ error: 'failed_to_parse_html' });
				}
			// Verification hook: log the uploaded file object (do not log content in prod)
		// eslint-disable-next-line no-console
		console.log('uploaded file:', {
			fieldname: req.file.fieldname,
			originalname: req.file.originalname,
			mimetype: req.file.mimetype,
			size: req.file.size,
		});

		return res.json({ success: true, filename: originalname, bytes: size });
});

// Multer and general error handler
app.use((err, req, res, next) => {
	if (err && err.name === 'MulterError') {
		return res.status(400).json({ error: err.message });
	}
	// eslint-disable-next-line no-console
	console.error(err);
	res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Aina AI backend listening on http://localhost:${PORT}`);
});