-- Make passwordHash nullable so OAuth-only users can exist without a password
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
