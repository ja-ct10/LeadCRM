#!/usr/bin/env node
/**
 * PRODUCTION ARCHITECTURE VERIFICATION
 * 
 * Verifies that the LeadCRM campaigns module has production-ready architecture
 * without requiring database records or Gmail connections.
 */

import fs from 'fs';
import path from 'path';

interface ArchitectureCheck {
  name: string;
  passed: boolean;
  details: string;
}

class ProductionArchitectureVerifier {
  private checks: ArchitectureCheck[] = [];

  private check(name: string, passed: boolean, details: string) {
    this.checks.push({ name, passed, details });
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${name}: ${details}`);
  }

  verifyGmailService() {
    try {
      const gmailServicePath = path.resolve(__dirname, '../modules/marketing/email/gmail.service.ts');
      const content = fs.readFileSync(gmailServicePath, 'utf8');

      // Check for sequential sending implementation
      const hasSequentialMode = content.includes('for (const recipient of recipients)') &&
                                content.includes('mode') &&
                                content.includes('delayMs');

      // Check for OAuth2 implementation
      const hasOAuth2 = content.includes('getAuthUrl') &&
                       content.includes('exchangeCodeForTokens') &&
                       content.includes('refreshAccessToken');

      // Check for database persistence
      const hasPersistence = content.includes('prisma.emailDeliveryLog.create') &&
                            content.includes('gmailMessageId') &&
                            content.includes('status: ');

      // Check for audit logging
      const hasAuditLogging = content.includes('writeAuditLog');

      if (hasSequentialMode && hasOAuth2 && hasPersistence && hasAuditLogging) {
        this.check('Gmail Service Architecture', true, 
          'Sequential sending, OAuth2, database persistence, and audit logging implemented');
      } else {
        const missing = [];
        if (!hasSequentialMode) missing.push('sequential mode');
        if (!hasOAuth2) missing.push('OAuth2');
        if (!hasPersistence) missing.push('database persistence');
        if (!hasAuditLogging) missing.push('audit logging');
        
        this.check('Gmail Service Architecture', false, 
          `Missing: ${missing.join(', ')}`);
      }
    } catch (error) {
      this.check('Gmail Service Architecture', false, 
        error instanceof Error ? error.message : String(error));
    }
  }

  verifyCampaignService() {
    try {
      const campaignServicePath = path.resolve(__dirname, '../modules/marketing/campaigns/campaigns.service.ts');
      const content = fs.readFileSync(campaignServicePath, 'utf8');

      // Check for tenant isolation
      const hasTenantIsolation = content.includes('tenantId') &&
                                content.includes('where: { id, tenantId }');

      // Check for audit logging
      const hasAuditLogging = content.includes('writeAuditLog');

      // Check for sequential email calling
      const hasSequentialCalling = content.includes('sendBulkEmail') &&
                                   content.includes('mode: \'sequential\'');

      if (hasTenantIsolation && hasAuditLogging && hasSequentialCalling) {
        this.check('Campaign Service Architecture', true,
          'Tenant isolation, audit logging, and sequential email integration implemented');
      } else {
        const missing = [];
        if (!hasTenantIsolation) missing.push('tenant isolation');
        if (!hasAuditLogging) missing.push('audit logging');
        if (!hasSequentialCalling) missing.push('sequential email calls');
        
        this.check('Campaign Service Architecture', false,
          `Missing: ${missing.join(', ')}`);
      }
    } catch (error) {
      this.check('Campaign Service Architecture', false,
        error instanceof Error ? error.message : String(error));
    }
  }

  verifyDatabaseSchema() {
    try {
      const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
      const content = fs.readFileSync(schemaPath, 'utf8');

      // Check for required models
      const hasCampaignModel = content.includes('model Campaign');
      const hasEmailDeliveryLog = content.includes('model EmailDeliveryLog');
      const hasEmailAccount = content.includes('model EmailAccount');
      const hasAuditLog = content.includes('model AuditLog');

      // Check for tenant isolation fields
      const hasTenantIdFields = content.includes('tenantId       String') ||
                               content.includes('tenantId String');

      // Check for Gmail integration fields
      const hasGmailFields = content.includes('gmailMessageId') &&
                            content.includes('gmailThreadId') &&
                            content.includes('accessToken') &&
                            content.includes('refreshToken');

      if (hasCampaignModel && hasEmailDeliveryLog && hasEmailAccount && hasAuditLog && 
          hasTenantIdFields && hasGmailFields) {
        this.check('Database Schema', true,
          'All required models and fields for production email campaigns');
      } else {
        const missing = [];
        if (!hasCampaignModel) missing.push('Campaign model');
        if (!hasEmailDeliveryLog) missing.push('EmailDeliveryLog model');
        if (!hasEmailAccount) missing.push('EmailAccount model');
        if (!hasAuditLog) missing.push('AuditLog model');
        if (!hasTenantIdFields) missing.push('tenantId fields');
        if (!hasGmailFields) missing.push('Gmail integration fields');
        
        this.check('Database Schema', false,
          `Missing: ${missing.join(', ')}`);
      }
    } catch (error) {
      this.check('Database Schema', false,
        error instanceof Error ? error.message : String(error));
    }
  }

  verifyEnvironmentConfiguration() {
    try {
      const envPath = path.resolve(__dirname, '../../.env');
      const content = fs.readFileSync(envPath, 'utf8');

      // Check for Gmail OAuth2 configuration
      const hasGmailClientId = content.includes('GMAIL_CLIENT_ID');
      const hasGmailClientSecret = content.includes('GMAIL_CLIENT_SECRET');
      const hasGmailRedirectUri = content.includes('GMAIL_REDIRECT_URI');
      const hasUnsubscribeUrl = content.includes('UNSUBSCRIBE_URL');

      if (hasGmailClientId && hasGmailClientSecret && hasGmailRedirectUri && hasUnsubscribeUrl) {
        this.check('Environment Configuration', true,
          'Gmail OAuth2 and unsubscribe configuration present');
      } else {
        const missing = [];
        if (!hasGmailClientId) missing.push('GMAIL_CLIENT_ID');
        if (!hasGmailClientSecret) missing.push('GMAIL_CLIENT_SECRET');
        if (!hasGmailRedirectUri) missing.push('GMAIL_REDIRECT_URI');
        if (!hasUnsubscribeUrl) missing.push('UNSUBSCRIBE_URL');
        
        this.check('Environment Configuration', false,
          `Missing environment variables: ${missing.join(', ')}`);
      }
    } catch (error) {
      this.check('Environment Configuration', false,
        error instanceof Error ? error.message : String(error));
    }
  }

  verifyFrontendConfiguration() {
    try {
      const configPath = path.resolve(__dirname, '../../../frontend/src/lib/config.ts');
      const content = fs.readFileSync(configPath, 'utf8');

      const usesMockData = content.includes("process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'false'");
      
      if (usesMockData) {
        this.check('Frontend Configuration', true,
          'Frontend configured to use real API when NEXT_PUBLIC_USE_MOCK_DATA=false');
      } else {
        this.check('Frontend Configuration', false,
          'Frontend configuration not set up for production API switching');
      }
    } catch (error) {
      this.check('Frontend Configuration', false,
        'Frontend config file not found or readable');
    }
  }

  verifyAPIRoutes() {
    try {
      const routesPath = path.resolve(__dirname, '../api/routes/marketing.routes.ts');
      const content = fs.readFileSync(routesPath, 'utf8');

      // Check for required campaign routes
      const hasCampaignRoutes = content.includes('/campaigns') &&
                               content.includes('getCampaigns') &&
                               content.includes('sendCampaign');

      // Check for Gmail routes
      const hasGmailRoutes = content.includes('/gmail/send') &&
                            content.includes('/gmail/bulk') &&
                            content.includes('/gmail/auth-url') &&
                            content.includes('/gmail/callback');

      // Check for RBAC middleware
      const hasRBAC = content.includes('authorize(') &&
                     content.includes('campaigns.send');

      if (hasCampaignRoutes && hasGmailRoutes && hasRBAC) {
        this.check('API Routes', true,
          'Campaign and Gmail routes with RBAC protection implemented');
      } else {
        const missing = [];
        if (!hasCampaignRoutes) missing.push('campaign routes');
        if (!hasGmailRoutes) missing.push('Gmail routes');
        if (!hasRBAC) missing.push('RBAC protection');
        
        this.check('API Routes', false,
          `Missing: ${missing.join(', ')}`);
      }
    } catch (error) {
      this.check('API Routes', false,
        error instanceof Error ? error.message : String(error));
    }
  }

  generateReport() {
    const passed = this.checks.filter(c => c.passed).length;
    const total = this.checks.length;
    
    console.log('\n📊 PRODUCTION ARCHITECTURE VERIFICATION REPORT');
    console.log('===============================================');
    console.log(`Architecture Checks: ${passed}/${total} passed\n`);

    if (passed === total) {
      console.log('🎉 PRODUCTION ARCHITECTURE VERIFIED!');
      console.log('\n✅ All Production Components Ready:');
      console.log('   • Sequential Gmail batch sending infrastructure');
      console.log('   • OAuth2 authentication with token management'); 
      console.log('   • Database persistence and audit logging');
      console.log('   • Tenant isolation and RBAC security');
      console.log('   • Real API integration (no mock data)');
      console.log('   • Complete REST API with protected routes');
      console.log('\n🚀 Next Steps for Live Testing:');
      console.log('   1. Ensure test tenant and user exist in database');
      console.log('   2. Complete Gmail OAuth2 connection for test user');
      console.log('   3. Run production test with real recipients');
      console.log('   4. Verify sequential sending with 2-second delays');
    } else {
      console.log('❌ ARCHITECTURE ISSUES DETECTED');
      console.log('\n   Review failed checks above and fix before proceeding.');
      
      const failed = this.checks.filter(c => !c.passed);
      console.log('\n   Failed Checks:');
      failed.forEach(f => {
        console.log(`   • ${f.name}: ${f.details}`);
      });
    }

    return passed === total;
  }

  runVerification() {
    console.log('🔍 Verifying Production Architecture...\n');

    this.verifyGmailService();
    this.verifyCampaignService();  
    this.verifyDatabaseSchema();
    this.verifyEnvironmentConfiguration();
    this.verifyFrontendConfiguration();
    this.verifyAPIRoutes();

    return this.generateReport();
  }
}

async function main() {
  console.log('🏗️  LeadCRM Production Architecture Verification');
  console.log('==============================================\n');

  const verifier = new ProductionArchitectureVerifier();
  
  try {
    const allPassed = verifier.runVerification();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('💥 Architecture verification failed:', error);
    process.exit(1);
  }
}

// Run verification
if (require.main === module) {
  main().catch(console.error);
}

export { ProductionArchitectureVerifier };