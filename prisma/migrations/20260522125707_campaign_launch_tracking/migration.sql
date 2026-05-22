-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "launchCompletedAt" TIMESTAMP(3),
ADD COLUMN     "launchError" TEXT,
ADD COLUMN     "launchFailed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "launchInProgress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "launchSent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "launchStartedAt" TIMESTAMP(3),
ADD COLUMN     "launchTotal" INTEGER NOT NULL DEFAULT 0;
