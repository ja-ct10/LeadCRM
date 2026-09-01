import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Preservation Tests — Backend loginUser guards
 *
 * **Property 4: Preservation — Non-Buggy Auth Scenarios Are Unchanged**
 *
 * These tests observe and lock in the CURRENT (unfixed) backend guard behavior
 * for scenarios where `isBugCondition(X)` is false. The auth-login-blank-screen
 * fix widens the login response shape but MUST NOT change these guards:
 *   - Invalid credentials (wrong password / unknown email / OAuth-only) -> 401
 *   - Genuinely unverified user -> 403
 *   - Inactive (non-ACTIVE) user -> 403
 *
 * **Validates: Requirements 3.1, 3.3**
 *
 * EXPECTED ON UNFIXED CODE: These tests PASS (they confirm baseline behavior
 * that must be preserved after the fix).
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

// Mock prisma before importing the service.
vi.mock('../../../config/database.config', () => {
  return {
    default: {
      user: {
        findFirst: vi.fn(),
      },
    },
  };
});

// comparePassword is controllable per-test so we can exercise the
// wrong-password path; hashPassword is an inert stub.
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
import { AppError } from '../../../shared/errors/app-error';

const mockedFindFirst = vi.mocked(prisma.user.findFirst);

// ─────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────

const VALID_PASSWORD_HASH = '$2a$10$hashedpasswordvaluehashedpasswordvalue';

function makeUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'user-1',
    email: 'someone@democorp.com',
    role: 'Client Admin',
    firstName: 'Some',
    lastName: 'One',
    tenantId: 'tenant-1',
    status: 'ACTIVE',
    emailVerified: new Date('2026-01-01T00:00:00.000Z'),
    passwordHash: VALID_PASSWORD_HASH,
    ...overrides,
  };
}

/** Assert loginUser rejects with an AppError of the expected HTTP status. */
async function expectRejectsWithStatus(
  promise: Promise<unknown>,
  status: number,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((err: unknown) => {
    expect((err as AppError).statusCode).toBe(status);
  });
}

// ─────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────

describe('Feature: auth-login-blank-screen-fix, Property 4: Preservation — loginUser guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure demo-mode bypass is NOT active so the unverified guard is exercised
    // exactly as it behaves in production.
    delete process.env.DEV_OTP_BYPASS;
    delete process.env.DEMO_MODE;
  });

  // ── Example: unknown email -> 401 ─────────────────────────────────
  it('throws 401 for an unknown email (invalid credentials)', async () => {
    mockedFindFirst.mockResolvedValueOnce(null as never);
    await expectRejectsWithStatus(
      loginUser({ email: 'nobody@democorp.com', password: 'whatever' }),
      401,
    );
  });

  // ── Example: OAuth-only user (no password hash) -> 401 ────────────
  it('throws 401 for an OAuth-only user with no password hash', async () => {
    mockedFindFirst.mockResolvedValueOnce(makeUser({ passwordHash: null }) as never);
    await expectRejectsWithStatus(
      loginUser({ email: 'oauth@democorp.com', password: 'whatever' }),
      401,
    );
  });

  // ── Example: wrong password -> 401 ────────────────────────────────
  it('throws 401 when the password does not match (invalid credentials)', async () => {
    mockedFindFirst.mockResolvedValueOnce(makeUser() as never);
    comparePasswordMock.mockResolvedValueOnce(false);
    await expectRejectsWithStatus(
      loginUser({ email: 'someone@democorp.com', password: 'wrong-password' }),
      401,
    );
  });

  // ── Example: genuinely unverified user -> 403 ─────────────────────
  it('throws 403 for a genuinely unverified user', async () => {
    mockedFindFirst.mockResolvedValueOnce(
      makeUser({ emailVerified: null, status: 'PENDING' }) as never,
    );
    comparePasswordMock.mockResolvedValueOnce(true);
    await expectRejectsWithStatus(
      loginUser({ email: 'unverified@democorp.com', password: 'correct' }),
      403,
    );
  });

  // ── Example: inactive user -> 403 ─────────────────────────────────
  it('throws 403 for a verified but inactive (non-ACTIVE) user', async () => {
    mockedFindFirst.mockResolvedValueOnce(
      makeUser({ status: 'SUSPENDED' }) as never,
    );
    comparePasswordMock.mockResolvedValueOnce(true);
    await expectRejectsWithStatus(
      loginUser({ email: 'inactive@democorp.com', password: 'correct' }),
      403,
    );
  });

  // ── Property: invalid credentials always reject with 401 ──────────
  // For any (email, password) where the credentials do not authenticate,
  // loginUser rejects with a 401 — never a success, never a 403.
  it('always rejects invalid credentials with 401 (property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          scenario: fc.constantFrom<'unknown-email' | 'no-hash' | 'wrong-password'>(
            'unknown-email',
            'no-hash',
            'wrong-password',
          ),
          email: fc.emailAddress(),
          password: fc.string({ minLength: 1, maxLength: 32 }),
        }),
        async ({ scenario, email, password }) => {
          vi.clearAllMocks();
          if (scenario === 'unknown-email') {
            mockedFindFirst.mockResolvedValueOnce(null as never);
          } else if (scenario === 'no-hash') {
            mockedFindFirst.mockResolvedValueOnce(makeUser({ passwordHash: null }) as never);
          } else {
            mockedFindFirst.mockResolvedValueOnce(makeUser() as never);
            comparePasswordMock.mockResolvedValueOnce(false);
          }

          let thrown: unknown = null;
          try {
            await loginUser({ email, password });
          } catch (err) {
            thrown = err;
          }

          expect(thrown).toBeInstanceOf(AppError);
          expect((thrown as AppError).statusCode).toBe(401);
        },
      ),
      { numRuns: 20 },
    );
  });

  // ── Property: authenticated-but-blocked users always reject with 403 ─
  // For a user with correct credentials who is either unverified or inactive,
  // loginUser rejects with a 403 — the verification/status guards are unchanged.
  it('always rejects unverified or inactive users with 403 (property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          blocker: fc.constantFrom<'unverified' | 'inactive'>('unverified', 'inactive'),
          status: fc.constantFrom('PENDING', 'SUSPENDED', 'DISABLED', 'INACTIVE'),
        }),
        async ({ blocker, status }) => {
          vi.clearAllMocks();
          const overrides =
            blocker === 'unverified'
              ? { emailVerified: null, status }
              : { emailVerified: new Date('2026-01-01T00:00:00.000Z'), status: 'SUSPENDED' };
          mockedFindFirst.mockResolvedValueOnce(makeUser(overrides) as never);
          comparePasswordMock.mockResolvedValueOnce(true);

          let thrown: unknown = null;
          try {
            await loginUser({ email: 'blocked@democorp.com', password: 'correct' });
          } catch (err) {
            thrown = err;
          }

          expect(thrown).toBeInstanceOf(AppError);
          expect((thrown as AppError).statusCode).toBe(403);
        },
      ),
      { numRuns: 20 },
    );
  });
});
