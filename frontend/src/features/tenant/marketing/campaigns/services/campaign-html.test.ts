import { expect, it } from 'vitest';
import { campaignPreviewDocument, prepareCampaignBody } from './campaign-html';
import { ACCENT_COLORS } from '@/lib/accent-colors';
import { THEME_PALETTES } from '@/lib/appearance-config';

it.each(['light', 'dark', 'classic'] as const)('themes the %s preview without modifying outgoing content or images', theme => {
  const body = '<p>Hello {{firstName}}</p><img src="https://example.test/logo.png" alt="Current logo"><a href="https://example.test">Details</a><table><tr><td>Value</td></tr></table>';
  const sent = prepareCampaignBody(body);
  for (const accent of ['blue', 'purple', 'orange']) {
    const preview = campaignPreviewDocument(body, { firstName: 'Sam' }, theme, accent);
    expect(preview).toContain(`background:${THEME_PALETTES[theme].card}`);
    expect(preview).toContain(ACCENT_COLORS.find(color => color.id === accent)!.primary);
    expect(preview).toContain('Hello Sam'); expect(preview).toContain('<img src="https://example.test/logo.png" alt="Current logo">');
    expect(prepareCampaignBody(body)).toBe(sent); expect(sent).toContain('{{firstName}}');
    expect(preview).not.toContain('<script');
  }
});
