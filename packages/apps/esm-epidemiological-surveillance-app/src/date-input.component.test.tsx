import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DateInput } from "./date-input.component";
import { displayDate } from "./date-display";
import { useState } from "react";

it("allows typing a date progressively without clearing the input", () => {
  function Form() {
    const [value, setValue] = useState("");
    return (
      <DateInput
        id="typed"
        labelText="Typed date"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    );
  }
  render(<Form />);
  const input = screen.getByLabelText("Typed date");
  for (const value of ["1", "14", "14/", "14/10", "14/10/2026"]) {
    fireEvent.change(input, { target: { value } });
    expect(input).toHaveValue(value);
  }
});

it("displays calendar dates without a timezone shift and keeps ISO in the API", () => {
  expect(displayDate("2026-01-01T00:00:00Z")).toBe("01/01/2026");
  const change = vi.fn();
  const view = render(
    <DateInput
      id="date"
      labelText="Date"
      value="2026-10-14"
      onChange={change}
    />,
  );
  const input = screen.getByLabelText("Date");
  expect(input).toHaveValue("14/10/2026");
  fireEvent.change(input, { target: { value: "15/10/2026" } });
  expect(change).toHaveBeenLastCalledWith({ target: { value: "2026-10-15" } });
  view.rerender(
    <DateInput
      id="date"
      labelText="Date"
      value="2026-10-15"
      disabled
      onChange={change}
    />,
  );
  expect(input).toHaveValue("15/10/2026");
  expect(input).toBeDisabled();
});

it("shows validation beneath a disabled derived date", () => {
  render(<DateInput id="derived" labelText="Investigation" value="2099-01-01" disabled invalid invalidText="The date cannot be after today." onChange={vi.fn()} />);
  expect(screen.getByLabelText("Investigation")).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("The date cannot be after today.");
});
