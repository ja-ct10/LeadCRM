import 'dotenv/config';
import app from './app';
import { startCampaignScheduler } from './core/scheduler/campaign-scheduler.service';

// Guard against missing required env vars at startup
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const PORT = process.env.PORT ?? 4000;

app.listen(PORT, () => {
  console.log(`[server] LeadCRM API running on http://localhost:${PORT}`);
  console.log(`[server] Environment: ${process.env.NODE_ENV ?? 'development'}`);
  
  // Start background services
  startCampaignScheduler();
});
