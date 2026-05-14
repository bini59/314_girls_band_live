// @vitest-environment jsdom
import * as React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

/**
 * VendorsTable 컴포넌트 테스트 (jsdom).
 *
 * Server Actions 와 next/navigation 은 모듈 단위로 mock.
 */

const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("../actions", () => ({
  createVendorAction: (...args: unknown[]) => createMock(...args),
  updateVendorAction: (...args: unknown[]) => updateMock(...args),
  deleteVendorAction: (...args: unknown[]) => deleteMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { VendorsTable } from "./VendorsTable";
import type { Vendor } from "@prisma/client";

function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 1,
    slug: "ee-plus",
    name: "イープラス",
    baseUrl: "https://eplus.jp",
    logoUrl: null,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as Vendor;
}

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  refreshMock.mockReset();
});

afterEach(() => {
  document.body.style.overflow = "";
});

describe("VendorsTable — 빈 상태", () => {
  it("vendors 가 비어 있으면 안내 문구 표시", () => {
    render(<VendorsTable vendors={[]} />);
    expect(screen.getByText(/등록된 발매처가 없습니다/)).toBeDefined();
  });
});

describe("VendorsTable — 목록 + 추가", () => {
  it("각 vendor row 가 렌더된다", () => {
    render(
      <VendorsTable
        vendors={[
          makeVendor({ id: 1, slug: "ee-plus", name: "イープラス" }),
          makeVendor({ id: 2, slug: "lawson-ticket", name: "ローソン" }),
        ]}
      />
    );
    expect(screen.getByText("ee-plus")).toBeDefined();
    expect(screen.getByText("lawson-ticket")).toBeDefined();
    expect(screen.getByText("イープラス")).toBeDefined();
    expect(screen.getByText("ローソン")).toBeDefined();
  });

  it("+ 판매처 추가 → 다이얼로그가 열린다 (create 모드)", async () => {
    render(<VendorsTable vendors={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ 판매처 추가/ }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /판매처 추가/ })
      ).toBeDefined();
    });
  });
});

describe("VendorsTable — 편집", () => {
  it("편집 버튼 클릭 → 다이얼로그가 initial 로 prefill 된 상태로 열린다", async () => {
    const vendor = makeVendor({
      id: 7,
      slug: "fc-mygo",
      name: "MyGO!!!!! FC",
      baseUrl: "https://fc.mygo.jp",
    });
    render(<VendorsTable vendors={[vendor]} />);

    fireEvent.click(
      screen.getByRole("button", { name: /MyGO!!!!! FC 편집/ })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /판매처 편집/ })
      ).toBeDefined();
    });
    expect(
      (screen.getByLabelText("slug") as HTMLInputElement).value
    ).toBe("fc-mygo");
    expect(
      (screen.getByLabelText("표시 이름") as HTMLInputElement).value
    ).toBe("MyGO!!!!! FC");
  });

  it("편집 다이얼로그에서 저장 → updateVendorAction 호출 + router.refresh", async () => {
    updateMock.mockResolvedValue({ ok: true, vendor: makeVendor() });
    const vendor = makeVendor({ id: 7 });
    render(<VendorsTable vendors={[vendor]} />);

    fireEvent.click(
      screen.getByRole("button", { name: /イープラス 편집/ })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /판매처 편집/ })
      ).toBeDefined();
    });

    // 이름만 변경
    fireEvent.change(screen.getByLabelText("표시 이름"), {
      target: { value: "이플러스 수정" },
    });

    const form = within(screen.getByRole("dialog"))
      .getByRole("button", { name: /^저장$/ })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ name: "이플러스 수정" })
    );
    expect(refreshMock).toHaveBeenCalled();
  });
});

describe("VendorsTable — 삭제", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("삭제 버튼 → confirm 후 deleteVendorAction 호출 + router.refresh", async () => {
    deleteMock.mockResolvedValue({ ok: true });
    const vendor = makeVendor({ id: 9, name: "テスト" });
    render(<VendorsTable vendors={[vendor]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /テスト 삭제/ }));
    });

    expect(deleteMock).toHaveBeenCalledWith(9);
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("confirm 취소 시 deleteVendorAction 호출되지 않음", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const vendor = makeVendor({ id: 9, name: "テスト" });
    render(<VendorsTable vendors={[vendor]} />);

    fireEvent.click(screen.getByRole("button", { name: /テスト 삭제/ }));
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("삭제 실패 시 (P2003) 화면에 에러 메시지 표시", async () => {
    deleteMock.mockResolvedValue({
      ok: false,
      error: "사용 중인 발매처는 삭제할 수 없습니다.",
    });
    const vendor = makeVendor({ id: 9, name: "テスト" });
    render(<VendorsTable vendors={[vendor]} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /テスト 삭제/ }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/사용 중인 발매처는 삭제할 수 없습니다/)
      ).toBeDefined();
    });
  });
});
