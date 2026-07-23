import { PrismaClient } from '@prisma/client';
import { comparePassword, hashPassword } from '../../shared/helpers/crypto';
import { signToken } from './jwt.service';
import { createSession } from './session.service';
import { AppError } from '../../shared/errors/app-error';
import { ConflictError } from '../../shared/errors/http-error';

const prisma = new PrismaClient();

// JWT lifetime in milliseconds (must match jwt.service expiresIn)
const JWT_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  tenantId: string;
}

export interface LoginContext {
  userAgent?: string;
  ipAddress?: string;
}

export async function loginUser(dto: LoginDto, ctx: LoginContext = {}) {
  const user = await prisma.user.findFirst({
    where: { email: dto.email },
  });

  // Generic message — do not reveal whether email exists
  if (!user) throw new AppError('Invalid email or password', 401);

  const valid = await comparePassword(dto.password, user.passwordHash);
  if (!valid) throw new AppError('Invalid email or password', 401);

  if (user.status !== 'ACTIVE') {
    throw new AppError('Account is inactive. Contact your administrator.', 403);
  }

  const token = signToken({
    userId:   user.id,
    tenantId: user.tenantId,
    role:     user.role,
    email:    user.email,
  });

  // Persist session for revocation support
  await createSession({
    userId:      user.id,
    tenantId:    user.tenantId,
    token,
    userAgent:   ctx.userAgent,
    ipAddress:   ctx.ipAddress,
    expiresInMs: JWT_EXPIRES_MS,
  });

  return {
    token,
    user: {
      id:        user.id,
      email:     user.email,
      role:      user.role,
      firstName: user.firstName,
      lastName:  user.lastName,
    },
  };
}

export async function registerUser(dto: RegisterDto) {
  const existing = await prisma.user.findFirst({
    where: { email: dto.email, tenantId: dto.tenantId },
  });

  if (existing) throw new ConflictError('A user with this email already exists');

  const passwordHash = await hashPassword(dto.password);

  const user = await prisma.user.create({
    data: {
      // tenantId always from system context — never from client body
      tenantId:     dto.tenantId,
      firstName:    dto.firstName,
      lastName:     dto.lastName,
      email:        dto.email,
      passwordHash,
    },
  });

  return { id: user.id, email: user.email, role: user.role };
}

import { ClientAdminRegisterDto, GuestRegisterDto } from './auth.dto';

export async function registerClientAdmin(dto: ClientAdminRegisterDto) {
  const existingUser = await prisma.user.findFirst({
    where: { email: dto.email },
  });

  if (existingUser) throw new ConflictError('A user with this email already exists');

  const passwordHash = await hashPassword(dto.password);

  // Generate a unique slug for the tenant
  const slug = dto.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

  // We use a transaction to ensure everything is created together
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Tenant
    const tenant = await tx.tenant.create({
      data: {
        name: dto.companyName,
        slug,
        industry: dto.industry,
        companySize: dto.companySize,
        status: 'ACTIVE',
        subscriptionStatus: 'TRIAL',
        plan: 'FREE',
      },
    });

    // 2. Create User
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        role: 'Client Admin',
        status: 'ACTIVE',
      },
    });

    // 3. Create Organization
    const organization = await tx.organization.create({
      data: {
        tenantId: tenant.id,
        name: dto.companyName,
        industry: dto.industry,
        size: dto.companySize,
        country: dto.country,
      },
    });

    return { tenant, user, organization };
  });

  return { id: result.user.id, email: result.user.email, role: result.user.role, tenantId: result.tenant.id };
}

export async function registerGuest(dto: GuestRegisterDto) {
  const existingUser = await prisma.user.findFirst({
    where: { email: dto.email },
  });

  if (existingUser) throw new ConflictError('A user with this email already exists');

  const passwordHash = await hashPassword(dto.password);
  
  // Guest gets their own sandbox tenant
  const slug = 'sandbox-' + Math.random().toString(36).substring(2, 10);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: 'Demo Sandbox',
        slug,
        status: 'SANDBOX',
        subscriptionStatus: 'TRIAL',
        plan: 'FREE',
      },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        role: 'Guest',
        status: 'ACTIVE',
      },
    });

    const organization = await tx.organization.create({
      data: {
        tenantId: tenant.id,
        name: 'Demo Sandbox Org',
      },
    });

    // Seed some basic data for the guest
    const pipeline = await tx.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Sales Pipeline',
        isDefault: true,
        stages: {
          create: [
            { name: 'Lead', order: 1, isDefault: true },
            { name: 'Contacted', order: 2 },
            { name: 'Qualified', order: 3 },
            { name: 'Won', order: 4, isWon: true },
            { name: 'Lost', order: 5, isLost: true },
          ]
        }
      }
    });

    return { tenant, user };
  });

  return { id: result.user.id, email: result.user.email, role: result.user.role, tenantId: result.tenant.id };
}
