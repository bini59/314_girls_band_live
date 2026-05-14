// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Select } from "./select";

describe("Select", () => {
  it("renders option children", () => {
    render(
      <Select aria-label="picker" defaultValue="b">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    const select = screen.getByLabelText("picker") as HTMLSelectElement;
    expect(select.value).toBe("b");
    expect(screen.getByRole("option", { name: "A" })).toBeDefined();
  });

  it("fires onChange when value changes", () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="picker" onChange={onChange} defaultValue="a">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    const select = screen.getByLabelText("picker") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(select.value).toBe("b");
  });

  it("applies disabled state", () => {
    render(
      <Select aria-label="picker" disabled>
        <option value="a">A</option>
      </Select>
    );
    const select = screen.getByLabelText("picker") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it("forwards ref", () => {
    const ref = React.createRef<HTMLSelectElement>();
    render(
      <Select aria-label="picker" ref={ref}>
        <option value="a">A</option>
      </Select>
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("SELECT");
  });
});
