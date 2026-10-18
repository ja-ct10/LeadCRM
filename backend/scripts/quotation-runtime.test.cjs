const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');

const dist = resolve(__dirname, '../dist');

test('the built renderer finds licensed Unicode fonts from any working directory', () => {
  for (const filename of ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'LICENSE']) {
    assert.ok(existsSync(resolve(dist, 'backend/assets/fonts', filename)), `Missing production PDF asset: ${filename}. Run the backend build.`);
  }
  assert.match(readFileSync(resolve(dist, 'backend/assets/fonts/LICENSE'), 'utf8'), /SIL OPEN FONT LICENSE/);
  const script = `
    const path = require('node:path'), Module = require('node:module');
    const dist = process.argv[1], original = Module._resolveFilename;
    Module._resolveFilename = function(request, parent, isMain, options) {
      return request === '@leadcrm/shared' ? path.join(dist, 'shared/src/index.js') : original.call(this, request, parent, isMain, options);
    };
    const { renderQuotationPdf } = require(path.join(dist, 'backend/src/modules/marketing/campaigns/quotation-pdf.js'));
    const quotation = { quotationTitle: 'QUOTATION', header: 'Camxian test organization', introduction: 'Dear {{firstName}},', footer: 'Terms {{validUntil}}', notes: '',
      number: '{{quotationNumber}}', date: '', validUntil: '', recipient: { name: '{{fullName}}', companyName: '{{companyName}}', email: '{{email}}', address: '' },
      products: [{ name: 'Service', description: 'Installation', quantity: 3, unitPrice: '1234.56', total: '3703.68' }], total: '3703.68' };
    renderQuotationPdf(quotation).then(bytes => process.stdout.write(bytes)).catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const pdf = execFileSync(process.execPath, ['-e', script, dist], { cwd: tmpdir(), env: { ...process.env, NODE_ENV: 'production' } });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 5000);
  assert.match(pdf.toString('latin1'), /NotoSans/);
  assert.match(pdf.toString('latin1'), /%%EOF/);
});

test('the built tenant seed CLI fails before connecting when its explicit scope is missing', () => {
  const result = spawnSync(process.execPath, [resolve(dist, 'start.js'), '--seed-campaign-templates'], {
    cwd: tmpdir(), encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://invalid/unused' }, timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Specify the confirmed workspace ID/);
  assert.doesNotMatch(result.stderr, /MODULE_NOT_FOUND|Cannot find module|ENOENT/);
});
