'use client';

import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
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
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last updated: January 10, 2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-8 md:p-12">
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <h2>1. Information We Collect</h2>
            <p>
              We collect information that you provide directly to us, including when you create an account, use our services, 
              communicate with us, or participate in surveys or promotions.
            </p>
            <h3>1.1 Account Information</h3>
            <p>
              When you create a LeadCRM account, we collect your name, email address, company name, phone number, and password.
            </p>
            <h3>1.2 Usage Information</h3>
            <p>
              We automatically collect information about how you interact with our services, including features used, 
              actions taken, time and frequency of use, and device information.
            </p>
            <h3>1.3 Customer Data</h3>
            <p>
              As part of our CRM services, you may input customer information, contact records, deal data, and other business information. 
              This data remains your property and is processed according to your instructions.
            </p>

            <h2>2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send technical notices, updates, security alerts, and support messages</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Communicate with you about products, services, offers, and events</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, prevent, and address technical issues and fraudulent activity</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>3. Information Sharing and Disclosure</h2>
            <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
            <h3>3.1 Service Providers</h3>
            <p>
              We may share information with third-party service providers who perform services on our behalf, such as 
              hosting, data analysis, payment processing, and customer service.
            </p>
            <h3>3.2 Legal Requirements</h3>
            <p>
              We may disclose information if required by law, legal process, or government request, or when we believe 
              disclosure is necessary to protect our rights, your safety, or the safety of others.
            </p>
            <h3>3.3 Business Transfers</h3>
            <p>
              If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.
            </p>

            <h2>4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your information against unauthorized access, 
              alteration, disclosure, or destruction. These measures include:
            </p>
            <ul>
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Employee training on data protection</li>
              <li>Regular backups and disaster recovery procedures</li>
            </ul>

            <h2>5. Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to provide you services. 
              We will retain and use your information as necessary to comply with legal obligations, resolve disputes, 
              and enforce our agreements.
            </p>

            <h2>6. Your Rights and Choices</h2>
            <p>You have the following rights regarding your personal information:</p>
            <ul>
              <li><strong>Access:</strong> You can request a copy of your personal information</li>
              <li><strong>Correction:</strong> You can update or correct your information through your account settings</li>
              <li><strong>Deletion:</strong> You can request deletion of your account and associated data</li>
              <li><strong>Data Portability:</strong> You can request your data in a structured, machine-readable format</li>
              <li><strong>Opt-out:</strong> You can opt out of marketing communications at any time</li>
            </ul>

            <h2>7. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar tracking technologies to collect information about your browsing activities. 
              You can control cookies through your browser settings and our cookie preference center.
            </p>
            <h3>7.1 Necessary Cookies</h3>
            <p>Required for the website to function properly. These cannot be disabled.</p>
            <h3>7.2 Analytics Cookies</h3>
            <p>Help us understand how visitors interact with our website by collecting and reporting information anonymously.</p>

            <h2>8. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence. 
              We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
            </p>

            <h2>9. Children's Privacy</h2>
            <p>
              Our services are not directed to individuals under 18 years of age. We do not knowingly collect personal 
              information from children under 18.
            </p>

            <h2>10. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new 
              Privacy Policy on this page and updating the "Last updated" date.
            </p>

            <h2>11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <ul>
              <li>Email: privacy@leadcrm.com</li>
              <li>Address: Manila, Philippines</li>
              <li>Phone: +63 (02) 8888 8888</li>
            </ul>

            <h2>12. Data Protection Officer</h2>
            <p>
              For privacy-related inquiries or to exercise your data protection rights, you can contact our Data Protection Officer at:
              dpo@leadcrm.com
            </p>

            <h2>13. GDPR Compliance</h2>
            <p>
              If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection 
              Regulation (GDPR), including the right to lodge a complaint with a supervisory authority.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
