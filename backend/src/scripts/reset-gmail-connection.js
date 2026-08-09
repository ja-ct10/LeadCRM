#!/usr/bin/env node
/**
 * Reset Gmail Connection
 * Deletes the existing Gmail account so it can be reconnected with proper encryption
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetGmailConnection() {
  console.log('🔄 Resetting Gmail connection...\n');
  
  try {
    const deleted = await prisma.emailAccount.deleteMany({
      where: {
        provider: 'gmail',
        email: 'tironjulieann10@gmail.com'
      }
    });
    
    console.log(`✅ Deleted ${deleted.count} Gmail account(s)`);
    console.log('📧 Email: tironjulieann10@gmail.com');
    console.log('\n✨ Now reconnect Gmail using the OAuth URL:');
    console.log('   Run: node src/scripts/generate-gmail-oauth-url.js\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetGmailConnection();
