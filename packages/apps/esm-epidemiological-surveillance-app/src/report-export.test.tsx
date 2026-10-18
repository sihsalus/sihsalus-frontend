import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Workbook } from "exceljs";
import { csvContent, tableBlob, tableRows } from "./report-export";
import { ReportExport } from "./report-export.component";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("consolidated report exports", () => {
  it("includes headings, numeric cells, missing values and totals in displayed order", () => {
    const table = document.createElement("table");
    table.innerHTML =
      "<thead><tr><th>Centro</th><th>Casos</th></tr></thead><tbody><tr><th>001</th><td>0</td></tr><tr><th>Sin dato</th><td>—</td></tr></tbody><tfoot><tr><th>Total</th><td>0</td></tr></tfoot>";
    expect(tableRows(table)).toEqual([
      ["Centro", "Casos"],
      ["001", 0],
      ["Sin dato", "—"],
      ["Total", 0],
    ]);
  });
  it("writes UTF-8 CSV with escaped separators, quotes, newlines and inert formula labels", () => {
    expect(
      csvContent([["Etnía", 'a,"b"\nc', "=1+1", " +SUM(A1)", -2, 0]]),
    ).toBe('\uFEFF"Etnía","a,""b""\nc","\'=1+1","\' +SUM(A1)","-2","0"');
  });
  it("produces a real XLSX preserving numbers and literal text", async () => {
    const blob = await tableBlob(
      [
        ["Centro", "Casos"],
        ["001", 12],
        ["=1+1", 0],
      ],
      "xlsx",
    );
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob);
    });
    const workbook = new Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell("A2").value).toBe("001");
    expect(sheet.getCell("B2").value).toBe(12);
    expect(sheet.getCell("A3").value).toBe("=1+1");
    expect(sheet.getCell("B3").value).toBe(0);
  });
  it("reports export failures without exposing technical errors and allows retry", async () => {
    render(
      <ReportExport kind="table" name="report" title="Consolidated table">
        <p>No table</p>
      </ReportExport>,
    );
    expect(screen.queryByRole("menuitem")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "export.open" }));
    expect(screen.getByRole("menuitem", { name: "export.xlsx" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "export.csv" }));
    await waitFor(() => expect(screen.getByText("export.failed")).toBeTruthy());
    expect(screen.queryByText("Missing table")).toBeNull();
    expect(
      (screen.getByRole("button", { name: "export.open" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
  it("reveals both image formats from the Export menu beside the title", () => {
    render(
      <ReportExport kind="image" name="chart" title="Chart">
        <svg />
      </ReportExport>,
    );
    expect(screen.getByRole("heading", { name: "Chart" })).toBeTruthy();
    expect(screen.queryByRole("menuitem")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "export.open" }));
    expect(screen.getByRole("menuitem", { name: "export.png" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "export.jpg" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "export.csv" })).toBeNull();
  });
});
