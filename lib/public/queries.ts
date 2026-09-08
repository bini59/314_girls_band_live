/**
 * 공개(public) 페이지용 데이터 조회.
 * 모두 PUBLISHED + deletedAt = null 조건만 노출.
 */
import { prisma } from "@/lib/db";

// ponytail: 밴드 표시 순서 고정 상수. 목록에 없는 slug 는 뒤에 nameKo 순. 어드민에서 바꾸고 싶어지면 Band.sortOrder 컬럼으로.
const BAND_ORDER = [
  "poppin-party",
  "afterglow",
  "pastel-palettes",
  "roselia",
  "hello-happy-world",
  "morfonica",
  "raise-a-suilen",
  "mygo",
  "ave-mujica",
  "mugendai-mewtype",
  "millsage",
  "ikka-dumb-rock",
];

export function sortBands<T extends { slug: string; nameKo: string }>(bands: T[]): T[] {
  const rank = (b: T) => {
    const i = BAND_ORDER.indexOf(b.slug);
    return i === -1 ? BAND_ORDER.length : i;
  };
  return [...bands].sort((a, b) => rank(a) - rank(b) || a.nameKo.localeCompare(b.nameKo, "ko"));
}

export async function getWorksForNav() {
  const works = await prisma.work.findMany({
    orderBy: { nameKo: "asc" },
    select: {
      id: true,
      slug: true,
      nameKo: true,
      nameJp: true,
      bands: {
        select: {
          id: true,
          slug: true,
          nameKo: true,
          nameJp: true,
        },
      },
    },
  });
  return works.map((w) => ({ ...w, bands: sortBands(w.bands) }));
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

export async function getLivesByTourSlug(tourSlug: string) {
  return prisma.live.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      tour: { slug: tourSlug, status: "PUBLISHED" },
    },
    orderBy: { startAt: "asc" },
    select: LIVE_LIST_SELECT,
  });
}

export async function getTourBySlug(slug: string) {
  return prisma.tour.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      nameKo: true,
      nameJp: true,
      nameEn: true,
      description: true,
      posterUrl: true,
      thumbnailUrl: true,
      officialUrl: true,
      startsAt: true,
      endsAt: true,
      status: true,
      work: {
        select: { slug: true, nameKo: true, nameJp: true },
      },
    },
  });
}

export async function getWorkBySlug(slug: string) {
  const work = await prisma.work.findUnique({
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
        select: {
          id: true,
          slug: true,
          nameKo: true,
          nameJp: true,
          imageUrl: true,
          description: true,
        },
      },
      tours: {
        where: { status: "PUBLISHED" },
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          slug: true,
          nameKo: true,
          nameJp: true,
          startsAt: true,
          endsAt: true,
          thumbnailUrl: true,
        },
      },
    },
  });
  return work && { ...work, bands: sortBands(work.bands) };
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
      tour: {
        select: {
          slug: true,
          nameKo: true,
          nameJp: true,
          status: true,
        },
      },
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
