-- Add room mode fields to Project
ALTER TABLE "Project" ADD COLUMN "isRoomMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "roomPasswordHash" TEXT;
ALTER TABLE "Project" ADD COLUMN "roomJoinCode" TEXT;

-- Add member identity fields to Subscriber
ALTER TABLE "Subscriber" ADD COLUMN "memberId" TEXT;
ALTER TABLE "Subscriber" ADD COLUMN "displayName" TEXT;

-- Optional join code uniqueness per project
CREATE UNIQUE INDEX "Project_tenantId_roomJoinCode_key" ON "Project"("tenantId", "roomJoinCode");
