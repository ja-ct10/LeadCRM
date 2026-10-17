import { Prisma } from '@prisma/client';
import prisma from '../../config/database.config';

/** Retry serialization conflicts between concurrent account updates. */
export async function authTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  isolationLevel: Prisma.TransactionIsolationLevel = Prisma.TransactionIsolationLevel.Serializable,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel,
        // Login identity locks serialize bcrypt work; allow queued requests to
        // reach that lock when the configured connection pool is small.
        maxWait: 10000,
        timeout: 30000,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= 2 || (code !== 'P2034' && code !== 'P2002')) throw error;
    }
  }
}
