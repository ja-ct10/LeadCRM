import { PrismaClient } from '@prisma/client';
import { comparePassword, hashPassword } from '../../shared/helpers/crypto';
import { signToken } from './jwt.service';
import { AppError } from '../../shared/errors/app-error';
import { ConflictError } from '../../shared/errors/http-error';

const prisma = new PrismaClient();

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

export async function loginUser(dto: LoginDto) {
  const user = await prisma.user.findFirst({
    where: { email: dto.email },
  });

  if (!user) {
    // Generic message — do not reveal whether email exists
    throw new AppError('Invalid email or password', 401);
  }

  const valid = await comparePassword(dto.password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError('Account is inactive. Contact your administrator.', 403);
  }

  const token = signToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  });

  return { token, user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName } };
}

export async function registerUser(dto: RegisterDto) {
  const existing = await prisma.user.findFirst({
    where: { email: dto.email, tenantId: dto.tenantId },
  });

  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const passwordHash = await hashPassword(dto.password);

  const user = await prisma.user.create({
    data: {
      tenantId: dto.tenantId, // always from session/system — never from client body
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
    },
  });

  return { id: user.id, email: user.email, role: user.role };
}
