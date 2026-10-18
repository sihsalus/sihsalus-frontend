export type ExportCell = string | number;

// Read the consolidated table, including its footer, in displayed column order.
export function tableRows(table: HTMLTableElement): ExportCell[][] {
  return Array.from(table.rows, (row) =>
    Array.from(row.cells, (cell) => {
      const text = cell.textContent?.trim() ?? "";
      return cell.tagName === "TD" && /^-?\d+(\.\d+)?$/.test(text)
        ? Number(text)
        : text;
    }),
  );
}

export function csvContent(rows: ExportCell[][]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            // Spreadsheet applications must not execute labels as formulas.
            const text =
              typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(value)
                ? `'${value}`
                : String(value);
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\r\n")
  );
}

export async function tableBlob(rows: ExportCell[][], format: "xlsx" | "csv") {
  if (format === "csv")
    return new Blob([csvContent(rows)], { type: "text/csv;charset=utf-8" });
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Report");
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
  return new Blob([await workbook.xlsx.writeBuffer()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image read failed"));
    reader.readAsDataURL(blob);
  });
}

export async function imageBlob(element: HTMLElement, format: "png" | "jpg") {
  const { toCanvas } = await import("html-to-image");
  const clone = element.cloneNode(true) as HTMLElement;
  const width = Math.max(
    element.clientWidth,
    ...Array.from(
      element.querySelectorAll<HTMLElement>("[data-export-scroll]"),
      (node) => node.scrollWidth,
    ),
  );
  clone.style.width = `${width}px`;
  clone.style.maxWidth = "none";
  clone
    .querySelectorAll<HTMLElement>("[data-export-scroll]")
    .forEach((node) => {
      node.style.overflow = "visible";
      node.style.maxWidth = "none";
      node.style.width = "100%";
      node.scrollLeft = 0;
    });
  clone.querySelectorAll("[data-export-exclude]").forEach((node) => {
    node.remove();
  });
  // Freeze the clicked viewport and embed its tiles. Fail rather than silently
  // downloading a map with missing base imagery (including CORS/network errors).
  await Promise.all(
    Array.from(clone.querySelectorAll("image"), async (node) => {
      const href = node.getAttribute("href");
      if (!href || href.startsWith("data:")) return;
      const response = await fetch(href, {
        credentials: "omit",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Map tile unavailable");
      node.setAttribute("href", await dataUrl(await response.blob()));
    }),
  );
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-100000px;top:0;pointer-events:none;";
  host.append(clone);
  document.body.append(host);
  try {
    const canvas = await toCanvas(clone, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      skipFonts: true,
    });
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Image export failed")),
        format === "jpg" ? "image/jpeg" : "image/png",
        0.95,
      ),
    );
  } finally {
    host.remove();
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
