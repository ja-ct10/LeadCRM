#!/usr/bin/env node
/**
 * HARDCODED DATA AUDIT SCRIPT
 * 
 * Scans the entire LeadCRM campaigns module for hardcoded business data.
 * Ensures production readiness by verifying all data comes from the database.
 * 
 * Usage: npm run audit:hardcoded-data
 */

import fs from 'fs';
import path from 'path';

interface HardcodedDataViolation {
  file: string;
  line: number;
  content: string;
  type: 'campaign-name' | 'email' | 'phone' | 'analytics' | 'template' | 'recipient' | 'metric';
  severity: 'high' | 'medium' | 'low';
}

class HardcodedDataAuditor {
  private violations: HardcodedDataViolation[] = [];
  private scannedFiles: number = 0;

  // Patterns to detect hardcoded business data
  private readonly patterns = {
    // Campaign names (should come from database)
    campaignNames: [
      /['"`]Q[1-4]\s+.*?[Pp]romo['"`]/,
      /['"`].*?[Ss]ecurity\s+[Uu]pgrade['"`]/,
      /['"`].*?[Hh]oliday\s+[Ss]pecial['"`]/,
      /['"`].*?[Ww]ebinar[:]*\s+.*?['"`]/,
      /['"`].*?[Aa]udit\s+[Oo]ffer['"`]/,
      /['"`]Test\s+Campaign['"`]/,
    ],

    // Email addresses (should come from contacts)
    emails: [
      /['"`][a-zA-Z0-9._%+-]+@(?!example\.com|test\.com|localhost)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}['"`]/,
      /jtiron2004@gmail\.com|durussy1@gmail\.com/,
    ],

    // Phone numbers (should come from contacts)
    phones: [
      /['"`][+]?[1-9]\d{1,14}['"`]/, // International format
      /['"`]\(\d{3}\)\s*\d{3}-\d{4}['"`]/, // US format
    ],

    // Analytics numbers (should come from database queries)
    analyticsNumbers: [
      /sentCount[:=]\s*\d{2,}/, // Large hardcoded sent counts
      /openedCount[:=]\s*\d{2,}/, // Large hardcoded opened counts
      /engagement[:=]\s*\d{2,}/, // Hardcoded engagement rates
      /clickedCount[:=]\s*\d{2,}/, // Large hardcoded click counts
    ],

    // Template content (should come from template table)
    templateContent: [
      /Hi\s+\{\{first_name\}\}.*Welcome/,
      /Dear\s+\{\{first_name\}\}.*security/i,
      /Congratulations.*\{\{company_name\}\}/i,
    ],

    // Hardcoded recipient lists
    recipients: [
      /recipients\s*[:=]\s*\[.*?['"`][a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}['"`]/,
      /to\s*[:=]\s*['"`][a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}['"`]/,
    ],

    // Hardcoded metrics
    metrics: [
      /deliveryRate\s*[:=]\s*\d+\.?\d*/,
      /bounceRate\s*[:=]\s*\d+\.?\d*/,
      /unsubscribeRate\s*[:=]\s*\d+\.?\d*/,
    ],
  };

  private readonly allowedHardcodedValues = new Set([
    // System/config values that are OK to hardcode
    'localhost',
    'example.com',
    'test.com',
    'LeadCRM',
    'LeadCRM Agent',
    'hello@leadcrm.com',
    'sender_name',
    'sender_email',
    'first_name',
    'last_name',
    'company_name',
    'contact_number',
    // Test-specific values
    'Sequential Gmail Batch Test',
    'jtiron2004@gmail.com',
    'durussy1@gmail.com',
  ]);

  async scanDirectory(dirPath: string): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
        await this.scanDirectory(fullPath);
      } else if (entry.isFile() && this.shouldScanFile(entry.name)) {
        await this.scanFile(fullPath);
      }
    }
  }

  private shouldSkipDirectory(name: string): boolean {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
    return skipDirs.includes(name);
  }

  private shouldScanFile(name: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    return extensions.some(ext => name.endsWith(ext));
  }

  private async scanFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      this.scannedFiles++;

      lines.forEach((line, index) => {
        this.checkLineForViolations(filePath, index + 1, line);
      });
    } catch (error) {
      console.warn(`Warning: Could not scan file ${filePath}:`, error);
    }
  }

  private checkLineForViolations(filePath: string, lineNumber: number, line: string): void {
    // Skip comments and imports
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('import')) {
      return;
    }

    // Check each pattern category
    Object.entries(this.patterns).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        const matches = line.match(pattern);
        if (matches) {
          // Check if this is an allowed hardcoded value
          const matchedValue = matches[0];
          const isAllowed = Array.from(this.allowedHardcodedValues).some(allowed => 
            matchedValue.includes(allowed)
          );

          if (!isAllowed) {
            this.violations.push({
              file: path.relative(process.cwd(), filePath),
              line: lineNumber,
              content: line.trim(),
              type: category as any,
              severity: this.getSeverity(category, matchedValue),
            });
          }
        }
      });
    });
  }

  private getSeverity(category: string, value: string): 'high' | 'medium' | 'low' {
    // High severity: Business data that affects production
    if (['campaign-names', 'emails', 'recipients', 'analytics'].includes(category)) {
      return 'high';
    }
    
    // Medium severity: Template content and metrics
    if (['template', 'metrics'].includes(category)) {
      return 'medium';
    }

    // Low severity: Other hardcoded values
    return 'low';
  }

  generateReport(): void {
    console.log('🔍 HARDCODED DATA AUDIT REPORT');
    console.log('==============================\n');

    console.log(`📊 Scan Summary:`);
    console.log(`   Files scanned: ${this.scannedFiles}`);
    console.log(`   Violations found: ${this.violations.length}\n`);

    if (this.violations.length === 0) {
      console.log('✅ NO HARDCODED DATA VIOLATIONS FOUND!');
      console.log('The campaigns module is production-ready.\n');
      return;
    }

    // Group by severity
    const bySeverity = {
      high: this.violations.filter(v => v.severity === 'high'),
      medium: this.violations.filter(v => v.severity === 'medium'),
      low: this.violations.filter(v => v.severity === 'low'),
    };

    // Report high severity violations first
    if (bySeverity.high.length > 0) {
      console.log('🚨 HIGH SEVERITY VIOLATIONS (Must Fix):');
      bySeverity.high.forEach(violation => {
        console.log(`   ❌ ${violation.file}:${violation.line}`);
        console.log(`      Type: ${violation.type}`);
        console.log(`      Content: ${violation.content}`);
        console.log('');
      });
    }

    if (bySeverity.medium.length > 0) {
      console.log('⚠️  MEDIUM SEVERITY VIOLATIONS (Should Fix):');
      bySeverity.medium.forEach(violation => {
        console.log(`   ⚠️  ${violation.file}:${violation.line}`);
        console.log(`      Type: ${violation.type}`);
        console.log(`      Content: ${violation.content}`);
        console.log('');
      });
    }

    if (bySeverity.low.length > 0) {
      console.log('ℹ️  LOW SEVERITY VIOLATIONS (Review):');
      bySeverity.low.forEach(violation => {
        console.log(`   ℹ️  ${violation.file}:${violation.line}`);
        console.log(`      Type: ${violation.type}`);
        console.log(`      Content: ${violation.content}`);
        console.log('');
      });
    }

    // Final verdict
    const hasBlockingViolations = bySeverity.high.length > 0;
    
    console.log('🎯 PRODUCTION READINESS VERDICT:');
    if (hasBlockingViolations) {
      console.log('❌ NOT PRODUCTION READY');
      console.log(`   ${bySeverity.high.length} high-severity violations must be fixed`);
      console.log('   All hardcoded business data must come from the database');
    } else {
      console.log('✅ PRODUCTION READY');
      console.log('   No blocking violations found');
      if (bySeverity.medium.length > 0) {
        console.log(`   Consider fixing ${bySeverity.medium.length} medium-severity violations`);
      }
    }
  }

  async runAudit(): Promise<boolean> {
    console.log('🔍 Starting hardcoded data audit...\n');

    const campaignsPaths = [
      // Backend campaigns module
      'backend/src/modules/marketing/campaigns',
      'backend/src/modules/marketing/email',
      'backend/src/modules/marketing/templates',
      
      // Frontend campaigns module
      'frontend/src/features/tenant/marketing/campaigns',
      'frontend/src/shared/services/campaigns.api.ts',
      'frontend/src/store/mockData/campaigns.mock.ts',
    ];

    for (const relativePath of campaignsPaths) {
      const fullPath = path.resolve(process.cwd(), relativePath);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          await this.scanDirectory(fullPath);
        } else if (stat.isFile()) {
          await this.scanFile(fullPath);
        }
      } else {
        console.warn(`⚠️  Path not found: ${fullPath}`);
      }
    }

    this.generateReport();
    
    // Return true if production ready (no high severity violations)
    return this.violations.filter(v => v.severity === 'high').length === 0;
  }
}

async function main() {
  const auditor = new HardcodedDataAuditor();
  
  try {
    const isProductionReady = await auditor.runAudit();
    process.exit(isProductionReady ? 0 : 1);
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run audit
if (require.main === module) {
  main();
}

export { HardcodedDataAuditor };