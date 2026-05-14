// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders with placeholder", () => {
    render(<Textarea placeholder="메모" aria-label="memo" />);
    const ta = screen.getByLabelText("memo") as HTMLTextAreaElement;
    expect(ta.placeholder).toBe("메모");
  });

  it("fires onChange and updates controlled value", () => {
    function Controlled() {
      const [value, setValue] = React.useState("");
      return (
        <Textarea
          aria-label="memo"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    }
    render(<Controlled />);
    const ta = screen.getByLabelText("memo") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "hello" } });
    expect(ta.value).toBe("hello");
  });

  it("calls onChange handler", () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="memo" onChange={onChange} />);
    const ta = screen.getByLabelText("memo") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "x" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("applies disabled state", () => {
    render(<Textarea aria-label="memo" disabled />);
    const ta = screen.getByLabelText("memo") as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
  });

  it("forwards ref", () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<Textarea aria-label="memo" ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("TEXTAREA");
  });
});
