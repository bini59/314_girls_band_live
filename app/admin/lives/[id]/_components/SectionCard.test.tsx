// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SectionCard } from "./SectionCard";

describe("SectionCard", () => {
  it("renders title and children", () => {
    render(
      <SectionCard title="밴드">
        <p>본문</p>
      </SectionCard>
    );
    expect(screen.getByText("밴드")).toBeDefined();
    expect(screen.getByText("본문")).toBeDefined();
  });

  it("renders description when provided", () => {
    render(
      <SectionCard title="t" description="설명입니다">
        <p>child</p>
      </SectionCard>
    );
    expect(screen.getByText("설명입니다")).toBeDefined();
  });

  it("renders action node", () => {
    render(
      <SectionCard title="t" action={<button>추가</button>}>
        <p>child</p>
      </SectionCard>
    );
    expect(screen.getByRole("button", { name: "추가" })).toBeDefined();
  });

  it("applies warning tone via data-tone (destructive ring)", () => {
    const { container } = render(
      <SectionCard title="t" tone="warning">
        <p>child</p>
      </SectionCard>
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("data-tone")).toBe("warning");
    expect(section?.className).toContain("--color-destructive");
  });

  it("default tone uses background surface token", () => {
    const { container } = render(
      <SectionCard title="t">
        <p>child</p>
      </SectionCard>
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("data-tone")).toBe("default");
    expect(section?.className).toContain("--color-background");
  });
});
