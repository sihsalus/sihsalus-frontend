import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EndemicChart } from "./endemic-chart.component";
import { ReportExport } from "./report-export.component";
import { downloadBlob, imageBlob } from "./report-export";
import { catalogue } from "./test-fixtures";
import type { Report } from "./types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./report-export", async (original) => ({
  ...(await original<typeof import("./report-export")>()),
  imageBlob: vi.fn(async () => new Blob(["png"])),
  downloadBlob: vi.fn(),
}));

describe("report export and endemic chart boundaries", () => {
  it("exports the rendered chart as an image", async () => {
    render(
      <ReportExport kind="image" name="chart" title="Chart">
        <svg />
      </ReportExport>,
    );
    fireEvent.click(screen.getByRole("button", { name: "export.open" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "export.png" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(imageBlob).toHaveBeenCalledWith(expect.any(HTMLDivElement), "png");
  });

  it("draws an isolated quartile period as a narrow band", () => {
    const report = {
      from: "2026-01-01",
      period: "mes",
      diagnosisType: "CONFIRMADO",
      channel: [1, 2, 3].map((number) => ({
        date: `2026-0${number}-01`,
        year: 2026,
        number,
        cases: number,
        q1: number === 2 ? 1 : null,
        q2: number === 2 ? 2 : null,
        q3: number === 2 ? 3 : null,
      })),
    } as Report;
    const { container } = render(<EndemicChart report={report} years={[]} calendar={catalogue.catalog} />);
    expect(container.innerHTML).toMatch(/Z/);
  });
});
