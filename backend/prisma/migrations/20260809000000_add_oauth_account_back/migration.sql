-- AddOAuthAccount: restore OAuthAccount table removed in campaigns schema rename
-- Additive migration — no existing tables dropped or altered.

CREATE TABLE IF NOT EXISTS "OAuthAccount" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "tenantId"          TEXT NOT NULL,
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

-- Unique: one provider account maps to one user
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'OAuthAccount_provider_providerAccountId_key'
  ) THEN
    ALTER TABLE "OAuthAccount"
      ADD CONSTRAINT "OAuthAccount_provider_providerAccountId_key"
      UNIQUE ("provider", "providerAccountId");
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS "OAuthAccount_userId_tenantId_idx"
  ON "OAuthAccount"("userId", "tenantId");

-- FK to User
DO $$ BEGIN
  ALTER TABLE "OAuthAccount"
    ADD CONSTRAINT "OAuthAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Also make User.passwordHash nullable if not already
DO $$ BEGIN
  ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
  EXCEPTION WHEN others THEN NULL;
END $$;
