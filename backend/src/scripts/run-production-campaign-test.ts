#!/usr/bin/env node
/**
 * PRODUCTION CAMPAIGN TEST RUNNER
 * 
 * Runs the sequential Gmail test suite to verify production readiness.
 * This script must be executed with a connected Gmail account.
 * 
 * Usage:
 *   npm run test:campaign-production
 * 
 * Prerequisites:
 * 1. Backend server running on port 4000
 * 2. PostgreSQL database connected
 * 3. Gmail OAuth2 configured in .env
 * 4. Test user has connected Gmail account
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { ProductionAuditManager } from './sequential-gmail-test';

async function main() {
  console.log('🚀 Starting LeadCRM Production Campaign Test');
  console.log('============================================\n');

  // Environment check
  const requiredEnvs = [
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET', 
    'GMAIL_REDIRECT_URI',
    'DATABASE_URL',
  ];

  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
  if (missingEnvs.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvs.forEach(env => console.error(`   - ${env}`));
    process.exit(1);
  }

  console.log('✅ Environment variables verified');
  console.log('✅ Gmail OAuth2 configured');
  console.log('✅ Database connection ready\n');

  // Run the production audit
  const auditManager = new ProductionAuditManager();
  
  try {
    await auditManager.runProductionAudit();
    console.log('\n🎉 Production audit completed successfully!');
  } catch (error) {
    console.error('\n❌ Production audit failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Test terminated');
  process.exit(0);
});

// Run the test
main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});