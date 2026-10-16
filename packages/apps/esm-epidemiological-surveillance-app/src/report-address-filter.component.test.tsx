import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ReportAddressFilter } from "./report-address-filter.component";
import { locationAddressDefaults } from "./location-address.resource";
import { addressChildren } from "./api";
vi.mock("./api", () => ({ addressChildren: vi.fn() }));
vi.mock("./location-address.resource", () => ({
  locationAddressDefaults: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p>Error</p>,
}));
const selected = ["departments", "provinces", "districts", "populated-centers"];
const defaults = {
  selected,
  options: selected.map((name) => [{ uuid: name, display: name }]),
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(addressChildren).mockImplementation(async (level) => [
    { uuid: level, display: level },
  ]);
  vi.mocked(locationAddressDefaults).mockResolvedValue(defaults);
});
it("applies the location defaults and clears descendants on manual selection", async () => {
  const onChange = vi.fn();
  render(
    <ReportAddressFilter locationUuid="session-location" onChange={onChange} />,
  );
  await waitFor(() =>
    expect(onChange).toHaveBeenLastCalledWith(
      "populated-centers",
      "CENTRO_POBLADO",
    ),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("reportDepartment")).not.toBeDisabled(),
  );
  expect(screen.getByLabelText("reportCenter")).toHaveValue(
    "populated-centers",
  );
  fireEvent.change(screen.getByLabelText("reportProvince"), {
    target: { value: "" },
  });
  expect(onChange).toHaveBeenLastCalledWith("departments", "DEPARTAMENTO");
  expect(screen.getByLabelText("reportCenter")).toHaveValue("");
});
it("does not overwrite manual choices with late defaults", async () => {
  let resolve!: (value: typeof defaults) => void;
  vi.mocked(locationAddressDefaults).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const onChange = vi.fn();
  render(
    <ReportAddressFilter locationUuid="session-location" onChange={onChange} />,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("reportDepartment")).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText("reportDepartment"), {
    target: { value: "departments" },
  });
  resolve(defaults);
  await waitFor(() =>
    expect(screen.getByLabelText("reportProvince")).not.toBeDisabled(),
  );
  expect(screen.getByLabelText("reportCenter")).toHaveValue("");
  expect(onChange).toHaveBeenLastCalledWith("departments", "DEPARTAMENTO");
});
