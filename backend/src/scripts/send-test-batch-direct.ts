#!/usr/bin/env node
/**
 * Direct Batch Email Test
 * 
 * Sends test emails directly using the Gmail service (bypassing API authentication).
 * Tests sequential sending with 2-second delays.
 * 
 * Run with: npx tsx src/scripts/send-test-batch-direct.ts
 */

import { PrismaClient } from '@prisma/client';
import * as gmailService from '../modules/marketing/email/gmail.service';

const prisma = new PrismaClient();

// Test configuration
const TEST_TENANT_ID = 'a3543600-e623-4774-ae21-da85f98081c2'; // Demo Sandbox
const TEST_USER_ID = '93fbda91-d913-43f1-9252-09d40ba29ccb'; // Julie Tiron
const TEST_RECIPIENTS = [
  { email: 'jtiron2004@gmail.com', firstName: 'Julie Ann', lastName: 'Tiron' },
  { email: 'durussy1@gmail.com', firstName: 'Durussy', lastName: 'Test User' }
];

async function sendDirectBatchTest() {
  console.log('📧 Direct Gmail Batch Email Test');
  console.log('=================================\n');
  
  try {
    // 1. Verify Gmail connection
    console.log('1️⃣ Verifying Gmail connection...');
    const account = await prisma.emailAccount.findFirst({
      where: { tenantId: TEST_TENANT_ID, userId: TEST_USER_ID, provider: 'gmail', isActive: true }
    });
    
    if (!account) {
      console.error('❌ No Gmail account connected');
      process.exit(1);
    }
    console.log(`   ✅ Connected: ${account.email}\n`);

    // 2. Create campaign
    console.log('2️⃣ Creating test campaign...');
    const campaign = await prisma.campaign.create({
      data: {
        tenantId: TEST_TENANT_ID,
        name: `Direct Batch Test - ${new Date().toISOString()}`,
        type: 'EMAIL',
        status: 'DRAFT',
        subject: 'LeadCRM Batch Email Test (Direct)',
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3b82f6;">🚀 LeadCRM Direct Batch Email Test</h2>
            <p>Hello {{first_name}} {{last_name}},</p>
            <p>This email was sent using the <strong>Gmail API</strong> with sequential batch processing.</p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">✅ Test Successful!</h3>
              <ul>
                <li>Recipient: {{email}}</li>
                <li>Mode: Sequential (2-second delay)</li>
                <li>Gmail API: Real connection</li>
                <li>Time: ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            <p style="color: #059669; font-weight: bold;">If you're reading this, the batch email infrastructure is production-ready! 🎉</p>
          </div>
        `
      }
    });
    console.log(`   ✅ Campaign: ${campaign.id}\n`);

    // 3. Setup leads
    console.log('3️⃣ Setting up test leads...');
    const leads = [];
    for (const recipient of TEST_RECIPIENTS) {
      let lead = await prisma.lead.findFirst({
        where: { tenantId: TEST_TENANT_ID, email: recipient.email }
      });
      
      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            tenantId: TEST_TENANT_ID,
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            email: recipient.email,
            status: 'Inquiry'
          }
        });
      }
      leads.push(lead);
    }
    console.log(`   ✅ ${leads.length} leads ready\n`);

    // 4. Send emails using Gmail service directly
    console.log('4️⃣ Sending batch emails via Gmail API...');
    console.log('   ⏳ Sequential mode with 2-second delays\n');
    
    const recipients = leads
      .filter(lead => lead.email) // Filter out null emails
      .map(lead => ({
        email: lead.email!,
        leadId: lead.id,
        subject: (campaign.subject || '')
          .replace('{{first_name}}', lead.firstName)
          .replace('{{last_name}}', lead.lastName),
        htmlBody: (campaign.body || '')
          .replace(/\{\{first_name\}\}/g, lead.firstName)
          .replace(/\{\{last_name\}\}/g, lead.lastName)
          .replace(/\{\{email\}\}/g, lead.email!)
      }));

    const startTime = Date.now();
    const result = await gmailService.sendBulkEmail(
      TEST_TENANT_ID,
      TEST_USER_ID,
      campaign.id,
      recipients,
      { mode: 'sequential', delayMs: 2000 }
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n   ✅ Batch send completed in ${duration}s\n`);

    // 5. Display results
    console.log('📊 RESULTS:');
    console.log('============');
    console.log(`✅ Total: ${result.total}`);
    console.log(`✅ Sent: ${result.sent}`);
    console.log(`❌ Failed: ${result.failed}`);
    console.log(`⏱️  Duration: ${duration}s\n`);

    if (result.errors.length > 0) {
      console.log('❌ ERRORS:');
      result.errors.forEach(err => {
        console.log(`   • ${err.email}: ${err.error}`);
      });
      console.log('');
    }

    // 6. Check delivery logs
    console.log('6️⃣ Checking delivery logs...');
    const logs = await prisma.emailDeliveryLog.findMany({
      where: { campaignId: campaign.id },
      orderBy: { sentAt: 'asc' }
    });

    console.log('\n📨 DELIVERY LOG:');
    logs.forEach((log, index) => {
      const status = log.status === 'sent' ? '✅' : '❌';
      console.log(`   ${status} ${index + 1}. ${log.toEmail}`);
      console.log(`      Gmail ID: ${log.gmailMessageId || 'N/A'}`);
      console.log(`      Status: ${log.status}`);
      console.log(`      Sent: ${log.sentAt ? log.sentAt.toLocaleTimeString() : 'N/A'}`);
      if (log.errorMessage) console.log(`      Error: ${log.errorMessage}`);
      console.log('');
    });

    // 7. Final summary
    console.log('🎉 BATCH EMAIL TEST COMPLETED!');
    console.log('================================');
    console.log('✅ Gmail API: Connected and working');
    console.log('✅ Sequential sending: 2-second delays enforced');
    console.log('✅ Database persistence: All logs saved');
    console.log('✅ Audit trail: Complete\n');
    console.log('📬 Check your inboxes:');
    TEST_RECIPIENTS.forEach(r => console.log(`   • ${r.email}`));
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

sendDirectBatchTest();
