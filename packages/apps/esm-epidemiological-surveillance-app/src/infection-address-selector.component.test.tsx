import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { searchInfectionAddresses } from "./infection-address.resource";
import { InfectionAddressSelector } from "./infection-address-selector.component";
import type { NamedReference } from "./types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./infection-address.resource", () => ({
  searchInfectionAddresses: vi.fn(),
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <div role="alert">Lookup failed</div>,
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(searchInfectionAddresses).mockImplementation(async (level) =>
    level === "stateProvince"
      ? [{ uuid: "province", display: "Province" }]
      : level === "countyDistrict"
        ? [{ uuid: "district", display: "Province → District" }]
        : [{ uuid: "center", display: "Province → District → Center" }],
  );
});
it("uses one field, navigates the hierarchy and emits only the center UUID", async () => {
  const onChange = vi.fn();
  render(<InfectionAddressSelector onChange={onChange} />);
  expect(screen.getAllByRole("searchbox")).toHaveLength(1);
  fireEvent.click(await screen.findByRole("button", { name: "Province" }));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(
    await screen.findByRole("button", { name: "Province → District" }),
  );
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(
    await screen.findByRole("button", { name: "Province → District → Center" }),
  );
  expect(onChange).toHaveBeenCalledExactlyOnceWith(
    "center",
    "Province → District → Center",
  );
  expect(searchInfectionAddresses).toHaveBeenLastCalledWith(
    "cityVillage",
    "district",
    "",
    expect.any(AbortSignal),
  );
});
it("preserves an existing selection through remount and callback changes until explicitly cleared", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <InfectionAddressSelector
      value="center"
      display="Province → District → Center"
      onChange={onChange}
    />,
  );
  rerender(
    <InfectionAddressSelector
      value="center"
      display="Province → District → Center"
      onChange={onChange}
    />,
  );
  expect(screen.getByText("Province → District → Center")).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  expect(searchInfectionAddresses).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "infectionChange" }));
  expect(onChange).toHaveBeenCalledWith("", "");
});
it("ignores a late result after a search changes", async () => {
  let resolveOld!: (items: NamedReference[]) => void;
  vi.mocked(searchInfectionAddresses).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  render(<InfectionAddressSelector onChange={vi.fn()} />);
  await vi.waitFor(() => expect(searchInfectionAddresses).toHaveBeenCalled());
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "new" } });
  await screen.findByRole("button", { name: "Province" });
  await act(async () => resolveOld([{ uuid: "old", display: "Stale" }]));
  expect(screen.queryByText("Stale")).not.toBeInTheDocument();
});
it("shows safe errors, supports retry and displays empty results", async () => {
  vi.mocked(searchInfectionAddresses).mockRejectedValueOnce(
    new Error("synthetic failure"),
  );
  render(<InfectionAddressSelector onChange={vi.fn()} />);
  await screen.findByRole("alert");
  vi.mocked(searchInfectionAddresses).mockResolvedValueOnce([]);
  fireEvent.click(screen.getByRole("button", { name: "retry" }));
  await screen.findByText("infectionNoResults");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
