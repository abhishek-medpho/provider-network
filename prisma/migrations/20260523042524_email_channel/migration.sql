-- CreateEnum
CREATE TYPE "EmailMessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChannelStrategy" AS ENUM ('WHATSAPP_ONLY', 'EMAIL_ONLY', 'BOTH', 'WHATSAPP_FIRST', 'EMAIL_FIRST');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "channelStrategy" "ChannelStrategy" NOT NULL DEFAULT 'WHATSAPP_ONLY',
ADD COLUMN     "inviteEmailTemplateId" TEXT;

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "html" TEXT,
ADD COLUMN     "subject" TEXT;

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "careProviderId" TEXT,
    "campaignId" TEXT,
    "messageTemplateId" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "html" TEXT,
    "status" "EmailMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "firstClickedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailMessage_toEmail_idx" ON "EmailMessage"("toEmail");

-- CreateIndex
CREATE INDEX "EmailMessage_status_idx" ON "EmailMessage"("status");

-- CreateIndex
CREATE INDEX "EmailMessage_careProviderId_idx" ON "EmailMessage"("careProviderId");

-- CreateIndex
CREATE INDEX "EmailMessage_campaignId_idx" ON "EmailMessage"("campaignId");

-- CreateIndex
CREATE INDEX "EmailEvent_emailMessageId_idx" ON "EmailEvent"("emailMessageId");

-- CreateIndex
CREATE INDEX "EmailEvent_kind_idx" ON "EmailEvent"("kind");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_inviteEmailTemplateId_fkey" FOREIGN KEY ("inviteEmailTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_careProviderId_fkey" FOREIGN KEY ("careProviderId") REFERENCES "CareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_messageTemplateId_fkey" FOREIGN KEY ("messageTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
