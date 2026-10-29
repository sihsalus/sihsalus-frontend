import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InvestigationFormsPanel } from "./investigation-forms.component";
import { downloadBlob } from "./report-export";
import {
  fetchInvestigationForm,
  investigationForms,
} from "./investigation-forms";
import es from "../translations/es.json";

vi.mock("./report-export", () => ({ downloadBlob: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string; count?: number }) => {
      const value = key
        .split(".")
        .reduce<unknown>(
          (node, part) =>
            node && typeof node === "object"
              ? (node as Record<string, unknown>)[part]
              : undefined,
          es,
        );
      return String(value ?? key)
        .replace("{{name}}", options?.name ?? "")
        .replace("{{count}}", String(options?.count ?? ""));
    },
  }),
}));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const pdfResponse = () =>
  new Response("%PDF-1.7\nsynthetic", {
    headers: { "Content-Type": "application/pdf" },
  });

it("downloads each bundled PDF with a descriptive filename and offers an official source", async () => {
  fetchMock.mockImplementation(async () => pdfResponse());
  render(<InvestigationFormsPanel />);
  expect(screen.getAllByRole("link", { name: "Fuente oficial" })).toHaveLength(
    28,
  );
  screen.getAllByRole("link", { name: "Fuente oficial" }).forEach((link, index) => {
    expect(link).toHaveAttribute("href", investigationForms[index].source);
    expect(new URL(investigationForms[index].source).protocol).toBe("https:");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
  for (const [index, button] of screen
    .getAllByRole("button", { name: /Descargar ficha/ })
    .entries()) {
    fireEvent.click(button);
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(index + 1));
    expect(downloadBlob).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "application/pdf" }),
      `ficha-investigacion-${investigationForms[index].id}.pdf`,
    );
  }
});

it("finds requested diseases by accent-insensitive names, abbreviations and multiple terms", () => {
  render(<InvestigationFormsPanel />);
  const search = screen.getByRole("searchbox", {
    name: "Buscar fichas por enfermedad o evento",
  });
  for (const [query, expected] of [
    ["autopsia verbal", "Muerte materna: autopsia verbal"],
    ["varicela sin", "Varicela sin complicaciones"],
    ["rabia humana", "Rabia humana"],
    ["  TBC  ", "Tuberculosis (TBC)"],
    ["sarampion", "Sarampión y rubéola"],
    ["PARALISIS FLACIDA", "Parálisis flácida aguda (PFA)"],
    ["hepatitis c", "Hepatitis B, D y C"],
    ["vih gestantes", "VIH en gestantes y niños expuestos"],
    ["neumonia mayores", "Muerte por IRA o neumonía: mayores de 60 años"],
  ]) {
    fireEvent.change(search, { target: { value: query } });
    expect(
      screen.getByRole("heading", { name: expected, level: 4 }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Descargar ficha/ }),
    ).toHaveLength(1);
  }
  fireEvent.change(search, { target: { value: "no-existing-event" } });
  expect(
    screen.getByText("No se encontraron fichas. Prueba otro nombre o sigla."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Descargar ficha/ })).toBeNull();
  fireEvent.change(search, { target: { value: "" } });
  expect(
    screen.getAllByRole("button", { name: /Descargar ficha/ }),
  ).toHaveLength(28);
  expect(screen.getByRole("status")).toHaveTextContent("28 fichas disponibles");
});

it("prevents duplicate downloads, preserves other downloads and allows retry after failure", async () => {
  let reject!: (reason: Error) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }),
  );
  render(<InvestigationFormsPanel />);
  const buttons = screen.getAllByRole("button", { name: /Descargar ficha/ });
  fireEvent.click(buttons[0]);
  expect(buttons[0]).toBeDisabled();
  expect(buttons[1]).toBeEnabled();
  fireEvent.click(buttons[0]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  reject(new Error("synthetic network failure"));
  await screen.findByText("No se pudo descargar la ficha");
  expect(downloadBlob).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(pdfResponse());
  fireEvent.click(buttons[0]);
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce());
  expect(screen.queryByText("No se pudo descargar la ficha")).toBeNull();
});

it("rejects HTTP errors and HTML fallback pages instead of saving an invalid PDF", async () => {
  for (const response of [
    new Response("missing", { status: 404 }),
    new Response("<!doctype html>"),
  ]) {
    fetchMock.mockResolvedValueOnce(response);
    await expect(fetchInvestigationForm("/synthetic.pdf")).rejects.toThrow();
  }
});
