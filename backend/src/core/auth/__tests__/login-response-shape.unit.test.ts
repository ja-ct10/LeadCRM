import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit Tests — Aligned auth user response shape + unchanged login guards
 *
 * Task 3.5 (auth-login-blank-screen-fix):
 *   1. `loginUser` returns the aligned `user` shape (includes `emailVerified`,
 *      `onboardingStep`, `onboardingCompletedAt`, `tenantName`) for a verified,
 *      onboarded user — and never leaks `passwordHash`.
 *   2. `login` (controller) and `me` (controller) produce identical `user`
 *      shapes via the shared `buildAuthUserResponse` helper.
 *   3. `loginUser` still throws 401 for invalid credentials and 403 for
 *      unverified / inactive users (guards unchanged).
 *
 * **Validates: Requirements 2.1, 2.4, 3.1, 3.3**
 *
 * EXPECTED OUTCOME (fixed code): all tests PASS.
 */

// ─────────────────────────────────────────────────────
// MOCKS  (mirror login-guards.preservation.test.ts)
// ─────────────────────────────────────────────────────

// Mock prisma before importing the service/controller.
vi.mock('../../../config/database.config', () => {
  return {
    default: {
      user: {
        findFirst: vi.fn(),
      },
    },
  };
});

// comparePassword is controllable per-test; hashPassword is an inert stub.
const comparePasswordMock = vi.fn();
vi.mock('../../../shared/helpers/crypto', () => ({
  comparePassword: (...args: unknown[]) => comparePasswordMock(...args),
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

vi.mock('../jwt.service', () => ({
  signToken: vi.fn().mockReturnValue('signed.jwt.token'),
}));

vi.mock('../session.service', () => ({
  createSession: vi.fn().mockResolvedValue(undefined),
  revokeSession: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking.
import prisma from '../../../config/database.config';
import { loginUser } from '../auth.service';
import { login, me } from '../auth.controller';
import { AppError } from '../../../shared/errors/app-error';

const mockedFindFirst = vi.mocked(prisma.user.findFirst);

// ─────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────

const VALID_PASSWORD_HASH = '$2a$10$hashedpasswordvaluehashedpasswordvalue';

/**
 * A single verified, onboarded user + flattened tenant relation, matching the
 * `include`/`select` used by both `loginUser` and `me`.
 */
function makeVerifiedOnboardedUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'user-1',
    email: 'alice@democorp.com',
    role: 'Client Admin',
    firstName: 'Alice',
    lastName: 'Admin',
    tenantId: 'tenant-1',
    status: 'ACTIVE',
    emailVerified: new Date('2026-01-01T00:00:00.000Z'),
    passwordHash: VALID_PASSWORD_HASH,
    tenant: {
      name: 'Demo Corp Solutions',
      industry: 'IT Services',
      companySize: '11-50',
      onboardingStep: 3,
      onboardingCompletedAt: new Date('2026-01-02T00:00:00.000Z'),
    },
    ...overrides,
  };
}

/** The exact set of fields the aligned auth user response exposes. */
const EXPECTED_USER_KEYS = [
  'id',
  'email',
  'role',
  'firstName',
  'lastName',
  'tenantId',
  'status',
  'emailVerified',
  'tenantName',
  'industry',
  'companySize',
  'onboardingStep',
  'onboardingCompletedAt',
].sort();

/** Invoke the `login` controller handler and capture the response `user` object. */
async function callLoginController(): Promise<Record<string, unknown>> {
  mockedFindFirst.mockResolvedValueOnce(makeVerifiedOnboardedUser() as never);
  comparePasswordMock.mockResolvedValueOnce(true);

  let captured: Record<string, unknown> | null = null;
  const req = {
    body: { email: 'alice@democorp.com', password: 'pw' },
    headers: {},
    ip: '127.0.0.1',
  } as never;
  const res = {
    cookie: () => res,
    json: (body: { data?: { user?: Record<string, unknown> } }) => {
      captured = body?.data?.user ?? null;
    },
    status: () => res,
  } as never;
  const next = (err: unknown) => { if (err) throw err; };

  await login(req, res, next as never);
  if (!captured) throw new Error('login() did not return a user');
  return captured;
}

/** Invoke the `me` controller handler and capture the response `user` object. */
async function callMeController(): Promise<Record<string, unknown>> {
  mockedFindFirst.mockResolvedValueOnce(makeVerifiedOnboardedUser() as never);

  let captured: Record<string, unknown> | null = null;
  const req = { user: { userId: 'user-1', tenantId: 'tenant-1' } } as never;
  const res = {
    json: (body: { data?: { user?: Record<string, unknown> } }) => {
      captured = body?.data?.user ?? null;
    },
    status: () => res,
  } as never;
  const next = (err: unknown) => { if (err) throw err; };

  await me(req, res, next as never);
  if (!captured) throw new Error('me() did not return a user');
  return captured;
}

/** Assert loginUser rejects with an AppError of the expected HTTP status. */
async function expectRejectsWithStatus(promise: Promise<unknown>, status: number): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((err: unknown) => {
    expect((err as AppError).statusCode).toBe(status);
  });
}

// ─────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────

describe('Feature: auth-login-blank-screen-fix, Task 3.5: aligned auth user shape + unchanged guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure the demo-mode bypass is NOT active so the unverified guard behaves
    // exactly as it does in production.
    delete process.env.DEV_OTP_BYPASS;
    delete process.env.DEMO_MODE;
  });

  // ── 1. loginUser returns the aligned user shape ──────────────────
  describe('loginUser returns the aligned user shape (Requirements 2.1, 2.4)', () => {
    it('exposes exactly the canonical auth user fields for a verified, onboarded user', async () => {
      mockedFindFirst.mockResolvedValueOnce(makeVerifiedOnboardedUser() as never);
      comparePasswordMock.mockResolvedValueOnce(true);

      const result = await loginUser({ email: 'alice@democorp.com', password: 'pw' });

      expect(Object.keys(result.user).sort()).toEqual(EXPECTED_USER_KEYS);
    });

    it('includes the gate/display fields with the flattened tenant values', async () => {
      mockedFindFirst.mockResolvedValueOnce(makeVerifiedOnboardedUser() as never);
      comparePasswordMock.mockResolvedValueOnce(true);

      const { user } = await loginUser({ email: 'alice@democorp.com', password: 'pw' });

      expect(user.emailVerified).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(user.onboardingCompletedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
      expect(user.onboardingStep).toBe(3);
      expect(user.tenantName).toBe('Demo Corp Solutions');
      expect(user.industry).toBe('IT Services');
      expect(user.companySize).toBe('11-50');
    });

    it('never leaks passwordHash (or any credential field) in the returned user', async () => {
      mockedFindFirst.mockResolvedValueOnce(makeVerifiedOnboardedUser() as never);
      comparePasswordMock.mockResolvedValueOnce(true);

      const { user } = await loginUser({ email: 'alice@democorp.com', password: 'pw' });

      expect(user).not.toHaveProperty('passwordHash');
      expect(Object.keys(user)).not.toContain('passwordHash');
    });
  });

  // ── 2. login and me produce identical user shapes ────────────────
  describe('login and me produce identical user shapes via buildAuthUserResponse (Requirements 2.4, 3.1)', () => {
    it('login and me user objects have identical key sets', async () => {
      const loginShape = await callLoginController();
      const meShape = await callMeController();

      expect(Object.keys(loginShape).sort()).toEqual(Object.keys(meShape).sort());
    });

    it('login and me user objects are deeply equal for the same user', async () => {
      const loginShape = await callLoginController();
      const meShape = await callMeController();

      expect(loginShape).toEqual(meShape);
    });

    it('neither the login nor the me payload includes passwordHash', async () => {
      const loginShape = await callLoginController();
      const meShape = await callMeController();

      expect(loginShape).not.toHaveProperty('passwordHash');
      expect(meShape).not.toHaveProperty('passwordHash');
    });
  });

  // ── 3. Guards unchanged: 401 invalid, 403 unverified/inactive ────
  describe('loginUser guards are unchanged (Requirements 3.1, 3.3)', () => {
    it('throws 401 for an unknown email (invalid credentials)', async () => {
      mockedFindFirst.mockResolvedValueOnce(null as never);
      await expectRejectsWithStatus(
        loginUser({ email: 'nobody@democorp.com', password: 'whatever' }),
        401,
      );
    });

    it('throws 401 for an OAuth-only user with no password hash', async () => {
      mockedFindFirst.mockResolvedValueOnce(
        makeVerifiedOnboardedUser({ passwordHash: null }) as never,
      );
      await expectRejectsWithStatus(
        loginUser({ email: 'oauth@democorp.com', password: 'whatever' }),
        401,
      );
    });

    it('throws 401 when the password does not match', async () => {
      mockedFindFirst.mockResolvedValueOnce(makeVerifiedOnboardedUser() as never);
      comparePasswordMock.mockResolvedValueOnce(false);
      await expectRejectsWithStatus(
        loginUser({ email: 'alice@democorp.com', password: 'wrong-password' }),
        401,
      );
    });

    it('throws 403 for a genuinely unverified user', async () => {
      mockedFindFirst.mockResolvedValueOnce(
        makeVerifiedOnboardedUser({ emailVerified: null, status: 'PENDING' }) as never,
      );
      comparePasswordMock.mockResolvedValueOnce(true);
      await expectRejectsWithStatus(
        loginUser({ email: 'unverified@democorp.com', password: 'correct' }),
        403,
      );
    });

    it('throws 403 for a verified but inactive (non-ACTIVE) user', async () => {
      mockedFindFirst.mockResolvedValueOnce(
        makeVerifiedOnboardedUser({ status: 'SUSPENDED' }) as never,
      );
      comparePasswordMock.mockResolvedValueOnce(true);
      await expectRejectsWithStatus(
        loginUser({ email: 'inactive@democorp.com', password: 'correct' }),
        403,
      );
    });
  });
});
