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

					// Parse watch entries: look for anchor tags that point to YouTube watch pages
					const entries = [];
					const seen = new Set();

					function normalize(s) {
						return (s || '').replace(/\s+/g, ' ').trim();
					}

					function extractChannelFromParent($el, title) {
						const parentText = normalize($el.parent().text().replace(title, ''));
						if (!parentText) return null;
						// split by common separators and take the last non-empty segment
						const parts = parentText.split(/—|–|-|\u2014|\u2013|:/).map(p => normalize(p)).filter(Boolean);
						if (parts.length === 0) return null;
						// prefer the last part as channel name
						return parts[parts.length - 1];
					}

						$('a[href*="youtube.com/watch"], a[href*="/watch?v="]').each((i, el) => {
							const $el = $(el);

							// title: anchor text, or title/aria-label, or img alt
							let title = normalize($el.text()) || normalize($el.attr('title')) || normalize($el.attr('aria-label')) || '';
							if (!title) {
								const imgAlt = $el.find('img[alt]').attr('alt');
								title = normalize(imgAlt || '');
							}
							if (!title) return;

							let channel = null;

							// 1) attempt: channel text in nearby, common selectors
							const nearbySelectors = ['.yt-channel-name', '.channel-name', '.byline', '.subtitle', '.meta', 'small'];
							for (const sel of nearbySelectors) {
								const found = $el.closest('li,div,p').find(sel).first();
								if (found && normalize(found.text())) {
									channel = normalize(found.text());
									break;
								}
							}

							// 2) attempt: extract from parent text using separators
							if (!channel) channel = extractChannelFromParent($el, title);

							// 3) attempt: regex scan up the ancestor chain for 'by' or separators
							if (!channel) {
								let anc = $el.parent();
								for (let depth = 0; depth < 4 && anc && anc.length; depth++) {
									const text = normalize(anc.text().replace(title, ''));
									if (text) {
										const m = text.match(/(?:by|from|•|·|—|–|-|:|\|)\s*([^\n\r]+)/i);
										if (m && m[1]) {
											channel = normalize(m[1].split(/\n|\r/)[0]);
											break;
										}
									}
									anc = anc.parent();
								}
							}

							// 4) attempt: check next/previous sibling text nodes
							if (!channel) {
								const next = $el[0].nextSibling;
								if (next && next.nodeType === 3) {
									const t = normalize(next.nodeValue || '');
									const cand = t.replace(/^[-:\s\u2014\u2013]+/, '');
									if (cand) channel = cand;
								}
								if (!channel) {
									const prev = $el[0].previousSibling;
									if (prev && prev.nodeType === 3) {
										const t = normalize(prev.nodeValue || '');
										const cand = t.replace(/^[-:\s\u2014\u2013]+/, '');
										if (cand) channel = cand;
									}
								}
							}

							const key = `${title}:::${channel || ''}`;
							if (seen.has(key)) return;
							seen.add(key);

							entries.push({ title, channel: channel || null });
						});

					const totalVideos = entries.length;
					const uniqueChannels = new Set(entries.map(e => e.channel).filter(Boolean)).size;
			// Verification hook: log the uploaded file object (do not log content in prod)
		// eslint-disable-next-line no-console
		console.log('uploaded file:', {
			fieldname: req.file.fieldname,
			originalname: req.file.originalname,
			mimetype: req.file.mimetype,
			size: req.file.size,
		});

	// Send back a small sample of parsed entries for verification
	const sample = entries.slice(0, 5);
	return res.json({
		success: true,
		filename: originalname,
		bytes: size,
		statistics: { totalVideos, uniqueChannels },
		sample,
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