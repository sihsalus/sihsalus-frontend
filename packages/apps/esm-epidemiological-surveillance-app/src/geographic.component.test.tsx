import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { GeographicMap } from "./geographic-map.component";
import {
  GeographicPanel,
  geographicCenterLabel,
  validGeographicRange,
} from "./geographic-panel.component";
import { GeographicSettings } from "./geographic-settings.component";
import {
  getGeography,
  getRiskThresholds,
  importCoordinates,
  saveRiskThresholds,
  validRiskThresholds,
  type GeographicReport,
} from "./geographic.resource";
import { catalogue } from "./test-fixtures";

it("omits only the selected territorial ancestors from center labels", () => {
  const label = "Loreto → Maynas → Napo → Centro de prueba";
  expect(geographicCenterLabel(label, "", "DEPARTAMENTO")).toBe(label);
  expect(geographicCenterLabel(label, "department", "DEPARTAMENTO")).toBe(
    "Maynas → Napo → Centro de prueba",
  );
  expect(geographicCenterLabel(label, "province", "PROVINCIA")).toBe(
    "Napo → Centro de prueba",
  );
  expect(geographicCenterLabel(label, "district", "DISTRITO")).toBe(
    "Centro de prueba",
  );
  expect(geographicCenterLabel(label, "", "CENTRO_POBLADO")).toBe(label);
  expect(
    geographicCenterLabel("Centro de prueba", "district", "DISTRITO"),
  ).toBe("Centro de prueba");
});
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@openmrs/esm-framework", () => ({
  useConnectivity: () => true,
  restBaseUrl: "/ws/rest/v1",
  openmrsFetch: vi.fn(),
}));
vi.mock("./geographic.resource", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./geographic.resource")>()),
  getGeography: vi.fn(),
  getRiskThresholds: vi.fn(),
  importCoordinates: vi.fn(),
  saveRiskThresholds: vi.fn(),
}));
vi.mock("./report-address-filter.component", () => ({
  ReportAddressFilter: ({ includeCenter }: { includeCenter: boolean }) => (
    <p>{includeCenter ? "center selector" : "district selector"}</p>
  ),
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p role="alert">Safe error</p>,
}));
const report: GeographicReport = {
  from: "2026-01-01",
  to: "2026-01-31",
  referenceYear: 2026,
  total: 4,
  unmappedCases: 1,
  riskThresholds: [10, 20, 50],
  foci: [
    {
      centerId: 1,
      label: "Synthetic center A",
      total: 3,
      latitude: -3,
      longitude: -73,
      lastAutochthonousYear: 2024,
      classification: "RESIDUAL",
      risk: "LOW",
      origins: { AUTOCTONO: 1, INTRODUCIDO: 2 },
    },
    {
      centerId: 2,
      label: "Synthetic center B",
      total: 1,
      latitude: null,
      longitude: null,
      lastAutochthonousYear: null,
      classification: "ELIMINATED",
      risk: "LOW",
      origins: { IMPORTADO_NACIONAL: 1 },
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGeography).mockResolvedValue(report);
  vi.mocked(getRiskThresholds).mockResolvedValue([10, 20, 50]);
  vi.mocked(saveRiskThresholds).mockResolvedValue([10, 20, 50]);
});
it("selects geographic columns without disease and renders the breakdown by center", async () => {
  render(<GeographicPanel catalogue={catalogue} />);
  await screen.findByRole("table");
  const selector = screen.getByLabelText("demographic.column");
  expect(
    within(selector)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value),
  ).toEqual([
    "age",
    "sex",
    "ageGroup",
    "ethnicity",
    "pregnancy",
    "period",
    "origin",
  ]);
  expect(selector).toHaveValue("origin");
  vi.mocked(getGeography).mockResolvedValue({
    ...report,
    table: {
      row: "center",
      column: "sex",
      period: "mes",
      from: report.from,
      to: report.to,
      generatedAt: report.from,
      rows: [
        { key: "2", label: "2" },
        { key: "1", label: "1" },
      ],
      columns: [
        { key: "F", label: "F" },
        { key: "M", label: "M" },
        { key: "UNKNOWN", label: "UNKNOWN" },
      ],
      values: [
        [1, 0, 0],
        [1, 2, 0],
      ],
      rowTotals: [1, 3],
      columnTotals: [2, 2, 0],
      total: 4,
      excludedWithoutOnset: 0,
      ageGroups: [],
    },
  });
  fireEvent.change(selector, { target: { value: "sex" } });
  await screen.findByRole("columnheader", { name: "demographic.values.F" });
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(
    within(rows[1])
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["1", "2", "0", "3"]);
  expect(
    within(rows[2])
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["1", "0", "0", "1"]);
  fireEvent.click(screen.getByLabelText("geo.hideZero"));
  expect(
    screen.queryByRole("columnheader", { name: "demographic.unknown" }),
  ).not.toBeInTheDocument();
  expect(getGeography).toHaveBeenLastCalledWith(
    expect.objectContaining({ column: "sex" }),
    expect.any(AbortSignal),
  );
});
it("offers period types and rejects a response without the requested breakdown", async () => {
  render(<GeographicPanel catalogue={catalogue} />);
  await screen.findByRole("table");
  fireEvent.change(screen.getByLabelText("demographic.column"), {
    target: { value: "period" },
  });
  const period = screen.getByLabelText("demographic.periodType");
  expect(within(period).getAllByRole("option")).toHaveLength(6);
  fireEvent.change(period, { target: { value: "semana" } });
  await screen.findByRole("alert");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(getGeography).toHaveBeenLastCalledWith(
    expect.objectContaining({ column: "period", period: "semana" }),
    expect.any(AbortSignal),
  );
});
it("keeps at least one legend and uses the specified fallback color and shape", () => {
  render(<GeographicMap report={report} />);
  const risk = screen.getByLabelText("geo.riskLegend");
  const classification = screen.getByLabelText("geo.classificationLegend");
  const marker = screen.getByRole("button", { name: "Synthetic center A: 3" });
  expect(marker.querySelector("path")).toHaveAttribute("fill", "#24a148");
  expect(
    screen.queryByRole("button", { name: "Synthetic center B: 1" }),
  ).not.toBeInTheDocument();
  fireEvent.click(risk);
  expect(classification).toBeDisabled();
  expect(marker.querySelector("path")).toHaveAttribute("fill", "#da1e28");
  fireEvent.click(risk);
  fireEvent.click(classification);
  expect(risk).toBeDisabled();
  expect(marker.querySelector("circle")).toHaveAttribute("fill", "#24a148");
});
it("rejects cross-year windows and invalid risk boundaries", () => {
  expect(validGeographicRange("2025-12-31", "2026-01-01", "2026-02-01")).toBe(
    false,
  );
  expect(validGeographicRange("2026-01-31", "2026-01-01", "2026-02-01")).toBe(
    false,
  );
  expect(validGeographicRange("2026-01-01", "2026-02-02", "2026-02-01")).toBe(
    false,
  );
  expect(validGeographicRange("2026-01-01", "2026-02-01", "2026-02-01")).toBe(
    true,
  );
  for (const bounds of [
    ["1", "20", "50"],
    ["10", "10", "50"],
    ["10.1", "20", "50"],
    ["10", "20", "2147483648"],
  ])
    expect(validRiskThresholds(bounds)).toBe(false);
  expect(validRiskThresholds(["10", "20", "50"])).toBe(true);
});
it("renders the center by origin table and percentages including centers without coordinates", async () => {
  render(<GeographicPanel catalogue={catalogue} />);
  await screen.findByRole("table");
  expect(screen.getByText("center selector")).toBeInTheDocument();
  expect(screen.getByLabelText("geo.referenceYear")).toBeDisabled();
  expect(
    screen.getByText("Synthetic center A: 3 (75.0%)", { selector: "li" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Synthetic center B: 1 (25.0%)", { selector: "li" }),
  ).toBeInTheDocument();
  expect(screen.getByText("geo.unmapped")).toBeInTheDocument();
});
it("refreshes geography with the selected included case types", async () => {
  render(<GeographicPanel catalogue={catalogue} />);
  await screen.findByRole("table");
  const filter = screen.getByLabelText("reportDiagnosisType");
  expect(filter).toHaveValue("CONFIRMADO");
  expect(getGeography).toHaveBeenLastCalledWith(
    expect.objectContaining({ diagnosisType: "CONFIRMADO" }),
    expect.any(AbortSignal),
  );
  for (const diagnosisType of ["PROBABLE", "TODOS"]) {
    vi.mocked(getGeography).mockResolvedValue({
      ...report,
      total: 0,
      foci: [],
    });
    fireEvent.change(filter, { target: { value: diagnosisType } });
    await waitFor(() =>
      expect(getGeography).toHaveBeenLastCalledWith(
        expect.objectContaining({ diagnosisType }),
        expect.any(AbortSignal),
      ),
    );
    await screen.findByText("geo.empty");
    expect(
      screen.queryByRole("button", { name: "Synthetic center A: 3" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Synthetic center A: 3 (75.0%)"),
    ).not.toBeInTheDocument();
  }
});

it("cancels risk changes without saving and reloads saved values on reopening", async () => {
  render(<GeographicSettings onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "geo.configureRisk" }));
  fireEvent.change(await screen.findByLabelText("geo.risk.MEDIUM"), {
    target: { value: "12" },
  });
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(saveRiskThresholds).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "geo.configureRisk" }));
  expect(await screen.findByLabelText("geo.risk.MEDIUM")).toHaveValue(10);
});
it("preserves settings when saving fails and reports no success", async () => {
  vi.mocked(saveRiskThresholds).mockRejectedValueOnce(new Error("synthetic"));
  const onSaved = vi.fn();
  render(<GeographicSettings onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: "geo.configureRisk" }));
  fireEvent.change(await screen.findByLabelText("geo.risk.MEDIUM"), {
    target: { value: "12" },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await screen.findByText("Safe error");
  expect(screen.getByLabelText("geo.risk.MEDIUM")).toHaveValue(12);
  expect(onSaved).not.toHaveBeenCalled();
});
it("uploads the chosen CSV only on Save", async () => {
  const onSaved = vi.fn();
  vi.mocked(importCoordinates).mockResolvedValue({
    imported: 1,
    matched: 0,
    pending: 1,
  });
  render(<GeographicSettings onSaved={onSaved} />);
  fireEvent.click(
    screen.getByRole("button", { name: "geo.configureCoordinates" }),
  );
  const csv = "address_hierarchy_entry_id,latitude,longitude\n00123,-3,-73";
  fireEvent.change(screen.getByLabelText("geo.csvFile"), {
    target: { files: [{ text: async () => csv }] },
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "save" })).toBeEnabled(),
  );
  expect(importCoordinates).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(importCoordinates).toHaveBeenCalledWith(csv);
  expect(
    screen.getByText("geo.coordinatesSaved geo.coordinatesPending"),
  ).toBeInTheDocument();
});
