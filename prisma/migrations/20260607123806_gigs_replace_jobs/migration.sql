/*
  Warnings:

  - You are about to drop the `Job` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JobOffer` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "GigType" AS ENUM ('SAMPLE_COLLECTION', 'HOME_NURSING_VISIT', 'OTHER');

-- CreateEnum
CREATE TYPE "GigStatus" AS ENUM ('DRAFT', 'OPEN', 'ASSIGNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GigAssignmentStatus" AS ENUM ('NONE', 'AWAITING', 'CONFIRMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GigResponseStatus" AS ENUM ('NOTIFIED', 'INTERESTED', 'DECLINED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "FormPurpose" ADD VALUE 'GIG_COMPLETION';

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_profileTypeId_fkey";

-- DropForeignKey
ALTER TABLE "JobOffer" DROP CONSTRAINT "JobOffer_careProviderId_fkey";

-- DropForeignKey
ALTER TABLE "JobOffer" DROP CONSTRAINT "JobOffer_jobId_fkey";

-- DropTable
DROP TABLE "Job";

-- DropTable
DROP TABLE "JobOffer";

-- DropEnum
DROP TYPE "JobOfferStatus";

-- DropEnum
DROP TYPE "JobStatus";

-- CreateTable
CREATE TABLE "Gig" (
    "id" TEXT NOT NULL,
    "type" "GigType" NOT NULL DEFAULT 'SAMPLE_COLLECTION',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "profileTypeId" TEXT NOT NULL,
    "requesterName" TEXT,
    "requesterPhone" TEXT,
    "patientName" TEXT,
    "siteAddress" TEXT,
    "siteArea" TEXT,
    "pincode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "requiredSkills" JSONB,
    "payText" TEXT,
    "sopFormTemplateId" TEXT,
    "status" "GigStatus" NOT NULL DEFAULT 'DRAFT',
    "currentWave" INTEGER NOT NULL DEFAULT 0,
    "assignedProviderId" TEXT,
    "assignmentStatus" "GigAssignmentStatus" NOT NULL DEFAULT 'NONE',
    "assignedAt" TIMESTAMP(3),
    "confirmDeadline" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GigResponse" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "careProviderId" TEXT NOT NULL,
    "status" "GigResponseStatus" NOT NULL DEFAULT 'NOTIFIED',
    "wave" INTEGER NOT NULL DEFAULT 1,
    "distanceKm" DOUBLE PRECISION,
    "channel" "MessageChannel",
    "token" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GigResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gig_status_idx" ON "Gig"("status");

-- CreateIndex
CREATE INDEX "Gig_profileTypeId_idx" ON "Gig"("profileTypeId");

-- CreateIndex
CREATE INDEX "Gig_scheduledFor_idx" ON "Gig"("scheduledFor");

-- CreateIndex
CREATE INDEX "Gig_assignmentStatus_confirmDeadline_idx" ON "Gig"("assignmentStatus", "confirmDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "GigResponse_token_key" ON "GigResponse"("token");

-- CreateIndex
CREATE INDEX "GigResponse_status_idx" ON "GigResponse"("status");

-- CreateIndex
CREATE INDEX "GigResponse_careProviderId_idx" ON "GigResponse"("careProviderId");

-- CreateIndex
CREATE INDEX "GigResponse_gigId_status_idx" ON "GigResponse"("gigId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GigResponse_gigId_careProviderId_key" ON "GigResponse"("gigId", "careProviderId");

-- AddForeignKey
ALTER TABLE "Gig" ADD CONSTRAINT "Gig_profileTypeId_fkey" FOREIGN KEY ("profileTypeId") REFERENCES "ProfileType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gig" ADD CONSTRAINT "Gig_sopFormTemplateId_fkey" FOREIGN KEY ("sopFormTemplateId") REFERENCES "FormTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gig" ADD CONSTRAINT "Gig_assignedProviderId_fkey" FOREIGN KEY ("assignedProviderId") REFERENCES "CareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigResponse" ADD CONSTRAINT "GigResponse_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigResponse" ADD CONSTRAINT "GigResponse_careProviderId_fkey" FOREIGN KEY ("careProviderId") REFERENCES "CareProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
