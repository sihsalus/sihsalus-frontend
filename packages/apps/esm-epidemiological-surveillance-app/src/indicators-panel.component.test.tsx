import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { read } from "./api";
import { IndicatorsPanel } from "./indicators-panel.component";
import { catalogue } from "./test-fixtures";

vi.mock("./api", () => ({ apiBase: "/surveillance", read: vi.fn() }));
vi.mock("@openmrs/esm-framework", () => ({ useConnectivity: () => true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (key: string, args?: { numerator: number; denominator: number }) =>
      args ? `${args.numerator} of ${args.denominator} cases` : key,
  }),
}));
vi.mock("./report-address-filter.component", () => ({
  ReportAddressFilter: ({
    onChange,
  }: {
    onChange: (address: string, level: string) => void;
  }) => (
    <button type="button" onClick={() => onChange("district", "DISTRITO")}>
      Choose territory
    </button>
  ),
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p>Error</p>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(read).mockImplementation(async (url) => ({
    indicator: new URL(String(url), "https://example.test").searchParams.get(
      "indicator",
    ),
    numerator: 1,
    denominator: 4,
    percentage: 25,
  }));
});
it("shares one case filter while keeping fatality limited to confirmed cases", async () => {
  render(<IndicatorsPanel catalogue={catalogue} />);
  expect(await screen.findAllByText("25%")).toHaveLength(3);
  expect(screen.getAllByText("1 of 4 cases")).toHaveLength(3);
  expect(screen.getAllByLabelText("reportDiagnosisType")).toHaveLength(1);
  expect(screen.queryByText(/indicatorPanel\..*Help/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("reportDiagnosisType"), {
    target: { value: "TODOS" },
  });
  await waitFor(() =>
    expect(read).toHaveBeenCalledWith(
      expect.stringContaining("indicator=completeness&diagnosisType=TODOS"),
      expect.any(AbortSignal),
    ),
  );
  await waitFor(() =>
    expect(read).toHaveBeenCalledWith(
      expect.stringContaining("indicator=timeliness&diagnosisType=TODOS"),
      expect.any(AbortSignal),
    ),
  );
  fireEvent.click(screen.getByText("Choose territory"));
  await waitFor(() =>
    expect(read).toHaveBeenCalledWith(
      expect.stringContaining(
        "zoneLevel=DISTRITO&address=district&indicator=fatality&diagnosisType=CONFIRMADO",
      ),
      expect.any(AbortSignal),
    ),
  );
});
it("does not display zero percent for an empty denominator", async () => {
  vi.mocked(read).mockResolvedValue({
    numerator: 0,
    denominator: 0,
    percentage: null,
  });
  render(<IndicatorsPanel catalogue={catalogue} />);
  expect(await screen.findAllByText("indicatorPanel.noCases")).toHaveLength(3);
  expect(screen.queryByText("0%")).not.toBeInTheDocument();
});
it("retries failed calculations", async () => {
  vi.mocked(read).mockRejectedValueOnce(new Error("synthetic"));
  render(<IndicatorsPanel catalogue={catalogue} />);
  fireEvent.click(await screen.findByText("retry"));
  await waitFor(() => expect(screen.getAllByText("25%")).toHaveLength(3));
});
