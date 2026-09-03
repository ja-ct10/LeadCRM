import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log internally — never expose internals to client.
  // Include Prisma-specific fields when available so production logs are debuggable.
  const errAsUnknown = err as unknown as Record<string, unknown>;
  const prismaCode = errAsUnknown.code as string | undefined;
  const prismaMeta = errAsUnknown.meta as Record<string, unknown> | undefined;

  console.error('[Error]', {
    name: err.name,
    message: err.message,
    ...(prismaCode !== undefined && { code: prismaCode }),
    ...(prismaMeta !== undefined && { meta: prismaMeta }),
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code ? { code: err.code, message: err.message } : err.message,
    });
    return;
  }

  // Zod validation errors → 400 Bad Request
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: err.errors[0]?.message ?? 'Validation failed',
    });
    return;
  }

  // ── Prisma error handling ──────────────────────────────────────────────────
  // Convert Prisma errors to structured AppError responses.
  // Raw Prisma internals (SQL, column names, stack traces) are NEVER sent to client.

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      // Record not found
      res.status(404).json({
        success: false,
        error: { code: 'P2025', message: 'Record not found' },
      });
      return;
    }
    if (err.code === 'P2002') {
      // Unique constraint violation
      res.status(409).json({
        success: false,
        error: { code: 'P2002', message: 'A record with this value already exists' },
      });
      return;
    }
    // All other known Prisma errors (e.g. P2022 schema drift, P2003 FK violation)
    res.status(500).json({
      success: false,
      error: { code: err.code, message: 'Database operation failed — please contact support' },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: { code: 'PRISMA_VALIDATION', message: 'Invalid data supplied to database operation' },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    res.status(503).json({
      success: false,
      error: { code: 'DB_UNAVAILABLE', message: 'Database connection failed — please try again shortly' },
    });
    return;
  }

  // Generic fallback — never expose stack traces to client
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred. Please try again.',
  });
}
