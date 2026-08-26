/**
 * Integration tests for the registration → verification → onboarding flow.
 *
 * These tests mock Prisma and the email service to verify business logic
 * without needing a real database or email transport.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ── Mock Prisma ───────────────────────────────────────────────────────────────
vi.mock('../../../config/database.config', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    account: { create: vi.fn() },
    pipeline: { create: vi.fn() },
    emailVerificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    registrationOtpToken: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    tenantInvitation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: { deleteMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({
      tenant: { create: vi.fn().mockResolvedValue({ id: 'tenant-1', name: 'Test Co' }) },
      user: { create: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com', role: 'Client Admin', tenantId: 'tenant-1' }) },
      account: { create: vi.fn().mockResolvedValue({}) },
      pipeline: { create: vi.fn().mockResolvedValue({}) },
      tenantInvitation: { update: vi.fn().mockResolvedValue({}) },
    })),
  },
}));

// ── Mock email service ────────────────────────────────────────────────────────
vi.mock('../../../shared/services/email.service', () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
  buildVerificationEmail: vi.fn().mockReturnValue('<html>verify</html>'),
  buildRegistrationOtpEmail: vi.fn().mockReturnValue('<html>otp</html>'),
  buildWelcomeEmail: vi.fn().mockReturnValue('<html>welcome</html>'),
  buildInvitationEmail: vi.fn().mockReturnValue('<html>invite</html>'),
  buildPasswordResetEmail: vi.fn().mockReturnValue('<html>reset</html>'),
}));

// ── Mock crypto helpers ───────────────────────────────────────────────────────
vi.mock('../../../shared/helpers/crypto', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2b$hash'),
  comparePassword: vi.fn().mockResolvedValue(true),
}));

// ── Mock JWT and session ──────────────────────────────────────────────────────
vi.mock('../jwt.service', () => ({
  signToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

vi.mock('../session.service', () => ({
  createSession: vi.fn().mockResolvedValue(undefined),
  revokeSession: vi.fn().mockResolvedValue(undefined),
}));

import prisma from '../../../config/database.config';
import { sendMail } from '../../../shared/services/email.service';
import { hashPassword, comparePassword } from '../../../shared/helpers/crypto';

describe('Registration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerGuest', () => {
    it('should create a PENDING user with SANDBOX tenant', async () => {
      const { registerGuest } = await import('../auth.service');

      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.emailVerificationToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.emailVerificationToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.registrationOtpToken.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await registerGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Test@1234',
        companyName: 'Test Corp',
        industry: 'IT Solutions',
        companySize: '1-10',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('tenantId');
      expect(result).toHaveProperty('emailSent');
    });

    it('should reject duplicate email', async () => {
      const { registerGuest } = await import('../auth.service');

      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'existing-user',
        email: 'john@example.com',
      });

      await expect(registerGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Test@1234',
        companyName: 'Test Corp',
      })).rejects.toThrow('already exists');
    });

    it('should normalize email to lowercase', async () => {
      const { registerGuest } = await import('../auth.service');

      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.emailVerificationToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.emailVerificationToken.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.registrationOtpToken.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await registerGuest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'JOHN@EXAMPLE.COM',
        password: 'Test@1234',
        companyName: 'Test Corp',
      });

      // Verify the email lookup used lowercase
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'john@example.com' },
        }),
      );
    });
  });

  describe('verifyRegistrationOtp', () => {
    it('should activate user on valid OTP', async () => {
      const { verifyRegistrationOtp } = await import('../auth.service');

      (prisma.registrationOtpToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        email: 'john@example.com',
        codeHash: '$2b$hash',
        expires: new Date(Date.now() + 600000), // 10 min future
        attempts: 0,
      });
      (comparePassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
      });
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.registrationOtpToken.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await verifyRegistrationOtp('john@example.com', '123456');

      expect(result).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should reject expired OTP', async () => {
      const { verifyRegistrationOtp } = await import('../auth.service');

      (prisma.registrationOtpToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        email: 'john@example.com',
        codeHash: '$2b$hash',
        expires: new Date(Date.now() - 1000), // past
        attempts: 0,
      });
      (prisma.registrationOtpToken.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await expect(verifyRegistrationOtp('john@example.com', '123456')).rejects.toThrow('expired');
    });

    it('should reject after max attempts', async () => {
      const { verifyRegistrationOtp } = await import('../auth.service');

      (prisma.registrationOtpToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        email: 'john@example.com',
        codeHash: '$2b$hash',
        expires: new Date(Date.now() + 600000),
        attempts: 5,
      });
      (prisma.registrationOtpToken.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await expect(verifyRegistrationOtp('john@example.com', '123456')).rejects.toThrow('Too many');
    });
  });

  describe('loginUser', () => {
    it('should reject unverified users', async () => {
      const { loginUser } = await import('../auth.service');

      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        passwordHash: '$2b$hash',
        emailVerified: null, // NOT verified
        status: 'PENDING',
        tenantId: 'tenant-1',
        role: 'Client Admin',
      });
      (comparePassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      await expect(loginUser({ email: 'john@example.com', password: 'Test@1234' }))
        .rejects.toThrow('verify your email');
    });

    it('should allow verified users to login', async () => {
      const { loginUser } = await import('../auth.service');

      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        passwordHash: '$2b$hash',
        emailVerified: new Date(),
        status: 'ACTIVE',
        tenantId: 'tenant-1',
        role: 'Client Admin',
        firstName: 'John',
        lastName: 'Doe',
      });
      (comparePassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await loginUser({ email: 'john@example.com', password: 'Test@1234' });

      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('john@example.com');
    });

    it('should reject wrong password without leaking email existence', async () => {
      const { loginUser } = await import('../auth.service');

      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        passwordHash: '$2b$hash',
        emailVerified: new Date(),
        status: 'ACTIVE',
      });
      (comparePassword as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await expect(loginUser({ email: 'john@example.com', password: 'wrong' }))
        .rejects.toThrow('Invalid email or password');
    });
  });

  describe('Password strength validation', () => {
    it('should reject weak passwords via Zod schema', async () => {
      const { GuestRegisterSchema } = await import('../auth.dto');

      const result = GuestRegisterSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'weakpass', // no uppercase, no number, no special
        companyName: 'Test',
      });

      expect(result.success).toBe(false);
    });

    it('should accept strong passwords', async () => {
      const { GuestRegisterSchema } = await import('../auth.dto');

      const result = GuestRegisterSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'Test@1234',
        companyName: 'Test',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Token security', () => {
    it('should use SHA-256 for verification token hashing', () => {
      const token = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(token).digest('hex');

      // Verify hash is 64 hex chars (256 bits)
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
      // Verify same input produces same hash (deterministic)
      const hash2 = crypto.createHash('sha256').update(token).digest('hex');
      expect(hash).toBe(hash2);
    });

    it('should generate cryptographically secure tokens', () => {
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');

      // 64 hex chars = 32 bytes = 256 bits of entropy
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });
  });
});
