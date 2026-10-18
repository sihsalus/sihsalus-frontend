import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addressChildren, getReport, SurveillanceApiError } from "./api";
import { ReportPanel } from "./report-panel.component";
import { catalogue } from "./test-fixtures";
import en from "../translations/en.json";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      let value: unknown = en;
      for (const part of key.split("."))
        value = (value as Record<string, unknown>)?.[part];
      return typeof value === "string" ? value : (fallback ?? key);
    },
  }),
}));
vi.mock("@openmrs/esm-framework", () => ({
  getUserFacingErrorMessage: (
    error: { code?: string },
    fallback: string,
    options?: { codeMessages?: Record<string, string> },
  ) => options?.codeMessages?.[error.code ?? ""] ?? fallback,
  useConnectivity: () => true,
  useConfig: () => ({}),
  restBaseUrl: "/ws/rest/v1",
  fhirBaseUrl: "/ws/fhir2/R4",
}));
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  getReport: vi.fn(),
  addressChildren: vi.fn(),
}));
describe("report screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(addressChildren).mockImplementation(async (level) =>
      level === "provinces"
        ? [
            { uuid: "province", display: "Synthetic province" },
            { uuid: "province2", display: "Second province" },
          ]
        : level === "districts"
          ? [{ uuid: "district", display: "Synthetic district" }]
          : [{ uuid: "center", display: "Synthetic center" }],
    );
  });
  it("shows zero counts and unknown thresholds without inventing an epidemic level", async () => {
    vi.mocked(getReport).mockResolvedValue({
      generatedAt: "2026-01-20T00:00:00Z",
      eventUuid: "event",
      from: "2026-01-01",
      to: "2026-01-20",
      period: "semana",
      population: "CONFIRMADO",
      diagnosisType: "CONFIRMADO",
      zoneLevel: "CENTRO_POBLADO",
      address: null,
      total: 0,
      historicalYears: [2025, 2024],
      curve: [{ date: "2026-01-01", cases: 0 }],
      channel: [
        {
          date: "2026-01-01",
          year: 2026,
          number: 1,
          cases: 0,
          q1: null,
          q2: null,
          q3: null,
          sampleSize: 0,
          zone: "INSUFFICIENT_HISTORY",
        },
      ],
      demographics: {},
      warnings: ["INSUFFICIENT_HISTORY"],
    });
    render(<ReportPanel catalogue={catalogue} />);
    await screen.findByText("No cases match the selected filters.");
    expect(
      screen.queryByText("Demographic distribution"),
    ).not.toBeInTheDocument();
    expect(getReport).toHaveBeenLastCalledWith(
      "event",
      expect.any(String),
      expect.any(String),
      "semana",
      expect.any(AbortSignal),
      { zoneLevel: "CENTRO_POBLADO", diagnosisType: "CONFIRMADO", address: "" },
    );
    expect(
      screen.getByRole("columnheader", { name: "Period" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: en.columns.date }),
    ).toBeInTheDocument();
    expect(screen.getByText("S53", { selector: "td" })).toBeInTheDocument();
    expect(
      screen.getByText("01/01/2026", { selector: "td" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("2025-S53", { selector: "td" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Insufficient history")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Epidemic curve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Endemic channel" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Years to compare" }));
    fireEvent.click(await screen.findByText("2025"));
    expect(
      await screen.findByRole("list", { name: "Endemic channel years" }),
    ).toBeInTheDocument();
  });
  it("filters at every geographic level and clears descendants", async () => {
    vi.mocked(addressChildren).mockImplementation(async (level) => {
      const items = {
        departments: [{ uuid: "dep", display: "Test department" }],
        provinces: [{ uuid: "province", display: "Test province" }],
        districts: [{ uuid: "district", display: "Test district" }],
        "populated-centers": [{ uuid: "center", display: "Test center" }],
      };
      return items[level];
    });
    vi.mocked(getReport).mockRejectedValue(
      new SurveillanceApiError("SERVICE_UNAVAILABLE", 503),
    );
    render(<ReportPanel catalogue={catalogue} />);
    expect(screen.queryByLabelText("Geographic level")).not.toBeInTheDocument();
    const check = async (zoneLevel: string, address: string) =>
      waitFor(() => {
        expect(getReport).toHaveBeenLastCalledWith(
          "event",
          expect.any(String),
          expect.any(String),
          "semana",
          expect.any(AbortSignal),
          expect.objectContaining({ zoneLevel, address }),
        );
      });
    await check("CENTRO_POBLADO", "");
    for (const [label, option, value, zone] of [
      ["Department", "Test department", "dep", "DEPARTAMENTO"],
      ["Province", "Test province", "province", "PROVINCIA"],
      ["District", "Test district", "district", "DISTRITO"],
      ["Populated center", "Test center", "center", "CENTRO_POBLADO"],
    ]) {
      await screen.findByRole("option", { name: option });
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      await check(zone, value);
    }
    for (const [label, zone, address] of [
      ["Populated center", "DISTRITO", "district"],
      ["District", "PROVINCIA", "province"],
      ["Province", "DEPARTAMENTO", "dep"],
      ["Department", "CENTRO_POBLADO", ""],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
      await check(zone, address);
    }
    expect(screen.getByLabelText("Province")).toBeDisabled();
    expect(screen.getByLabelText("District")).toHaveValue("");
    expect(screen.getByLabelText("Populated center")).toHaveValue("");
    expect(addressChildren).toHaveBeenCalledWith("provinces", "dep");
  });
  it("renders an actionable error without raw backend details", async () => {
    vi.mocked(getReport).mockRejectedValue(
      new SurveillanceApiError("ACCESS_DENIED", 403),
    );
    render(<ReportPanel catalogue={catalogue} />);
    await screen.findByText(
      "Your account does not have permission for this action. Contact the administrator.",
    );
    expect(
      screen.queryByRole("img", { name: "Endemic channel" }),
    ).not.toBeInTheDocument();
  });
  it("explains that temporal dates must be in the current calendar year", async () => {
    vi.mocked(getReport).mockRejectedValue(
      new SurveillanceApiError("SERVICE_UNAVAILABLE", 503),
    );
    render(<ReportPanel catalogue={catalogue} />);
    const previousYear = new Date().getFullYear() - 1;
    fireEvent.change(screen.getByLabelText("Symptom onset from"), {
      target: { value: `01/01/${previousYear}` },
    });
    expect(
      await screen.findByText("Select dates within the current calendar year."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Could not complete the operation"),
    ).toBeInTheDocument();
  });
});
