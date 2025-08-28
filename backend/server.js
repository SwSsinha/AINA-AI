// Basic Express server for Aina AI backend (Phase 1.2)
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
	res.json({ status: 'ok', message: 'Aina AI backend running' });
});

app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Aina AI backend listening on http://localhost:${PORT}`);
});