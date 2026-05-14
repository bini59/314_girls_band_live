// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const deleteMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("../actions", () => ({
  deleteBandAction: (...args: unknown[]) => deleteMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { BandsTable } from "./BandsTable";
import type { Work } from "@prisma/client";
import type { BandWithWork } from "@/lib/band/repo";

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: 1,
    seriesId: null,
    slug: "bandori",
    nameKo: "뱅드림",
    nameJp: "バンドリ!",
    nameEn: null,
    kind: null,
    logoUrl: null,
    description: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as Work;
}

function makeBand(overrides: Partial<BandWithWork> = {}): BandWithWork {
  const work = overrides.work ?? makeWork();
  return {
    id: 1,
    workId: work.id,
    slug: "mygo",
    nameKo: "마이고",
    nameJp: "MyGO!!!!!",
    nameEn: null,
    officialUrl: null,
    snsLinks: null,
    imageUrl: null,
    description: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
    work,
  } as BandWithWork;
}

beforeEach(() => {
  deleteMock.mockReset();
  refreshMock.mockReset();
});

afterEach(() => {
  document.body.style.overflow = "";
});

describe("BandsTable — 빈 상태 / 작품 가이드", () => {
  it("작품이 없으면 작품 등록 안내 + 추가 버튼 disabled", () => {
    render(<BandsTable bands={[]} works={[]} />);
    expect(screen.getByText(/먼저/)).toBeDefined();
    expect(
      (screen.getByRole("button", { name: /\+ 밴드 추가/ }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("작품이 있고 밴드가 없으면 안내", () => {
    render(<BandsTable bands={[]} works={[makeWork()]} />);
    expect(screen.getByText(/등록된 밴드가 없습니다/)).toBeDefined();
  });
});

describe("BandsTable — 목록 + 필터", () => {
  it("행 표시 + 작품명 노출", () => {
    const w = makeWork({ id: 5, nameKo: "뱅드림" });
    render(
      <BandsTable
        bands={[makeBand({ id: 1, nameKo: "MyGO!!!!!", work: w })]}
        works={[w]}
      />
    );
    const row = screen.getByTestId("band-row-1");
    expect(row.textContent).toContain("MyGO!!!!!");
    expect(row.textContent).toContain("뱅드림");
  });

  it("snsLinks 키 표시 (값은 미노출)", () => {
    const w = makeWork();
    render(
      <BandsTable
        bands={[
          makeBand({
            id: 1,
            snsLinks: { twitter: "https://t.com/x", youtube: "https://y.com" },
            work: w,
          }),
        ]}
        works={[w]}
      />
    );
    const row = screen.getByTestId("band-row-1");
    expect(row.textContent).toContain("twitter");
    expect(row.textContent).toContain("youtube");
    expect(row.textContent).not.toContain("https://t.com");
  });

  it("작품 필터 → 해당 작품 밴드만 노출", () => {
    const w1 = makeWork({ id: 1, nameKo: "뱅드림" });
    const w2 = makeWork({ id: 2, nameKo: "걸즈밴드 크라이" });
    render(
      <BandsTable
        bands={[
          makeBand({ id: 1, nameKo: "MyGO", work: w1 }),
          makeBand({ id: 2, nameKo: "토게토게", work: w2, slug: "togenashi" }),
        ]}
        works={[w1, w2]}
      />
    );

    fireEvent.change(screen.getByLabelText("작품"), {
      target: { value: "2" },
    });

    expect(screen.queryByTestId("band-row-1")).toBeNull();
    expect(screen.getByTestId("band-row-2")).toBeDefined();
  });
});

describe("BandsTable — 추가/편집 링크", () => {
  it("+ 밴드 추가 링크가 /admin/bands/new 로 이동", () => {
    const w = makeWork();
    render(<BandsTable bands={[]} works={[w]} />);
    const link = screen.getByRole("link", { name: /\+ 밴드 추가/ });
    expect(link.getAttribute("href")).toBe("/admin/bands/new");
  });

  it("편집 링크가 /admin/bands/{id}/edit 로 이동", () => {
    const w = makeWork({ id: 5 });
    const b = makeBand({
      id: 7,
      nameKo: "토게나시 토게아리",
      work: w,
    });
    render(<BandsTable bands={[b]} works={[w]} />);
    const link = screen.getByRole("link", { name: /토게나시 토게아리 편집/ });
    expect(link.getAttribute("href")).toBe("/admin/bands/7/edit");
  });
});

describe("BandsTable — 삭제", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("삭제 → confirm 후 deleteBandAction 호출 + refresh", async () => {
    deleteMock.mockResolvedValue({ ok: true });
    const w = makeWork();
    const b = makeBand({ id: 9, nameKo: "테스트밴드", work: w });
    render(<BandsTable bands={[b]} works={[w]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /테스트밴드 삭제/ }));
    });

    expect(deleteMock).toHaveBeenCalledWith(9);
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("P2003 실패 시 에러 메시지", async () => {
    deleteMock.mockResolvedValue({
      ok: false,
      error: "출연 이력이 있는 밴드는 삭제할 수 없습니다.",
    });
    const w = makeWork();
    const b = makeBand({ id: 9, nameKo: "테스트밴드", work: w });
    render(<BandsTable bands={[b]} works={[w]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /테스트밴드 삭제/ }));
    });

    await waitFor(() => {
      expect(screen.getByText(/출연 이력/)).toBeDefined();
    });
  });
});
