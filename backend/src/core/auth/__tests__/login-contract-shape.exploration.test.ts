import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Bug Condition Exploration Tests — Backend contract shape
 *
 * **Property 1: Bug Condition — Verified, Onboarded Login User Reaches the Dashboard**
 *
 * These tests encode the EXPECTED (post-fix) behavior for the backend half of the
 * defect: the `POST /auth/login` response `user` object must carry the same gate
 * fields as the `GET /auth/me` response so that `AuthGuard` routes a verified,
 * onboarded user to the dashboard.
 *
 * **Validates: Requirements 1.1, 1.4**
 *
 * EXPECTED ON UNFIXED CODE: These tests FAIL.
 *   - `loginUser` returns only { id, email, role, firstName, lastName, tenantId }
 *     — it omits `emailVerified` and `onboardingCompletedAt` (and `onboardingStep`,
 *     `tenantName`), so the login `user` shape diverges from the `/auth/me` shape.
 *
 * DO NOT fix the test or the code when it fails — the failure confirms the bug.
 */

// ─────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────

// A single verified, onboarded user + tenant used by both the login lookup
// and the /auth/me lookup so the two response shapes can be compared directly.
const VERIFIED_ONBOARDED_USER = {
  id: 'user-1',
  email: 'alice@democorp.com',
  role: 'Client Admin',
  firstName: 'Alice',
  lastName: 'Admin',
  tenantId: 'tenant-1',
  status: 'ACTIVE' as const,
  emailVerified: new Date('2026-01-01T00:00:00.000Z'),
  passwordHash: '$2a$10$hashedpasswordvaluehashedpasswordvalue',
  tenant: {
    name: 'Demo Corp Solutions',
    industry: 'IT Services',
    companySize: '11-50',
    onboardingStep: 3,
    onboardingCompletedAt: new Date('2026-01-02T00:00:00.000Z'),
  },
};

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

// Password always compares valid; token/session are side-effect stubs.
vi.mock('../../../shared/helpers/crypto', () => ({
  comparePassword: vi.fn().mockResolvedValue(true),
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
import { me } from '../auth.controller';

const mockedFindFirst = vi.mocked(prisma.user.findFirst);

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

/**
 * Invoke the `me` controller handler and capture the response `user` object.
 * The `me` handler is the canonical contract that the login response must match.
 */
async function callMe(): Promise<Record<string, unknown>> {
  mockedFindFirst.mockResolvedValueOnce(VERIFIED_ONBOARDED_USER as never);

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

/**
 * Invoke the real `loginUser` service for the verified, onboarded user and
 * capture the returned `user` object.
 */
async function callLogin(): Promise<Record<string, unknown>> {
  mockedFindFirst.mockResolvedValueOnce(VERIFIED_ONBOARDED_USER as never);
  const result = await loginUser({ email: VERIFIED_ONBOARDED_USER.email, password: 'pw' });
  return result.user as unknown as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────

describe('Feature: auth-login-blank-screen-fix, Property 1: Bug Condition — Login contract shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login response user includes emailVerified and onboardingCompletedAt (verified, onboarded user)', async () => {
    // Scoped PBT: the bug is deterministic given the scenario. We exercise the
    // concrete failing case in the isBugCondition domain
    // (enteredVia='login' AND emailVerified<>null AND onboardingCompletedAt<>null
    //  AND role<>'System Admin') across a small set of equivalent scenarios.
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('login-attempt'), async () => {
        const loginUserShape = await callLogin();

        // EXPECTED (post-fix): both gate fields present. FAILS on unfixed code.
        expect(loginUserShape).toHaveProperty('emailVerified');
        expect(loginUserShape).toHaveProperty('onboardingCompletedAt');

        // The gate fields must be non-null so AuthGuard routes to /dashboard.
        expect((loginUserShape as { emailVerified?: unknown }).emailVerified).not.toBeNull();
        expect((loginUserShape as { onboardingCompletedAt?: unknown }).onboardingCompletedAt).not.toBeNull();
      }),
      { numRuns: 5 },
    );
  });

  it('login response user shape equals /auth/me user shape (login vs me parity)', async () => {
    const meShape = await callMe();
    const loginUserShape = await callLogin();

    // EXPECTED (post-fix): identical key sets. FAILS on unfixed code — the login
    // payload is missing emailVerified / onboardingCompletedAt / onboardingStep /
    // tenantName that /auth/me includes.
    const meKeys = Object.keys(meShape).sort();
    const loginKeys = Object.keys(loginUserShape).sort();
    expect(loginKeys).toEqual(meKeys);

    // Gate fields specifically must match.
    for (const gateField of ['emailVerified', 'onboardingCompletedAt', 'onboardingStep', 'tenantName']) {
      expect(loginUserShape).toHaveProperty(gateField);
    }
  });
});
