#!/usr/bin/env node
/**
 * Gmail Connection Checker
 * 
 * Simple script to check if Gmail OAuth2 is connected and provide connection URL if not.
 * Run with: node src/scripts/check-gmail-connection.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test user credentials
const TEST_TENANT_ID = 'tenant_test_prod';
const TEST_USER_ID = 'user_test_prod';

async function checkGmailConnection() {
  console.log('🔧 Gmail Connection Status Check');
  console.log('=================================\n');

  try {
    // Check for existing Gmail connection
    const account = await prisma.emailAccount.findFirst({
      where: {
        tenantId: TEST_TENANT_ID,
        userId: TEST_USER_ID,
        provider: 'gmail',
        isActive: true
      },
      select: {
        id: true,
        email: true,
        connectedAt: true,
        lastSyncAt: true,
        tokenExpiresAt: true
      }
    });

    if (account) {
      console.log('✅ Gmail Account Connected!');
      console.log('================================');
      console.log(`📧 Email: ${account.email}`);
      console.log(`📅 Connected: ${account.connectedAt}`);
      console.log(`⏰ Token Expires: ${account.tokenExpiresAt || 'N/A'}`);
      console.log(`🔄 Last Sync: ${account.lastSyncAt || 'Never'}\n`);
      console.log('✨ Ready to send batch emails via Gmail API!\n');
      console.log('Next steps:');
      console.log('1. Ensure backend server is running: npm run dev');
      console.log('2. Use the frontend Campaigns page to create and send a campaign');
      console.log('3. Or run: node src/scripts/send-test-campaign.js\n');
      return true;
    } else {
      console.log('⚠️  No Gmail Connection Found');
      console.log('==============================\n');
      console.log('To connect Gmail for batch email sending:');
      console.log('\n📋 STEP-BY-STEP CONNECTION PROCESS:\n');
      console.log('1. Start the backend server:');
      console.log('   npm run dev\n');
      console.log('2. Open your browser and navigate to:');
      console.log('   http://localhost:4000/api/v1/integrations/gmail/auth\n');
      console.log('3. You will be redirected to Google OAuth consent screen');
      console.log('4. Sign in with the Gmail account you want to use for sending');
      console.log('5. Grant the requested permissions');
      console.log('6. After authorization, you will be redirected back');
      console.log('7. Run this script again to verify connection\n');
      console.log('Note: Make sure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and');
      console.log('      GMAIL_REDIRECT_URI are set in backend/.env file\n');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking Gmail connection:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkGmailConnection()
  .then((connected) => {
    process.exit(connected ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
