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

import { workspaceReadyMiddleware } from '../middleware/tenant.middleware';

const router = Router();

// ── Gmail Integration ─────────────────────────────────
// GET  /integrations/gmail/authorize   — get OAuth URL (authenticated)
// GET  /integrations/gmail/callback    — OAuth callback from Google (no auth — state-validated)
// GET  /integrations/gmail/status      — connection status (authenticated)
// GET  /integrations/gmail/emails      — fetch inbox emails (authenticated)
// POST /integrations/gmail/send        — send email (authenticated)
// POST /integrations/gmail/disconnect  — disconnect account (authenticated)

router.get('/gmail/authorize', authMiddleware, workspaceReadyMiddleware, authorize);
router.get('/gmail/callback', callback); // No auth — Google redirects here directly
router.get('/gmail/status', authMiddleware, workspaceReadyMiddleware, status);
router.get('/gmail/emails', authMiddleware, workspaceReadyMiddleware, listEmails);
router.post('/gmail/send', authMiddleware, workspaceReadyMiddleware, send);
router.post('/gmail/disconnect', authMiddleware, workspaceReadyMiddleware, disconnect);
router.post('/gmail/trash', authMiddleware, workspaceReadyMiddleware, trash);
router.post('/gmail/archive', authMiddleware, workspaceReadyMiddleware, archive);
router.post('/gmail/drafts', authMiddleware, workspaceReadyMiddleware, saveDraftHandler);
router.delete('/gmail/drafts/:draftId', authMiddleware, workspaceReadyMiddleware, deleteDraftHandler);

export default router;
