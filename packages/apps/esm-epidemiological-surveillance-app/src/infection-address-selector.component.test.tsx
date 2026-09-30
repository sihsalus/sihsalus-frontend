import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { addressChildren } from "./api";
import { InfectionAddressSelector } from "./infection-address-selector.component";
import type { NamedReference } from "./types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./api", () => ({ addressChildren: vi.fn() }));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <div role="alert">Address lookup failed</div>,
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(addressChildren).mockImplementation(async (level, parent) =>
    level === "provinces"
      ? [
          { uuid: "p1", display: "Province 1" },
          { uuid: "p2", display: "Province 2" },
        ]
      : level === "districts"
        ? [{ uuid: `${parent}-district`, display: `${parent} district` }]
        : [{ uuid: `${parent}-center`, display: `${parent} center` }],
  );
});

it("preserves the selected center on mount and when the parent callback changes", async () => {
  const first = vi.fn();
  const { rerender } = render(
    <InfectionAddressSelector value="saved-center" onChange={first} />,
  );
  await screen.findByRole("option", { name: "Province 1" });
  expect(first).not.toHaveBeenCalled();
  expect(screen.getByLabelText("reportCenter")).toHaveValue("saved-center");
  const second = vi.fn();
  rerender(<InfectionAddressSelector value="saved-center" onChange={second} />);
  expect(second).not.toHaveBeenCalled();
  expect(screen.getByLabelText("reportCenter")).toHaveValue("saved-center");
});

it("clears dependent selections only when a parent selection changes", async () => {
  const onChange = vi.fn();
  const { rerender } = render(<InfectionAddressSelector onChange={onChange} />);
  await screen.findByRole("option", { name: "Province 1" });
  fireEvent.change(screen.getByLabelText("reportProvince"), {
    target: { value: "p1" },
  });
  await screen.findByRole("option", { name: "p1 district" });
  expect(onChange).toHaveBeenCalledExactlyOnceWith("");
  fireEvent.change(screen.getByLabelText("reportDistrict"), {
    target: { value: "p1-district" },
  });
  await screen.findByRole("option", { name: "p1-district center" });
  fireEvent.change(screen.getByLabelText("reportCenter"), {
    target: { value: "p1-district-center" },
  });
  expect(onChange).toHaveBeenLastCalledWith("p1-district-center");
  rerender(
    <InfectionAddressSelector value="p1-district-center" onChange={onChange} />,
  );
  fireEvent.change(screen.getByLabelText("reportProvince"), {
    target: { value: "p2" },
  });
  await screen.findByRole("option", { name: "p2 district" });
  expect(onChange).toHaveBeenLastCalledWith("");
  expect(screen.getByLabelText("reportDistrict")).toHaveValue("");
  expect(screen.getByLabelText("reportCenter")).toBeDisabled();
  expect(
    screen.queryByRole("option", { name: "p1-district center" }),
  ).not.toBeInTheDocument();
});

it("ignores a late district response from the previously selected province", async () => {
  let resolveOld!: (value: NamedReference[]) => void;
  const oldResponse = new Promise<NamedReference[]>((resolve) => {
    resolveOld = resolve;
  });
  const original = vi.mocked(addressChildren).getMockImplementation();
  if (!original) throw new Error("Expected address fixture implementation");
  vi.mocked(addressChildren).mockImplementation((level, parent) =>
    level === "districts" && parent === "p1"
      ? oldResponse
      : original(level, parent),
  );
  render(<InfectionAddressSelector onChange={vi.fn()} />);
  await screen.findByRole("option", { name: "Province 1" });
  fireEvent.change(screen.getByLabelText("reportProvince"), {
    target: { value: "p1" },
  });
  fireEvent.change(screen.getByLabelText("reportProvince"), {
    target: { value: "p2" },
  });
  await screen.findByRole("option", { name: "p2 district" });
  await act(async () => {
    resolveOld([{ uuid: "old", display: "Stale district" }]);
  });
  expect(
    screen.queryByRole("option", { name: "Stale district" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: "p2 district" }),
  ).toBeInTheDocument();
});

it("shows a lookup error and lets the user retry without clearing the saved center", async () => {
  vi.mocked(addressChildren).mockRejectedValueOnce(
    new Error("synthetic failure"),
  );
  const onChange = vi.fn();
  render(<InfectionAddressSelector value="saved-center" onChange={onChange} />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "retry" }));
  await screen.findByRole("option", { name: "Province 1" });
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByLabelText("reportCenter")).toHaveValue("saved-center");
});
