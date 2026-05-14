// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("toggles uncontrolled state on click", () => {
    render(<Checkbox aria-label="agree" />);
    const cb = screen.getByLabelText("agree") as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
  });

  it("supports controlled state", () => {
    function Controlled() {
      const [checked, setChecked] = React.useState(false);
      return (
        <Checkbox
          aria-label="agree"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
      );
    }
    render(<Controlled />);
    const cb = screen.getByLabelText("agree") as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
  });

  it("fires onChange", () => {
    const onChange = vi.fn();
    render(<Checkbox aria-label="agree" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("agree"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("applies disabled state", () => {
    render(<Checkbox aria-label="agree" disabled />);
    const cb = screen.getByLabelText("agree") as HTMLInputElement;
    expect(cb.disabled).toBe(true);
  });

  it("forwards ref", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Checkbox aria-label="agree" ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.type).toBe("checkbox");
  });
});
