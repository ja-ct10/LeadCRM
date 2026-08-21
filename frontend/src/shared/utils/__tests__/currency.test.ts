import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  getTenantCurrency,
  formatCurrency,
  CURRENCY_MAP,
  DEFAULT_CURRENCY,
} from '../currency';
import type { CurrencyConfig } from '../currency';

/**
 * Property-based tests for the currency formatting utility.
 *
 * Property 12: Currency Format Consistency
 * For any tenant currency configuration (or absence thereof), the
 * `formatCurrency` utility SHALL use the tenant's configured symbol.
 * When no configuration exists, it SHALL fall back to ₱ (Philippine Peso).
 *
 * **Validates: Requirements 15.2, 15.3**
 */

describe('Feature: deals-module-modernization, Property 12: Currency Format Consistency', () => {
  const knownCurrencyCodes = Object.keys(CURRENCY_MAP);

  describe('getTenantCurrency — PHP fallback', () => {
    it('returns PHP/₱ when tenant is null', () => {
      fc.assert(
        fc.property(fc.constant(null), (tenant) => {
          const result = getTenantCurrency(tenant);
          expect(result.code).toBe('PHP');
          expect(result.symbol).toBe('₱');
        }),
        { numRuns: 100 },
      );
    });

    it('returns PHP/₱ when tenant.currency is undefined', () => {
      fc.assert(
        fc.property(fc.constant({ currency: undefined }), (tenant) => {
          const result = getTenantCurrency(tenant);
          expect(result.code).toBe('PHP');
          expect(result.symbol).toBe('₱');
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('getTenantCurrency — known currency codes', () => {
    it('returns correct symbol for every key in CURRENCY_MAP', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...knownCurrencyCodes),
          (currencyCode) => {
            const result = getTenantCurrency({ currency: currencyCode });
            expect(result.code).toBe(currencyCode);
            expect(result.symbol).toBe(CURRENCY_MAP[currencyCode]);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('getTenantCurrency — unknown currency codes', () => {
    it('uses the code itself as symbol for unknown currencies', () => {
      // Generate uppercase 3-letter strings that are NOT in CURRENCY_MAP
      const upperChar = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
      const unknownCurrencyArb = fc
        .tuple(upperChar, upperChar, upperChar)
        .map(([a, b, c]) => `${a}${b}${c}`)
        .filter((code) => !(code in CURRENCY_MAP));

      fc.assert(
        fc.property(unknownCurrencyArb, (unknownCode) => {
          const result = getTenantCurrency({ currency: unknownCode });
          expect(result.code).toBe(unknownCode);
          expect(result.symbol).toBe(unknownCode);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('formatCurrency — symbol prefix', () => {
    it('starts with the configured symbol for any known currency', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 999_999_999_999, noNaN: true }),
          fc.constantFrom(...knownCurrencyCodes),
          (value, currencyCode) => {
            const config: CurrencyConfig = {
              code: currencyCode,
              symbol: CURRENCY_MAP[currencyCode],
            };
            const formatted = formatCurrency(value, config);
            expect(formatted.startsWith(config.symbol)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('uses ₱ by default when no config is provided', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 999_999_999_999, noNaN: true }),
          (value) => {
            const formatted = formatCurrency(value);
            expect(formatted.startsWith(DEFAULT_CURRENCY.symbol)).toBe(true);
            expect(formatted.startsWith('₱')).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
