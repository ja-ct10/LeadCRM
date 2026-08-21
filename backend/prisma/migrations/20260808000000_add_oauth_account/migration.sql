-- Migration: add_oauth_account
-- Adds OAuthAccount model and makes User.passwordHash nullable
-- so OAuth-only users can exist without a password.
-- NOTE: This migration was applied manually via fix_*.sql scripts.

-- 1. Make passwordHash nullable on User (idempotent)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- 2. Create OAuthAccount table (skip if already exists)
CREATE TABLE IF NOT EXISTS "OAuthAccount" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "tenantId"          TEXT NOT NULL DEFAULT '',
    "provider"          TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken"       TEXT,
    "refreshToken"      TEXT,
    "idToken"           TEXT,
    "tokenType"         TEXT,
    "scope"             TEXT,
    "expiresAt"         TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- 3. Foreign key: OAuthAccount.userId → User.id (cascade delete)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OAuthAccount_userId_fkey'
  ) THEN
    ALTER TABLE "OAuthAccount"
      ADD CONSTRAINT "OAuthAccount_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "User"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Unique constraint: one Google account can only link to one User
CREATE UNIQUE INDEX IF NOT EXISTS "OAuthAccount_provider_providerAccountId_key"
    ON "OAuthAccount"("provider", "providerAccountId");

-- 5. Index for fast lookups by user
CREATE INDEX IF NOT EXISTS "OAuthAccount_userId_tenantId_idx"
    ON "OAuthAccount"("userId", "tenantId");
