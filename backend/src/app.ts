import express from 'express';
import cors from 'cors';
import { errorMiddleware } from './api/middleware/error.middleware';
import { loggerMiddleware } from './api/middleware/logger.middleware';
import { rateLimitMiddleware } from './api/middleware/rate-limit.middleware';
import router from './api/routes/index';

const app = express();

// ── Global Middleware ─────────────────────────────
app.use(cors({ origin: process.env.APP_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggerMiddleware);
app.use(rateLimitMiddleware);

// ── Routes ────────────────────────────────────────
app.use('/api/v1', router);

// ── Health Check ──────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error Handler (must be last) ──────────────────
app.use(errorMiddleware);

export default app;
