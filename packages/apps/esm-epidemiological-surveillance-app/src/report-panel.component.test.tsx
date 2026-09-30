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
    expect(screen.getByText("Insufficient history")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Epidemic curve" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Endemic channel" }),
    ).toBeInTheDocument();
  });
  it("sends selected diagnosis and zone and clears an address when parents change", async () => {
    vi.mocked(getReport).mockRejectedValue(
      new SurveillanceApiError("SERVICE_UNAVAILABLE", 503),
    );
    render(<ReportPanel catalogue={catalogue} />);
    await screen.findByRole("option", { name: "Synthetic province" });
    fireEvent.change(screen.getByLabelText("Province"), {
      target: { value: "province" },
    });
    await screen.findByRole("option", { name: "Synthetic district" });
    fireEvent.change(screen.getByLabelText("District"), {
      target: { value: "district" },
    });
    await screen.findByRole("option", { name: "Synthetic center" });
    fireEvent.change(screen.getByLabelText("Populated center"), {
      target: { value: "center" },
    });
    fireEvent.change(screen.getByLabelText("Included cases"), {
      target: { value: "TODOS" },
    });
    await waitFor(() =>
      expect(getReport).toHaveBeenLastCalledWith(
        "event",
        expect.any(String),
        expect.any(String),
        "semana",
        expect.any(AbortSignal),
        {
          zoneLevel: "CENTRO_POBLADO",
          diagnosisType: "TODOS",
          address: "center",
        },
      ),
    );
    fireEvent.change(screen.getByLabelText("Province"), {
      target: { value: "province2" },
    });
    await waitFor(() =>
      expect(getReport).toHaveBeenLastCalledWith(
        "event",
        expect.any(String),
        expect.any(String),
        "semana",
        expect.any(AbortSignal),
        { zoneLevel: "CENTRO_POBLADO", diagnosisType: "TODOS", address: "" },
      ),
    );
    fireEvent.change(screen.getByLabelText("Geographic level"), {
      target: { value: "DISTRITO" },
    });
    await screen.findByRole("option", { name: "Synthetic province" });
    fireEvent.change(screen.getByLabelText("Province"), {
      target: { value: "province" },
    });
    await screen.findByRole("option", { name: "Synthetic district" });
    fireEvent.change(screen.getByLabelText("District"), {
      target: { value: "district" },
    });
    await waitFor(() =>
      expect(getReport).toHaveBeenLastCalledWith(
        "event",
        expect.any(String),
        expect.any(String),
        "semana",
        expect.any(AbortSignal),
        { zoneLevel: "DISTRITO", diagnosisType: "TODOS", address: "district" },
      ),
    );
    expect(screen.queryByLabelText("Populated center")).not.toBeInTheDocument();
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
});
