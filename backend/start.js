/**
 * Production entry point for Render deployment.
 * This file is copied into dist/ during build.
 * Render start command: node dist/start.js
 */
require('./backend/src/server.js');
