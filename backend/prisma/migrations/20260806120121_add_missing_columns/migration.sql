-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "activeProducts" TEXT[],
ADD COLUMN     "address" TEXT,
ADD COLUMN     "customerSince" TIMESTAMP(3),
ADD COLUMN     "customerType" TEXT NOT NULL DEFAULT 'Prospect',
ADD COLUMN     "productInterests" TEXT[];

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "address" TEXT,
ADD COLUMN     "productInterests" TEXT[];

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "activeProducts" TEXT[],
ADD COLUMN     "customerSince" TIMESTAMP(3),
ADD COLUMN     "customerType" TEXT NOT NULL DEFAULT 'Prospect',
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "productInterests" TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "timeZone" TEXT;

-- CreateTable
CREATE TABLE "LoginOtpToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginOtpToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoginOtpToken_email_key" ON "LoginOtpToken"("email");
