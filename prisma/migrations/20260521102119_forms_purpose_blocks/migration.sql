-- CreateEnum
CREATE TYPE "FormPurpose" AS ENUM ('ONBOARDING', 'APPOINTMENT_CONFIRM', 'APPOINTMENT_EXECUTION', 'POST_APPOINTMENT', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "FormTemplate" DROP CONSTRAINT "FormTemplate_profileTypeId_fkey";

-- AlterTable
ALTER TABLE "FormTemplate" ADD COLUMN     "actions" JSONB,
ADD COLUMN     "purpose" "FormPurpose" NOT NULL DEFAULT 'ONBOARDING',
ALTER COLUMN "profileTypeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FormTemplate_purpose_status_idx" ON "FormTemplate"("purpose", "status");

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_profileTypeId_fkey" FOREIGN KEY ("profileTypeId") REFERENCES "ProfileType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
