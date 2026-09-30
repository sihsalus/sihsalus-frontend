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
const display = "Province → District → Center (1601010001)";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(searchInfectionAddresses).mockResolvedValue([
    { uuid: "center", display },
  ]);
});
it("searches directly and emits only the selected center UUID and label", async () => {
  const onChange = vi.fn();
  render(<InfectionAddressSelector onChange={onChange} />);
  expect(searchInfectionAddresses).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Province" },
  });
  fireEvent.click(await screen.findByRole("button", { name: display }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("center", display);
  expect(searchInfectionAddresses).toHaveBeenLastCalledWith(
    "Province",
    expect.any(AbortSignal),
  );
});
it("preserves the selection on remount until explicitly cleared", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <InfectionAddressSelector
      value="center"
      display={display}
      onChange={onChange}
    />,
  );
  rerender(
    <InfectionAddressSelector
      value="center"
      display={display}
      onChange={onChange}
    />,
  );
  expect(screen.getByText(display)).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "infectionChange" }));
  expect(onChange).toHaveBeenCalledWith("", "");
});
it("ignores late search results", async () => {
  let resolveOld!: (items: NamedReference[]) => void;
  vi.mocked(searchInfectionAddresses).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  render(<InfectionAddressSelector onChange={vi.fn()} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "old" } });
  await vi.waitFor(() => expect(searchInfectionAddresses).toHaveBeenCalled());
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "new" } });
  await screen.findByRole("button", { name: display });
  await act(async () => resolveOld([{ uuid: "old", display: "Stale" }]));
  expect(screen.queryByText("Stale")).not.toBeInTheDocument();
});
it("retries errors and shows empty results", async () => {
  vi.mocked(searchInfectionAddresses).mockRejectedValueOnce(
    new Error("synthetic"),
  );
  render(<InfectionAddressSelector onChange={vi.fn()} />);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Center" },
  });
  await screen.findByRole("alert");
  vi.mocked(searchInfectionAddresses).mockResolvedValueOnce([]);
  fireEvent.click(screen.getByRole("button", { name: "retry" }));
  await screen.findByText("infectionNoResults");
});
