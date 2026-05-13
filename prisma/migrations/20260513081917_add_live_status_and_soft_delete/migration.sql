-- CreateEnum
CREATE TYPE "LiveStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "live" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "status" "LiveStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "live_status_start_at_idx" ON "live"("status", "start_at");

-- CreateIndex
CREATE INDEX "live_deleted_at_idx" ON "live"("deleted_at");
