import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, imageBlob } from "./report-export";

const toCanvas = vi.fn();
vi.mock("html-to-image", () => ({ toCanvas: (...args: unknown[]) => toCanvas(...args) }));

function exportable() {
  const element = document.createElement("div");
  element.innerHTML =
    '<div data-export-scroll style="overflow:auto"></div><button data-export-exclude>Exportar</button>' +
    '<svg><image href="https://tiles.example/1.png"></image><image href="data:image/png;base64,AA=="></image><image></image></svg>';
  document.body.append(element);
  return element;
}

function canvas(blob: Blob | null) {
  return { toBlob: (callback: (value: Blob | null) => void) => callback(blob) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
  toCanvas.mockReset();
});

describe("image export", () => {
  it("embeds remote map tiles, removes excluded controls and cleans up the offscreen host", async () => {
    const fetchTile = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["tile"], { type: "image/png" }) });
    vi.stubGlobal("fetch", fetchTile);
    const image = new Blob(["png"]);
    toCanvas.mockImplementation(async (clone: HTMLElement) => {
      expect(clone.querySelector("[data-export-exclude]")).toBeNull();
      expect((clone.querySelector("[data-export-scroll]") as HTMLElement).style.overflow).toBe("visible");
      expect(clone.querySelector("image")?.getAttribute("href")).toMatch(/^data:/);
      return canvas(image);
    });
    await expect(imageBlob(exportable(), "png")).resolves.toBe(image);
    expect(fetchTile).toHaveBeenCalledTimes(1);
    expect(fetchTile).toHaveBeenCalledWith("https://tiles.example/1.png", expect.objectContaining({ credentials: "omit" }));
    expect(document.body.children).toHaveLength(1);
  });

  it("fails instead of exporting a map without its base tiles", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(imageBlob(exportable(), "png")).rejects.toThrow("Map tile unavailable");
    expect(toCanvas).not.toHaveBeenCalled();
  });

  it("reports unreadable tiles and failed JPG rendering", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["tile"]) }));
    vi.stubGlobal(
      "FileReader",
      class {
        onerror: () => void = () => undefined;
        readAsDataURL() {
          this.onerror();
        }
      },
    );
    await expect(imageBlob(exportable(), "jpg")).rejects.toThrow("Image read failed");
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    const element = document.createElement("div");
    toCanvas.mockResolvedValue(canvas(null));
    await expect(imageBlob(element, "jpg")).rejects.toThrow("Image export failed");
    expect(document.body.children).toHaveLength(0);
  });

  it("downloads through a temporary link and releases the object URL later", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn().mockReturnValue("blob:synthetic");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    downloadBlob(new Blob(["x"]), "reporte.csv");
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector("a")).toBeNull();
    vi.advanceTimersByTime(60000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic");
  });
});
