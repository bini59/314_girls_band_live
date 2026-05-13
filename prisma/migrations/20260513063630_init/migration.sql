-- CreateEnum
CREATE TYPE "LiveType" AS ENUM ('SOLO', 'TAIBAN', 'FES');

-- CreateEnum
CREATE TYPE "LiveFormatType" AS ENUM ('LIVE_VENUE', 'LIVE_VIEWING', 'STREAMING');

-- CreateEnum
CREATE TYPE "TicketSaleType" AS ENUM ('FC_SENKO', 'OFFICIAL_SENKO', 'PLAYGUIDE_SENKO', 'IPPAN', 'TOJITSU', 'LIVEVIEWING_SENKO', 'LIVEVIEWING_IPPAN', 'STREAMING_SALE', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketSaleMethod" AS ENUM ('LOTTERY', 'FIRST_COME');

-- CreateTable
CREATE TABLE "series" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ko" TEXT NOT NULL,
    "name_jp" TEXT NOT NULL,
    "name_en" TEXT,
    "logo_url" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work" (
    "id" SERIAL NOT NULL,
    "series_id" INTEGER,
    "slug" TEXT NOT NULL,
    "name_ko" TEXT NOT NULL,
    "name_jp" TEXT NOT NULL,
    "name_en" TEXT,
    "kind" TEXT,
    "logo_url" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "band" (
    "id" SERIAL NOT NULL,
    "work_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ko" TEXT NOT NULL,
    "name_jp" TEXT NOT NULL,
    "name_en" TEXT,
    "official_url" TEXT,
    "sns_links" JSONB,
    "image_url" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "band_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title_ko" TEXT NOT NULL,
    "title_jp" TEXT NOT NULL,
    "title_en" TEXT,
    "type" "LiveType" NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "doors_open_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "venue_name" TEXT NOT NULL,
    "venue_address" TEXT,
    "venue_url" TEXT,
    "official_urls" JSONB,
    "poster_url" TEXT,
    "thumbnail_url" TEXT,
    "ticket_restrictions" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_band" (
    "live_id" INTEGER NOT NULL,
    "band_id" INTEGER NOT NULL,
    "is_headliner" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "live_band_pkey" PRIMARY KEY ("live_id","band_id")
);

-- CreateTable
CREATE TABLE "live_format" (
    "id" SERIAL NOT NULL,
    "live_id" INTEGER NOT NULL,
    "type" "LiveFormatType" NOT NULL,
    "label" TEXT,
    "venue_name" TEXT,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_format_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_tier" (
    "id" SERIAL NOT NULL,
    "format_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price_jpy" INTEGER NOT NULL,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "base_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_sale" (
    "id" SERIAL NOT NULL,
    "live_id" INTEGER NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "type" "TicketSaleType" NOT NULL,
    "method" "TicketSaleMethod" NOT NULL,
    "label" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "announce_at" TIMESTAMP(3),
    "payment_deadline_at" TIMESTAMP(3),
    "url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_sale_tier" (
    "sale_id" INTEGER NOT NULL,
    "tier_id" INTEGER NOT NULL,

    CONSTRAINT "ticket_sale_tier_pkey" PRIMARY KEY ("sale_id","tier_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "work_slug_key" ON "work"("slug");

-- CreateIndex
CREATE INDEX "work_series_id_idx" ON "work"("series_id");

-- CreateIndex
CREATE UNIQUE INDEX "band_slug_key" ON "band"("slug");

-- CreateIndex
CREATE INDEX "band_work_id_idx" ON "band"("work_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_slug_key" ON "live"("slug");

-- CreateIndex
CREATE INDEX "live_start_at_idx" ON "live"("start_at");

-- CreateIndex
CREATE INDEX "live_band_band_id_idx" ON "live_band"("band_id");

-- CreateIndex
CREATE INDEX "live_format_live_id_idx" ON "live_format"("live_id");

-- CreateIndex
CREATE INDEX "ticket_tier_format_id_idx" ON "ticket_tier"("format_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_slug_key" ON "vendor"("slug");

-- CreateIndex
CREATE INDEX "ticket_sale_live_id_idx" ON "ticket_sale"("live_id");

-- CreateIndex
CREATE INDEX "ticket_sale_starts_at_idx" ON "ticket_sale"("starts_at");

-- CreateIndex
CREATE INDEX "ticket_sale_tier_tier_id_idx" ON "ticket_sale_tier"("tier_id");

-- AddForeignKey
ALTER TABLE "work" ADD CONSTRAINT "work_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "band" ADD CONSTRAINT "band_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_band" ADD CONSTRAINT "live_band_live_id_fkey" FOREIGN KEY ("live_id") REFERENCES "live"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_band" ADD CONSTRAINT "live_band_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "band"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_format" ADD CONSTRAINT "live_format_live_id_fkey" FOREIGN KEY ("live_id") REFERENCES "live"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_tier" ADD CONSTRAINT "ticket_tier_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "live_format"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sale" ADD CONSTRAINT "ticket_sale_live_id_fkey" FOREIGN KEY ("live_id") REFERENCES "live"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sale" ADD CONSTRAINT "ticket_sale_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sale_tier" ADD CONSTRAINT "ticket_sale_tier_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "ticket_sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sale_tier" ADD CONSTRAINT "ticket_sale_tier_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "ticket_tier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
