-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'FILLED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobOfferStatus" AS ENUM ('PENDING', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "profileTypeId" TEXT NOT NULL,
    "pincode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "requiredSkills" JSONB,
    "shiftType" TEXT,
    "payText" TEXT,
    "startDate" TIMESTAMP(3),
    "slots" INTEGER NOT NULL DEFAULT 1,
    "offerTTLHours" INTEGER NOT NULL DEFAULT 48,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "careProviderId" TEXT NOT NULL,
    "status" "JobOfferStatus" NOT NULL DEFAULT 'PENDING',
    "distanceKm" DOUBLE PRECISION,
    "channel" "MessageChannel",
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_profileTypeId_idx" ON "Job"("profileTypeId");

-- CreateIndex
CREATE INDEX "Job_pincode_idx" ON "Job"("pincode");

-- CreateIndex
CREATE UNIQUE INDEX "JobOffer_token_key" ON "JobOffer"("token");

-- CreateIndex
CREATE INDEX "JobOffer_status_idx" ON "JobOffer"("status");

-- CreateIndex
CREATE INDEX "JobOffer_careProviderId_idx" ON "JobOffer"("careProviderId");

-- CreateIndex
CREATE INDEX "JobOffer_expiresAt_status_idx" ON "JobOffer"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobOffer_jobId_careProviderId_key" ON "JobOffer"("jobId", "careProviderId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_profileTypeId_fkey" FOREIGN KEY ("profileTypeId") REFERENCES "ProfileType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_careProviderId_fkey" FOREIGN KEY ("careProviderId") REFERENCES "CareProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
