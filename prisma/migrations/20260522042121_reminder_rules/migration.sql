-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('CAMPAIGN_FOLLOWUP', 'VERIFICATION_STUCK', 'PROVIDER_INACTIVE', 'APPOINTMENT_PRE', 'APPOINTMENT_PENDING', 'APPOINTMENT_POST', 'DOCUMENT_EXPIRY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderSendStatus" AS ENUM ('SCHEDULED', 'SENT', 'FAILED', 'SUPPRESSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ReminderKind" NOT NULL,
    "campaignId" TEXT,
    "messageTemplateId" TEXT,
    "delayHours" DOUBLE PRECISION NOT NULL DEFAULT 24,
    "cooldownHours" DOUBLE PRECISION NOT NULL DEFAULT 72,
    "maxSendsPerProvider" INTEGER NOT NULL DEFAULT 3,
    "targetStatuses" JSONB,
    "params" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "reminderRuleId" TEXT NOT NULL,
    "careProviderId" TEXT NOT NULL,
    "campaignMemberId" TEXT,
    "status" "ReminderSendStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "whatsappMessageId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderRule_kind_active_idx" ON "ReminderRule"("kind", "active");

-- CreateIndex
CREATE INDEX "ReminderRule_campaignId_idx" ON "ReminderRule"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_whatsappMessageId_key" ON "ReminderLog"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "ReminderLog_reminderRuleId_status_idx" ON "ReminderLog"("reminderRuleId", "status");

-- CreateIndex
CREATE INDEX "ReminderLog_careProviderId_createdAt_idx" ON "ReminderLog"("careProviderId", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderLog_status_scheduledFor_idx" ON "ReminderLog"("status", "scheduledFor");

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_messageTemplateId_fkey" FOREIGN KEY ("messageTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_reminderRuleId_fkey" FOREIGN KEY ("reminderRuleId") REFERENCES "ReminderRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_careProviderId_fkey" FOREIGN KEY ("careProviderId") REFERENCES "CareProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_campaignMemberId_fkey" FOREIGN KEY ("campaignMemberId") REFERENCES "CampaignMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
