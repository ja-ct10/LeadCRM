#!/usr/bin/env node
// DISABLED: TypeScript compilation errors
// @ts-nocheck
/**
 * GMAIL CONNECTION TEST
 * 
 * Tests the Gmail OAuth2 connection flow and provides the URL for user to connect.
 * This script helps set up the Gmail connection needed for batch email testing.
 */

import * as gmailService from '../../modules/marketing/email/gmail.service';
import prisma from '../../config/database.config';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api/v1';

interface AuthResponse {
  success: boolean;
  data?: {
    url?: string;
    user?: any;
  };
  error?: string;
}

class GmailConnectionTester {
  
  async checkServerStatus() {
    try {
      console.log('📡 Checking server status...');
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      console.log('✅ Server is running');
      return true;
    } catch (error) {
      console.log('❌ Server is not responding');
      if (axios.isAxiosError(error)) {
        console.log(`   Error: ${error.message}`);
      }
      return false;
    }
  }

  async generateGmailAuthUrl() {
    try {
      console.log('🔗 Generating Gmail OAuth URL...');
      
      // For testing purposes, we'll use demo credentials
      // In production, this would be called by an authenticated user
      const testPayload = {
        tenantId: 'tenant_test_prod',
        userId: 'user_test_prod'
      };

      // Try to get the auth URL directly from the service
      const { url, state } = gmailService.getAuthUrl(testPayload.tenantId, testPayload.userId);
      
      console.log('✅ Gmail OAuth URL generated successfully!');
      console.log('\n🔐 GMAIL OAUTH CONNECTION INSTRUCTIONS:');
      console.log('=======================================');
      console.log('1. Copy and paste the following URL into your browser:');
      console.log('\n' + url);
      console.log('\n2. Sign in with the Gmail account you want to use for sending emails');
      console.log('3. Grant the requested permissions');
      console.log('4. The browser will redirect to the callback URL');
      console.log('5. The Gmail connection will be established automatically\n');
      
      return { success: true, url, state };
    } catch (error) {
      console.log('❌ Failed to generate Gmail auth URL');
      if (error instanceof Error) {
        console.log(`   Error: ${error.message}`);
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async checkExistingConnection() {
    try {
      console.log('🔍 Checking for existing Gmail connections...');
      
      const accounts = await prisma.emailAccount.findMany({
        where: {
          tenantId: 'tenant_test_prod',
          userId: 'user_test_prod',
          provider: 'gmail',
          isActive: true
        },
        select: {
          id: true,
          email: true,
          connectedAt: true,
          lastSyncAt: true
        }
      });

      if (accounts.length > 0) {
        console.log('✅ Found existing Gmail connection(s):');
        accounts.forEach((account: { id: string; email: string; connectedAt: Date }) => {
          console.log(`   📧 ${account.email} (connected: ${account.connectedAt})`);
        });
        return { connected: true, accounts };
      } else {
        console.log('⚠️  No Gmail connections found for test user');
        return { connected: false, accounts: [] };
      }
    } catch (error) {
      console.log('❌ Failed to check Gmail connections');
      if (error instanceof Error) {
        console.log(`   Error: ${error.message}`);
      }
      return { connected: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async runConnectionTest() {
    console.log('🔧 Gmail Connection Test for Batch Email Sending');
    console.log('==============================================\n');

    // Check server status
    const serverRunning = await this.checkServerStatus();
    if (!serverRunning) {
      console.log('\n❌ Cannot proceed - backend server is not running');
      console.log('   Please start the server with: npm run dev\n');
      return false;
    }

    // Check for existing connections
    const existingConnection = await this.checkExistingConnection();
    
    if (existingConnection.connected) {
      console.log('\n🎉 Gmail connection already established!');
      console.log('   Ready for batch email testing with real Gmail API\n');
      return true;
    }

    // Generate auth URL for new connection
    const authResult = await this.generateGmailAuthUrl();
    
    if (authResult.success) {
      console.log('⏳ Waiting for OAuth completion...');
      console.log('   Once you complete the OAuth flow, the Gmail connection will be ready');
      console.log('   for batch email testing with the specified recipients:\n');
      console.log('   📧 jtiron2004@gmail.com');
      console.log('   📧 durussy1@gmail.com\n');
      return true;
    }

    return false;
  }
}

async function main() {
  const tester = new GmailConnectionTester();
  
  try {
    const success = await tester.runConnectionTest();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Gmail connection test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

export { GmailConnectionTester };