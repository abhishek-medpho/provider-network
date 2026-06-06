-- CreateEnum
CREATE TYPE "CampaignDispatchMode" AS ENUM ('IMMEDIATE', 'PACED');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "cohortMax" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "cohortMin" INTEGER NOT NULL DEFAULT 35,
ADD COLUMN     "dispatchMode" "CampaignDispatchMode" NOT NULL DEFAULT 'PACED',
ADD COLUMN     "dispatchTTLHours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "dispatchTimezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
ADD COLUMN     "hourlyTarget" INTEGER NOT NULL DEFAULT 27,
ADD COLUMN     "quietHourEnd" INTEGER NOT NULL DEFAULT 21,
ADD COLUMN     "quietHourStart" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "CampaignMember" ADD COLUMN     "scheduledSendAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CampaignMember_scheduledSendAt_status_idx" ON "CampaignMember"("scheduledSendAt", "status");
