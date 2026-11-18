import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeographicMap } from "./geographic-map.component";
import { GeographicPanel } from "./geographic-panel.component";
import { getGeography, type GeographicReport } from "./geographic.resource";
import { catalogue } from "./test-fixtures";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));
vi.mock("@openmrs/esm-framework", () => ({
  useConnectivity: () => true,
  restBaseUrl: "/ws/rest/v1",
  openmrsFetch: vi.fn(),
}));
vi.mock("./geographic.resource", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./geographic.resource")>()),
  getGeography: vi.fn(),
}));
vi.mock("./report-address-filter.component", () => ({
  ReportAddressFilter: ({ onChange }: { onChange: (value: string, level: string) => void }) => (
    <button type="button" onClick={() => onChange("district", "DISTRITO")}>
      Choose territory
    </button>
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
const columnsFor: Record<string, { key: string; label: string }[]> = {
  period: [{ key: "2026-01-01", label: "2026-01-01" }],
  ageGroup: [
    { key: "INFANTS", label: "INFANTS" },
    { key: "CHILDREN", label: "Niños" },
  ],
  ethnicity: [
    { key: "MESTIZO", label: "Mestizo" },
    { key: "UNKNOWN", label: "UNKNOWN" },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGeography).mockImplementation(async (filters) => {
    const column = (filters as { column: string }).column;
    const columns = columnsFor[column] ?? [];
    return {
      ...report,
      table:
        column === "origin"
          ? undefined
          : {
              row: "center",
              column,
              period: "mes",
              from: report.from,
              to: report.to,
              generatedAt: report.from,
              rows: [{ key: "1", label: "1" }],
              columns,
              values: [columns.map(() => 1)],
              rowTotals: [columns.length],
              columnTotals: columns.map(() => 1),
              total: columns.length,
              excludedWithoutOnset: 0,
              ageGroups: [{ key: "INFANTS", minAge: 0, maxAge: 1 }],
            },
    } as GeographicReport;
  });
});

describe("geographic panel boundaries", () => {
  it("labels period, age group and other breakdowns and applies every filter", async () => {
    render(
      <GeographicPanel
        catalogue={{
          ...catalogue,
          events: [...catalogue.events, { ...catalogue.events[0], uuid: "event-2", conceptDisplay: "Other event" }],
        }}
      />,
    );
    await screen.findByRole("table");
    const column = screen.getByLabelText("demographic.column");
    fireEvent.change(column, { target: { value: "period" } });
    await screen.findByRole("columnheader", { name: "2026-01" });
    fireEvent.change(column, { target: { value: "ageGroup" } });
    await screen.findByRole("columnheader", { name: "INFANTS (0\u20131)" });
    expect(screen.getByRole("columnheader", { name: "Niños (\u2013\u221e)" })).toBeInTheDocument();
    fireEvent.change(column, { target: { value: "ethnicity" } });
    await screen.findByRole("columnheader", { name: "Mestizo" });
    expect(screen.getByRole("columnheader", { name: "demographic.unknown" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("fields.eventUuid"), { target: { value: "event-2" } });
    fireEvent.change(screen.getByLabelText("demographic.from"), { target: { value: "05/01/2026" } });
    fireEvent.change(screen.getByLabelText("demographic.to"), { target: { value: "31/01/2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose territory" }));
    await waitFor(() =>
      expect(getGeography).toHaveBeenLastCalledWith(
        expect.objectContaining({
          event: "event-2",
          from: "2026-01-05",
          to: "2026-01-31",
          address: "district",
          zoneLevel: "DISTRITO",
        }),
        expect.any(AbortSignal),
      ),
    );
  });

  it("retries after a failed geographic report", async () => {
    vi.mocked(getGeography).mockRejectedValueOnce(new Error("offline"));
    render(<GeographicPanel catalogue={catalogue} />);
    expect(await screen.findByText("Safe error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});

describe("geographic map interactions", () => {
  it("zooms, pans, drags, recovers tiles and selects a focus", () => {
    render(<GeographicMap report={report} />);
    for (const name of ["geo.zoomIn", "geo.zoomOut"])
      fireEvent.click(screen.getByRole("button", { name }));
    for (const name of ["geo.west", "geo.east", "geo.north", "geo.south", "geo.fit"])
      fireEvent.click(screen.getByRole("button", { name }));
    const map = screen.getByRole("img", { name: "geo.mapTitle" }) as unknown as SVGSVGElement;
    Object.assign(map, {
      setPointerCapture: vi.fn(),
      getBoundingClientRect: () => ({ width: 800, height: 480, top: 0, left: 0, right: 800, bottom: 480 }),
    });
    fireEvent.pointerMove(map, { clientX: 5, clientY: 5 });
    fireEvent.pointerDown(map, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(map, { clientX: 30, clientY: 40 });
    fireEvent.pointerUp(map);
    fireEvent.pointerDown(map, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerCancel(map);
    expect(map.setPointerCapture).toHaveBeenCalledTimes(2);
    const tile = map.querySelector("image");
    if (!tile) throw new Error("Missing map tile");
    act(() => {
      fireEvent.error(tile);
    });
    expect(screen.getByRole("status")).toHaveTextContent("geo.tileError");
    fireEvent.click(screen.getByRole("button", { name: "Synthetic center A: 3" }));
    expect(screen.getAllByText(/Synthetic center A/).length).toBeGreaterThan(1);
  });
});
