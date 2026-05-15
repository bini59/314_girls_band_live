-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "live" ADD COLUMN     "tour_id" INTEGER;

-- CreateTable
CREATE TABLE "tour" (
    "id" SERIAL NOT NULL,
    "work_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ko" TEXT NOT NULL,
    "name_jp" TEXT NOT NULL,
    "name_en" TEXT,
    "description" TEXT,
    "poster_url" TEXT,
    "thumbnail_url" TEXT,
    "official_url" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "status" "TourStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tour_slug_key" ON "tour"("slug");

-- CreateIndex
CREATE INDEX "tour_work_id_idx" ON "tour"("work_id");

-- CreateIndex
CREATE INDEX "tour_status_starts_at_idx" ON "tour"("status", "starts_at");

-- CreateIndex
CREATE INDEX "live_tour_id_idx" ON "live"("tour_id");

-- AddForeignKey
ALTER TABLE "tour" ADD CONSTRAINT "tour_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live" ADD CONSTRAINT "live_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
