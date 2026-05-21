-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'EMAIL', 'PHONE', 'PINCODE', 'DATE', 'YEAR', 'SINGLE_SELECT', 'MULTI_SELECT', 'BOOLEAN', 'FILE_IMAGE', 'FILE_DOC', 'SELFIE', 'OTP_VERIFIED_PHONE', 'RICH_TEXT', 'SECTION_HEADING', 'INFO_BLOCK');

-- CreateEnum
CREATE TYPE "PiiLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CareProviderStatus" AS ENUM ('LEAD', 'ENGAGED', 'PROFILED', 'PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE', 'PAUSED', 'BLOCKED', 'OPTED_OUT', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageTemplateKind" AS ENUM ('INVITE', 'REMINDER', 'CONFIRMATION', 'REJECTION', 'ACTIVATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignMemberStatus" AS ENUM ('PENDING', 'SENT', 'ENGAGED', 'SUBMITTED', 'COMPLETED', 'OPTED_OUT', 'FAILED');

-- CreateEnum
CREATE TYPE "FormTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPS', 'VIEWER');

-- CreateTable
CREATE TABLE "Attribute" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelLocalized" JSONB,
    "helpText" TEXT,
    "helpTextLocalized" JSONB,
    "type" "AttributeType" NOT NULL,
    "options" JSONB,
    "validation" JSONB,
    "piiLevel" "PiiLevel" NOT NULL DEFAULT 'NONE',
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelLocalized" JSONB,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "requiresCouncilReg" BOOLEAN NOT NULL DEFAULT false,
    "requiresQualCert" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileTypeAttribute" (
    "id" TEXT NOT NULL,
    "profileTypeId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sectionKey" TEXT,
    "conditionalLogic" JSONB,

    CONSTRAINT "ProfileTypeAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profileTypeId" TEXT NOT NULL,
    "layout" TEXT NOT NULL DEFAULT 'ONE_PER_SCREEN',
    "sections" JSONB NOT NULL,
    "submitParts" JSONB,
    "themeId" TEXT,
    "status" "FormTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
    "language" TEXT NOT NULL DEFAULT 'en',
    "kind" "MessageTemplateKind" NOT NULL DEFAULT 'INVITE',
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "cta" JSONB,
    "variables" TEXT[],
    "profileTypeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT,
    "filename" TEXT NOT NULL,
    "uploadedById" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "columnMapping" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profileTypeId" TEXT NOT NULL,
    "formTemplateId" TEXT,
    "inviteMessageTemplateId" TEXT,
    "leadBatchId" TEXT,
    "reminderRules" JSONB,
    "stopConditions" JSONB,
    "throttle" JSONB,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMember" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "careProviderId" TEXT NOT NULL,
    "status" "CampaignMemberStatus" NOT NULL DEFAULT 'PENDING',
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "engagedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareProvider" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3),
    "profileTypeId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "status" "CareProviderStatus" NOT NULL DEFAULT 'LEAD',
    "source" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "pincodeHome" TEXT,
    "selfieUrl" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "lastContactedAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "leadBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareProviderEvent" (
    "id" TEXT NOT NULL,
    "careProviderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "id" TEXT NOT NULL,
    "careProviderId" TEXT NOT NULL,
    "formTemplateId" TEXT,
    "partKey" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "careProviderId" TEXT,
    "campaignId" TEXT,
    "messageTemplateId" TEXT,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "ultramsgMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingMessage" (
    "id" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "body" TEXT,
    "attachments" JSONB,
    "ultramsgPayload" JSONB,
    "isOptOut" BOOLEAN NOT NULL DEFAULT false,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_key_key" ON "Attribute"("key");

-- CreateIndex
CREATE INDEX "Attribute_key_idx" ON "Attribute"("key");

-- CreateIndex
CREATE INDEX "Attribute_archivedAt_idx" ON "Attribute"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileType_code_key" ON "ProfileType"("code");

-- CreateIndex
CREATE INDEX "ProfileType_active_idx" ON "ProfileType"("active");

-- CreateIndex
CREATE INDEX "ProfileTypeAttribute_profileTypeId_idx" ON "ProfileTypeAttribute"("profileTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileTypeAttribute_profileTypeId_attributeId_key" ON "ProfileTypeAttribute"("profileTypeId", "attributeId");

-- CreateIndex
CREATE INDEX "FormTemplate_profileTypeId_status_idx" ON "FormTemplate"("profileTypeId", "status");

-- CreateIndex
CREATE INDEX "MessageTemplate_profileTypeId_active_idx" ON "MessageTemplate"("profileTypeId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_code_language_key" ON "MessageTemplate"("code", "language");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_profileTypeId_idx" ON "Campaign"("profileTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMember_token_key" ON "CampaignMember"("token");

-- CreateIndex
CREATE INDEX "CampaignMember_status_idx" ON "CampaignMember"("status");

-- CreateIndex
CREATE INDEX "CampaignMember_careProviderId_idx" ON "CampaignMember"("careProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMember_campaignId_careProviderId_key" ON "CampaignMember"("campaignId", "careProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "CareProvider_phone_key" ON "CareProvider"("phone");

-- CreateIndex
CREATE INDEX "CareProvider_status_idx" ON "CareProvider"("status");

-- CreateIndex
CREATE INDEX "CareProvider_profileTypeId_idx" ON "CareProvider"("profileTypeId");

-- CreateIndex
CREATE INDEX "CareProvider_pincodeHome_idx" ON "CareProvider"("pincodeHome");

-- CreateIndex
CREATE INDEX "CareProvider_phone_idx" ON "CareProvider"("phone");

-- CreateIndex
CREATE INDEX "CareProviderEvent_careProviderId_createdAt_idx" ON "CareProviderEvent"("careProviderId", "createdAt");

-- CreateIndex
CREATE INDEX "CareProviderEvent_type_idx" ON "CareProviderEvent"("type");

-- CreateIndex
CREATE INDEX "FormResponse_careProviderId_idx" ON "FormResponse"("careProviderId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_toPhone_idx" ON "WhatsAppMessage"("toPhone");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_idx" ON "WhatsAppMessage"("status");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_careProviderId_idx" ON "WhatsAppMessage"("careProviderId");

-- CreateIndex
CREATE INDEX "IncomingMessage_fromPhone_idx" ON "IncomingMessage"("fromPhone");

-- CreateIndex
CREATE INDEX "IncomingMessage_handled_idx" ON "IncomingMessage"("handled");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "ProfileTypeAttribute" ADD CONSTRAINT "ProfileTypeAttribute_profileTypeId_fkey" FOREIGN KEY ("profileTypeId") REFERENCES "ProfileType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileTypeAttribute" ADD CONSTRAINT "ProfileTypeAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_profileTypeId_fkey" FOREIGN KEY ("profileTypeId") REFERENCES "ProfileType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_profileTypeId_fkey" FOREIGN KEY ("profileTypeId") REFERENCES "ProfileType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadBatch" ADD CONSTRAINT "LeadBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_profileTypeId_fkey" FOREIGN KEY ("profileTypeId") REFERENCES "ProfileType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "FormTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_inviteMessageTemplateId_fkey" FOREIGN KEY ("inviteMessageTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_leadBatchId_fkey" FOREIGN KEY ("leadBatchId") REFERENCES "LeadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_careProviderId_fkey" FOREIGN KEY ("careProviderId") REFERENCES "CareProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareProvider" ADD CONSTRAINT "CareProvider_profileTypeId_fkey" FOREIGN KEY ("profileTypeId") REFERENCES "ProfileType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareProvider" ADD CONSTRAINT "CareProvider_leadBatchId_fkey" FOREIGN KEY ("leadBatchId") REFERENCES "LeadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareProviderEvent" ADD CONSTRAINT "CareProviderEvent_careProviderId_fkey" FOREIGN KEY ("careProviderId") REFERENCES "CareProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_careProviderId_fkey" FOREIGN KEY ("careProviderId") REFERENCES "CareProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_careProviderId_fkey" FOREIGN KEY ("careProviderId") REFERENCES "CareProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_messageTemplateId_fkey" FOREIGN KEY ("messageTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
