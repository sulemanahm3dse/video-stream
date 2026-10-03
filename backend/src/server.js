import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import videosRouter, { mediaRouter } from './routes/videos.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/videos', videosRouter);
app.use('/media', mediaRouter);
app.use(express.static(new URL('../public', import.meta.url).pathname));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(config.port, () => console.log(`API on http://localhost:${config.port}`));
