/**
 * 공개(public) 페이지용 데이터 조회.
 * 모두 PUBLISHED + deletedAt = null 조건만 노출.
 */
import { prisma } from "@/lib/db";

export async function getWorksForNav() {
  return prisma.work.findMany({
    orderBy: { nameKo: "asc" },
    select: {
      id: true,
      slug: true,
      nameKo: true,
      nameJp: true,
      bands: {
        orderBy: { nameKo: "asc" },
        select: {
          id: true,
          slug: true,
          nameKo: true,
          nameJp: true,
        },
      },
    },
  });
}

export type NavWork = Awaited<ReturnType<typeof getWorksForNav>>[number];

const LIVE_LIST_SELECT = {
  id: true,
  slug: true,
  titleKo: true,
  titleJp: true,
  type: true,
  startAt: true,
  doorsOpenAt: true,
  endAt: true,
  venueName: true,
  thumbnailUrl: true,
  posterUrl: true,
  liveBands: {
    orderBy: { order: "asc" as const },
    select: {
      isHeadliner: true,
      band: {
        select: { id: true, slug: true, nameKo: true, nameJp: true },
      },
    },
  },
} as const;

export async function getLivesInRange(start: Date, end: Date) {
  return prisma.live.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      startAt: { gte: start, lt: end },
    },
    orderBy: { startAt: "asc" },
    select: LIVE_LIST_SELECT,
  });
}

export type PublicLive = Awaited<ReturnType<typeof getLivesInRange>>[number];

export async function getLivesByWorkSlug(workSlug: string) {
  return prisma.live.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      liveBands: { some: { band: { work: { slug: workSlug } } } },
    },
    orderBy: { startAt: "desc" },
    select: LIVE_LIST_SELECT,
  });
}

export async function getLivesByBandSlug(bandSlug: string) {
  return prisma.live.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      liveBands: { some: { band: { slug: bandSlug } } },
    },
    orderBy: { startAt: "desc" },
    select: LIVE_LIST_SELECT,
  });
}

export async function getWorkBySlug(slug: string) {
  return prisma.work.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      nameKo: true,
      nameJp: true,
      nameEn: true,
      description: true,
      logoUrl: true,
      series: { select: { slug: true, nameKo: true } },
      bands: {
        orderBy: { nameKo: "asc" },
        select: {
          id: true,
          slug: true,
          nameKo: true,
          nameJp: true,
          imageUrl: true,
          description: true,
        },
      },
    },
  });
}

export async function getBandBySlug(slug: string) {
  return prisma.band.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      nameKo: true,
      nameJp: true,
      nameEn: true,
      description: true,
      imageUrl: true,
      officialUrl: true,
      snsLinks: true,
      work: { select: { slug: true, nameKo: true } },
    },
  });
}

export async function getLiveBySlug(slug: string) {
  return prisma.live.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      titleKo: true,
      titleJp: true,
      titleEn: true,
      type: true,
      startAt: true,
      doorsOpenAt: true,
      endAt: true,
      venueName: true,
      venueAddress: true,
      venueUrl: true,
      officialUrls: true,
      posterUrl: true,
      thumbnailUrl: true,
      ticketRestrictions: true,
      notes: true,
      status: true,
      liveBands: {
        orderBy: { order: "asc" },
        select: {
          isHeadliner: true,
          band: {
            select: {
              id: true,
              slug: true,
              nameKo: true,
              nameJp: true,
              work: { select: { slug: true, nameKo: true } },
            },
          },
        },
      },
      formats: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          type: true,
          label: true,
          venueName: true,
          url: true,
          tiers: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, priceJpy: true, notes: true },
          },
        },
      },
      ticketSales: {
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          type: true,
          method: true,
          label: true,
          startsAt: true,
          endsAt: true,
          announceAt: true,
          paymentDeadlineAt: true,
          url: true,
          notes: true,
          vendor: { select: { id: true, slug: true, name: true } },
          tiers: {
            select: {
              tier: { select: { id: true, name: true, priceJpy: true } },
            },
          },
        },
      },
    },
  });
}
