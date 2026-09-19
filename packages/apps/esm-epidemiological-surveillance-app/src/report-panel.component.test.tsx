import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReport, SurveillanceApiError } from "./api";
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
}));
describe("report screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("shows zero counts and unknown thresholds without inventing an epidemic level", async () => {
    vi.mocked(getReport).mockResolvedValue({
      generatedAt: "2026-01-20T00:00:00Z",
      eventUuid: "event",
      from: "2026-01-01",
      to: "2026-01-20",
      period: "semana",
      population: "CONFIRMED",
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
    await screen.findByText("No confirmed cases in this period.");
    expect(screen.getByText("Insufficient history")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Epidemic curve" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Endemic channel" }),
    ).toBeInTheDocument();
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
