import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { errorMiddleware } from './api/middleware/error.middleware';
import { loggerMiddleware } from './api/middleware/logger.middleware';
import { rateLimitMiddleware } from './api/middleware/rate-limit.middleware';
import router from './api/routes/index';

const app = express();

// ── Trust Render/proxy headers ────────────────────────
// Required for rate limiting behind Render's load balancer
app.set('trust proxy', 1);

// ── Security Headers (must be first) ─────────────────
app.use(helmet());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));

// ── CORS — restrict to known frontend origins ─────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.APP_URL ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, health checks)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);

// ── Body Parsing ─────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── Request Logging & Rate Limiting ──────────────────
app.use(loggerMiddleware);
app.use(rateLimitMiddleware);

// ── Routes ────────────────────────────────────────────
app.use('/api/v1', router);

// ── Health Check ──────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error Handler (must be last) ──────────────────────
app.use(errorMiddleware);

export default app;
