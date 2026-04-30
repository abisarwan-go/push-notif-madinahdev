-- AlterTable
ALTER TABLE "Project" ADD COLUMN "roomSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_roomSlug_key" ON "Project"("roomSlug");

