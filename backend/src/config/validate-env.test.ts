import { expect, it } from 'vitest';
import { validateEnvironment } from './validate-env';

const production = {
  NODE_ENV: 'production', DATABASE_URL: 'postgresql://example.invalid/db', JWT_SECRET: 'test-only',
  BREVO_API_KEY: 'xkeysib-test-only-placeholder', BREVO_FROM_EMAIL: 'sender@example.com',
  APP_URL: 'https://app.example.com', ALLOWED_ORIGINS: 'https://app.example.com',
};
it('allows core configuration without optional integration credentials', () => {
  expect(() => validateEnvironment(production)).not.toThrow();
});
it.each(['DATABASE_URL', 'JWT_SECRET', 'BREVO_API_KEY', 'BREVO_FROM_EMAIL', 'APP_URL', 'ALLOWED_ORIGINS'])('rejects missing production %s', key => {
  expect(() => validateEnvironment({ ...production, [key]: '' })).toThrow(key);
});
it.each(['*', 'http://localhost:3000', 'https://app.example.com/login', 'https://app.example.com,'])('rejects invalid production origins', ALLOWED_ORIGINS => {
  expect(() => validateEnvironment({ ...production, ALLOWED_ORIGINS })).toThrow('ALLOWED_ORIGINS');
});
it('allows local URLs and optional email during development', () => {
  expect(() => validateEnvironment({ NODE_ENV: 'development', DATABASE_URL: 'test', JWT_SECRET: 'test', APP_URL: 'http://localhost:3000' })).not.toThrow();
});
