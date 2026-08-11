'use client';

import React from 'react';
import { FileText, ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <button
            onClick={() => onNavigate?.('/')}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Terms of Service</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last updated: January 10, 2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-8 md:p-12">
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="lead">
              Please read these Terms of Service carefully before using LeadCRM. By accessing or using our service, 
              you agree to be bound by these terms.
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>
              By creating an account and using LeadCRM ("Service"), you agree to these Terms of Service ("Terms"). 
              If you do not agree to these Terms, you may not access or use the Service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              LeadCRM provides a cloud-based customer relationship management (CRM) platform designed for IT solutions providers, 
              security firms, and telecom agencies. Our Service includes lead management, pipeline tracking, automation tools, 
              reporting, and related features.
            </p>

            <h2>3. Account Registration and Security</h2>
            <h3>3.1 Account Creation</h3>
            <p>
              To use the Service, you must create an account by providing accurate and complete information. 
              You are responsible for maintaining the confidentiality of your account credentials.
            </p>
            <h3>3.2 Account Responsibilities</h3>
            <p>
              You are responsible for all activities that occur under your account. You must immediately notify us of 
              any unauthorized use of your account or any other breach of security.
            </p>
            <h3>3.3 Account Requirements</h3>
            <ul>
              <li>You must be at least 18 years old to use the Service</li>
              <li>You must provide accurate and truthful information</li>
              <li>You must not share your account with others</li>
              <li>You must maintain the security of your password</li>
            </ul>

            <h2>4. Subscription Plans and Billing</h2>
            <h3>4.1 Subscription Tiers</h3>
            <p>
              We offer multiple subscription plans (Starter, Professional, Enterprise) with different features and pricing. 
              You can choose monthly, quarterly, or annual billing cycles.
            </p>
            <h3>4.2 Payment</h3>
            <p>
              Subscription fees are billed in advance on a recurring basis. You authorize us to charge your payment method 
              for all fees incurred. All fees are non-refundable except as required by law.
            </p>
            <h3>4.3 Free Trial</h3>
            <p>
              We offer a 14-day free trial with no credit card required. At the end of the trial period, you must choose 
              a paid plan to continue using the Service.
            </p>
            <h3>4.4 Plan Changes</h3>
            <p>
              You may upgrade or downgrade your subscription at any time. Changes take effect immediately for upgrades 
              or at the next billing cycle for downgrades.
            </p>
            <h3>4.5 Cancellation</h3>
            <p>
              You may cancel your subscription at any time. Cancellation takes effect at the end of your current billing period. 
              No refunds will be provided for partial months or unused portions of your subscription.
            </p>

            <h2>5. Acceptable Use Policy</h2>
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights of others</li>
              <li>Transmit viruses, malware, or other harmful code</li>
              <li>Engage in fraudulent or deceptive practices</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Resell or redistribute the Service without authorization</li>
              <li>Send spam or unsolicited communications</li>
            </ul>

            <h2>6. Data Ownership and Usage</h2>
            <h3>6.1 Your Data</h3>
            <p>
              You retain all rights to the data you input into the Service ("Customer Data"). We do not claim ownership 
              of your Customer Data and will only use it to provide the Service to you.
            </p>
            <h3>6.2 License to Us</h3>
            <p>
              You grant us a limited license to host, store, process, and display your Customer Data solely for the purpose 
              of providing the Service to you.
            </p>
            <h3>6.3 Data Backup</h3>
            <p>
              While we perform regular backups, you are responsible for maintaining your own backup copies of Customer Data. 
              We are not liable for data loss except as required by law.
            </p>

            <h2>7. Intellectual Property Rights</h2>
            <h3>7.1 Our Property</h3>
            <p>
              The Service, including all software, designs, text, graphics, and other content, is owned by LeadCRM and 
              protected by intellectual property laws.
            </p>
            <h3>7.2 Limited License</h3>
            <p>
              We grant you a limited, non-exclusive, non-transferable license to access and use the Service during your 
              subscription period, subject to these Terms.
            </p>
            <h3>7.3 Feedback</h3>
            <p>
              If you provide feedback or suggestions about the Service, we may use that feedback without obligation to you.
            </p>

            <h2>8. Service Level and Availability</h2>
            <h3>8.1 Uptime</h3>
            <p>
              We strive to maintain 99.9% uptime for our Service. However, we do not guarantee uninterrupted access and may 
              perform maintenance that temporarily affects availability.
            </p>
            <h3>8.2 Support</h3>
            <p>
              Support is provided via email and in-app messaging. Response times vary by subscription plan. 
              Professional and Enterprise plans receive priority support.
            </p>

            <h2>9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, LEADCRM SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, 
              OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
            <p>
              OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATING TO THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU 
              PAID US IN THE TWELVE (12) MONTHS BEFORE THE CLAIM AROSE.
            </p>

            <h2>10. Warranties and Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, 
              INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p>
              WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT ANY DEFECTS WILL BE CORRECTED.
            </p>

            <h2>11. Indemnification</h2>
            <p>
              You agree to indemnify and hold LeadCRM harmless from any claims, damages, losses, liabilities, and expenses 
              (including legal fees) arising from your use of the Service, your violation of these Terms, or your violation 
              of any rights of another party.
            </p>

            <h2>12. Termination</h2>
            <h3>12.1 Termination by You</h3>
            <p>
              You may terminate your account at any time by canceling your subscription through your account settings or 
              contacting our support team.
            </p>
            <h3>12.2 Termination by Us</h3>
            <p>
              We may suspend or terminate your account if you violate these Terms, engage in fraudulent activity, or for 
              any other reason at our sole discretion. We will provide notice when reasonably possible.
            </p>
            <h3>12.3 Effect of Termination</h3>
            <p>
              Upon termination, your right to use the Service immediately ceases. We will retain your data for a reasonable 
              period to allow you to retrieve it, after which it may be permanently deleted.
            </p>

            <h2>13. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of material changes via email or 
              through the Service. Your continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>

            <h2>14. Governing Law and Dispute Resolution</h2>
            <h3>14.1 Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines, 
              without regard to its conflict of law provisions.
            </p>
            <h3>14.2 Dispute Resolution</h3>
            <p>
              Any disputes arising from these Terms or the Service shall first be attempted to be resolved through good faith 
              negotiations. If negotiations fail, disputes shall be submitted to binding arbitration in Manila, Philippines.
            </p>

            <h2>15. General Provisions</h2>
            <h3>15.1 Entire Agreement</h3>
            <p>
              These Terms constitute the entire agreement between you and LeadCRM regarding the Service and supersede all 
              prior agreements.
            </p>
            <h3>15.2 Severability</h3>
            <p>
              If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will remain 
              in full force and effect.
            </p>
            <h3>15.3 Waiver</h3>
            <p>
              Our failure to enforce any right or provision of these Terms will not be deemed a waiver of such right or provision.
            </p>
            <h3>15.4 Assignment</h3>
            <p>
              You may not assign or transfer these Terms without our written consent. We may assign our rights and obligations 
              without restriction.
            </p>

            <h2>16. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <ul>
              <li>Email: legal@leadcrm.com</li>
              <li>Address: Manila, Philippines</li>
              <li>Phone: +63 (02) 8888 8888</li>
            </ul>

            <h2>17. Acknowledgment</h2>
            <p>
              BY USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF SERVICE, UNDERSTAND THEM, AND AGREE 
              TO BE BOUND BY THEM.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
