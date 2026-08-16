#!/usr/bin/env node
/**
 * Gmail OAuth URL Generator
 * 
 * Generates the Gmail OAuth2 authorization URL for connecting a Gmail account.
 * Run with: node src/scripts/generate-gmail-oauth-url.js
 */

const crypto = require('crypto');

// Get credentials from environment
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || '944272381277-9jqeu7k7373an58gk1g7kc0j504e664g.apps.googleusercontent.com';
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:4000/api/v1/integrations/gmail/callback';

// Test user credentials
const TEST_TENANT_ID = 'tenant_test_prod';
const TEST_USER_ID = 'user_test_prod';

function generateAuthUrl() {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  // Generate CSRF state token
  const stateData = {
    tenantId: TEST_TENANT_ID,
    userId: TEST_USER_ID,
    nonce: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

  const params = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    redirect_uri: GMAIL_REDIRECT_URI,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  console.log('🔐 GMAIL OAUTH2 CONNECTION URL');
  console.log('===============================\n');
  console.log('📋 INSTRUCTIONS:');
  console.log('1. Make sure the backend server is running: npm run dev');
  console.log('2. Copy the URL below and paste it into your browser');
  console.log('3. Sign in with the Gmail account you want to use for sending emails');
  console.log('4. Grant the requested permissions');
  console.log('5. You will be redirected back to the app\n');
  console.log('🔗 AUTHORIZATION URL:\n');
  console.log(url);
  console.log('\n📧 Test Recipients for Batch Email:');
  console.log('   • jtiron2004@gmail.com');
  console.log('   • durussy1@gmail.com\n');
  console.log('✨ After connecting, run: node src/scripts/check-gmail-connection.js');
  console.log('   to verify the connection status\n');
}

// Generate and display the URL
generateAuthUrl();
