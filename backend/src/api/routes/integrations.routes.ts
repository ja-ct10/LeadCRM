import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  authorize,
  callback,
  status,
  listEmails,
  send,
  disconnect,
  trash,
  archive,
  saveDraftHandler,
  deleteDraftHandler,
} from '../../integrations/gmail/gmail.controller';

const router = Router();

// ── Gmail Integration ─────────────────────────────────
// GET  /integrations/gmail/authorize   — get OAuth URL (authenticated)
// GET  /integrations/gmail/callback    — OAuth callback from Google (no auth — state-validated)
// GET  /integrations/gmail/status      — connection status (authenticated)
// GET  /integrations/gmail/emails      — fetch inbox emails (authenticated)
// POST /integrations/gmail/send        — send email (authenticated)
// POST /integrations/gmail/disconnect  — disconnect account (authenticated)

router.get('/gmail/authorize', authMiddleware, authorize);
router.get('/gmail/callback', callback); // No auth — Google redirects here directly
router.get('/gmail/status', authMiddleware, status);
router.get('/gmail/emails', authMiddleware, listEmails);
router.post('/gmail/send', authMiddleware, send);
router.post('/gmail/disconnect', authMiddleware, disconnect);
router.post('/gmail/trash', authMiddleware, trash);
router.post('/gmail/archive', authMiddleware, archive);
router.post('/gmail/drafts', authMiddleware, saveDraftHandler);
router.delete('/gmail/drafts/:draftId', authMiddleware, deleteDraftHandler);

export default router;
