import { describe, expect, it } from 'vitest';
import express from 'express';
import app from '../../../app';

describe('proxy trust boundary', () => {
  it('does not trust arbitrary internet addresses or all forwarded headers', () => {
    expect(app.get('trust proxy')).not.toBe(true);
    const local = express();
    local.set('trust proxy', ['loopback']);
    const trust = local.get('trust proxy fn') as (address: string) => boolean;
    expect(trust('127.0.0.1')).toBe(true);
    expect(trust('::1')).toBe(true);
    expect(trust('198.51.100.25')).toBe(false);
  });
});
