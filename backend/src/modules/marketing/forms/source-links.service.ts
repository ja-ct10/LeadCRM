import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { BUSINESS_INQUIRY_EMAIL, BUSINESS_INQUIRY_MAILTO, SOURCE_LINK_PRESETS, sourceCampaignLink } from '@leadcrm/shared';
import prisma from '../../../config/database.config';
import { NotFoundError, ValidationError } from '../../../shared/errors/http-error';

export async function formSourceLinks(tenantId: string, id: string, origin: string, campaign = '') {
  const form = await prisma.marketingForm.findFirst({ where: { tenantId, id, isArchived: false } });
  if (!form) throw new NotFoundError('Form');
  if (form.status !== 'published' || !form.publishedVersion) throw new ValidationError('Publish this form before sharing source links.');
  const config = form.publishedConfig as { settings?: { trackUrlParams?: boolean } };
  if (config.settings?.trackUrlParams === false) throw new ValidationError('Enable Track URL Parameters and publish the form before sharing source links.');
  const url = new URL(origin);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new ValidationError('Configure the public Forms origin.');
  const base = `${url.origin}/forms/${encodeURIComponent(form.publicId)}`;
  const rows: Array<{ category: string; source: string; medium: string; link: string; mode: string; qr: string }> = await Promise.all(SOURCE_LINK_PRESETS.map(async row => {
    const link = sourceCampaignLink(base, row.source, row.medium, campaign);
    return { ...row, link, mode: 'Automatic after form submission', qr: await QRCode.toDataURL(link, { width: 240, margin: 4, errorCorrectionLevel: 'M' }) };
  }));
  rows.push({ category: 'Direct Email', source: BUSINESS_INQUIRY_EMAIL, medium: 'email', link: BUSINESS_INQUIRY_MAILTO, mode: 'Email capture, then staff review', qr: await QRCode.toDataURL(BUSINESS_INQUIRY_MAILTO, { width: 240, margin: 4, errorCorrectionLevel: 'M' }) });
  return { formName: form.name, formId: form.id, publicId: form.publicId, campaign, base, rows };
}
export function sourceLinksPdf(manifest: Awaited<ReturnType<typeof formSourceLinks>>, notice?: string) {
  const doc = new PDFDocument({ size: 'A4', margin: 36, info: { Title: 'LeadCRM source links - ' + manifest.formName } });
  const width = 523, heights = 108;
  const header = () => {
    doc.font('Helvetica-Bold').fontSize(19).fillColor('#142b45').text('Lead source links');
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(manifest.formName + (manifest.campaign ? ' | Campaign: ' + manifest.campaign : ''));
    if (notice) doc.moveDown(0.4).fontSize(8).fillColor('#475569').text(notice, { width: 523 });
    if (['localhost', '127.0.0.1'].includes(new URL(manifest.base).hostname)) doc.font('Helvetica-Bold').fontSize(9).fillColor('#a04010').text('LOCAL PREVIEW - these form links work only while this local demo is running.');
    doc.moveDown(0.6).fontSize(8).text('Use the link or scan the QR code, then submit the form. URL tags identify the source; they do not verify ad-platform delivery.');
    doc.moveDown(0.8);
    const y = doc.y;
    doc.rect(36, y, width, 24).fill('#142b45');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9).text('Source category', 44, y + 8).text('Link / capture', 177, y + 8).text('QR', 480, y + 8);
    return y + 24;
  };
  let y = header();
  for (const row of manifest.rows) {
    if (y + heights > 777) { doc.addPage(); y = header(); }
    doc.rect(36, y, width, heights).lineWidth(0.4).strokeColor('#cbd5e1').stroke();
    doc.fillColor('#142b45').font('Helvetica-Bold').fontSize(10).text(row.category, 44, y + 12, { width: 121 });
    doc.font('Helvetica').fontSize(8).fillColor('#475569').text(row.source, 44, y + 45, { width: 120 });
    doc.fillColor('#1754a8').text(row.link, 177, y + 10, { width: 275, link: row.link, underline: true });
    doc.fillColor('#475569').fontSize(8).text(row.mode, 177, y + 80, { width: 270 });
    doc.image(Buffer.from(row.qr.split(',')[1], 'base64'), 465, y + 14, { width: 86 });
    y += heights;
  }
  if (y + 95 > 777) { doc.addPage(); y = header(); }
  doc.fillColor('#142b45').font('Helvetica-Bold').fontSize(10).text('Others - Call / SMS', 44, y + 15);
  doc.font('Helvetica').fontSize(9).fillColor('#475569').text('Staff create the Lead manually, choose Others, and enter Call or SMS as the source detail. No public phone link is required.', 44, y + 33, { width: 500 });
  doc.fontSize(8).text('Direct Email: the mail link opens an email application. Send the message; the connected mailbox captures it for staff review. Opening or scanning a link alone creates no Lead.', 44, y + 65, { width: 500 });
  return doc;
}
