import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log internally — never expose internals to client
  console.error('[Error]', {
    message: err.message,
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

  // Generic fallback — never expose stack traces to client
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred. Please try again.',
  });
}
