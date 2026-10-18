import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { openmrsFetch } from "@openmrs/esm-framework";
import { read } from "./api";
import { EndemicSettings } from "./endemic-settings.component";
import {
  EndemicChart,
  endemicAxisLabel,
  caseAxisTicks,
} from "./endemic-chart.component";
import es from "../translations/es.json";
import { catalogue } from "./test-fixtures";
import type { Report } from "./types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@openmrs/esm-framework", () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: "/ws/rest/v1",
}));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  read: vi.fn(),
}));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p role="alert">error</p>,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(read).mockResolvedValue([5, 3]);
  vi.mocked(openmrsFetch).mockResolvedValue({ data: [8, 4] } as never);
});
it("preserves Spanish accents and omits years from each horizontal period label", () => {
  expect(es.endemic.compareYears).toBe("Años a comparar");
  expect(es.endemic.configure).toBe("Configurar canal endémico");
  expect(es.endemic.axes.semana).toBe("Semanas epidemiológicas");
  expect(JSON.stringify(es.endemic)).not.toMatch(/[?\uFFFD]/);
  for (const [period, label] of [
    ["dia", "01/01"],
    ["mes", "01"],
    ["trimestre", "T1"],
    ["semestre", "1"],
  ]) {
    expect(endemicAxisLabel("2026-01-01", period, catalogue.catalog)).toBe(
      label,
    );
  }
  expect(endemicAxisLabel("2026-08-23", "semana", catalogue.catalog)).toMatch(
    /^S\d{2}$/,
  );
});
it("loads saved settings, validates minimum and cancels without persistence", async () => {
  render(<EndemicSettings onSaved={vi.fn()} currentYear={2026} />);
  fireEvent.click(screen.getByRole("button", { name: "endemic.configure" }));
  const years = await screen.findByLabelText("endemic.historicalYears");
  expect(years).toHaveValue(5);
  fireEvent.change(years, { target: { value: "2" } });
  expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(openmrsFetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "endemic.configure" }));
  expect(await screen.findByLabelText("endemic.historicalYears")).toHaveValue(
    5,
  );
});
it("saves numeric settings and preserves the draft after a failed save", async () => {
  const saved = vi.fn();
  render(<EndemicSettings onSaved={saved} currentYear={2026} />);
  fireEvent.click(screen.getByRole("button", { name: "endemic.configure" }));
  fireEvent.change(await screen.findByLabelText("endemic.historicalYears"), {
    target: { value: "8" },
  });
  fireEvent.change(screen.getByLabelText("endemic.minimumYears"), {
    target: { value: "4" },
  });
  vi.mocked(openmrsFetch).mockRejectedValueOnce(new Error("synthetic"));
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await screen.findByText("error");
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByLabelText("endemic.historicalYears")).toHaveValue(8);
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(openmrsFetch).toHaveBeenLastCalledWith(
    expect.stringContaining("/configuration/endemic-channel"),
    expect.objectContaining({ method: "PUT", body: "[8,4]" }),
  );
});
it("labels every period and plots only selected historical years with gaps for absent data", () => {
  const report = {
    from: "2026-01-01",
    period: "mes",
    diagnosisType: "CONFIRMADO",
    channel: [1, 2, 3].map((number) => ({
      date: `2026-0${number}-01`,
      year: 2026,
      number,
      cases: number,
      q1: 1,
      q2: 2,
      q3: 3,
      historicalCases: number === 2 ? {} : { 2025: 50, 2024: 0 },
    })),
  } as Report;
  const { container, rerender } = render(
    <EndemicChart report={report} years={[]} calendar={catalogue.catalog} />,
  );
  expect(
    screen.queryByRole("list", { name: "endemic.yearLegend" }),
  ).not.toBeInTheDocument();
  for (const period of ["01", "02", "03"])
    expect(screen.getByText(period, { selector: "text" })).toBeInTheDocument();
  rerender(
    <EndemicChart
      report={report}
      years={[2025, 2024]}
      calendar={catalogue.catalog}
    />,
  );
  expect(
    screen.getByRole("list", { name: "endemic.yearLegend" }),
  ).toBeInTheDocument();
  const path = container.querySelector('[data-history-year="2025"] path');
  expect(path?.getAttribute("d")?.match(/M/g)).toHaveLength(2);
  expect(path?.getAttribute("d")).not.toContain("L");
  expect(screen.getByText("60", { selector: "text" })).toBeInTheDocument();
  expect(
    container.querySelector('[data-history-year="2024"] path'),
  ).not.toHaveAttribute("stroke", path?.getAttribute("stroke"));
  expect(screen.getByText("endemic.axes.mes")).toBeInTheDocument();
  expect(screen.getByText("columns.cases")).toBeInTheDocument();
});

it("uses uniform integer ticks with headroom for zero, small, fractional and large peaks", () => {
  expect(caseAxisTicks(0)).toEqual([0, 1, 2]);
  expect(caseAxisTicks(3)).toEqual([0, 1, 2, 3, 4]);
  expect(caseAxisTicks(23)).toEqual([0, 5, 10, 15, 20, 25, 30]);
  expect(caseAxisTicks(80)).toEqual([0, 20, 40, 60, 80, 100]);
  for (const peak of [0, 1, 2.5, 9, 23, 80, 240, 999, 10000, 2147483647]) {
    const ticks = caseAxisTicks(peak);
    expect(ticks[0]).toBe(0);
    expect(ticks.length).toBeLessThanOrEqual(7);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(Math.ceil(peak * 1.1));
    ticks.forEach((tick, i) => {
      expect(Number.isInteger(tick)).toBe(true);
      if (i > 0) expect(tick - ticks[i - 1]).toBe(ticks[1]);
    });
  }
});

it("toggles the zone legend and shading together while preserving case curves and gaps in quartiles", () => {
  const report: Report = {
    generatedAt: "2026-05-31",
    eventUuid: "synthetic",
    to: "2026-05-31",
    population: "CONFIRMADO",
    zoneLevel: "DEPARTAMENTO",
    address: null,
    total: 15,
    curve: [],
    demographics: {},
    warnings: [],
    from: "2026-01-01",
    period: "mes",
    diagnosisType: "CONFIRMADO",
    channel: [1, 2, 3, 4, 5].map((n) => ({
      date: `2026-0${n}-01`,
      year: 2026,
      number: n,
      sampleSize: n === 3 ? 0 : 5,
      zone: n === 3 ? "INSUFFICIENT_HISTORY" : "ALERT",
      cases: n,
      q1: n === 3 ? null : 1,
      q2: n === 3 ? null : 2,
      q3: n === 3 ? null : 3,
      historicalCases: { 2025: n + 1 },
    })),
  };
  const { container } = render(
    <EndemicChart
      report={report}
      years={[2025]}
      calendar={catalogue.catalog}
    />,
  );
  const bands = container.querySelectorAll("[data-endemic-zone]");
  const ticks = container.querySelectorAll("[data-case-tick]");
  expect(ticks.length).toBeGreaterThan(2);
  expect(
    container.querySelector('[data-case-tick="2"] text'),
  ).toHaveTextContent("2");
  const grid = container.querySelector('[data-case-tick="2"] line');
  expect(grid).toHaveAttribute("stroke-opacity", "0.2");
  expect(bands).toHaveLength(4);
  for (const band of bands) {
    expect(band.getAttribute("d")?.match(/Z/g)).toHaveLength(2);
    expect(band).toHaveAttribute("stroke", "none");
    expect(band.getAttribute("d")).not.toMatch(/NaN|undefined/);
  }
  expect(
    screen.getByRole("list", { name: "endemic.zoneLegend" }).children,
  ).toHaveLength(4);
  const curves = Array.from(
    container.querySelectorAll('path[fill="none"]'),
    (p) => p.getAttribute("d"),
  );
  expect(curves).toHaveLength(2);
  fireEvent.click(screen.getByLabelText("endemic.showZones"));
  expect(
    screen.queryByRole("list", { name: "endemic.zoneLegend" }),
  ).not.toBeInTheDocument();

  expect(container.querySelectorAll("[data-endemic-zone]")).toHaveLength(0);
  expect(container.querySelectorAll("[data-case-tick]")).toHaveLength(
    ticks.length,
  );
  expect(
    Array.from(container.querySelectorAll('path[fill="none"]'), (p) =>
      p.getAttribute("d"),
    ),
  ).toEqual(curves);
  fireEvent.click(screen.getByLabelText("endemic.showZones"));
  expect(
    screen.getByRole("list", { name: "endemic.zoneLegend" }),
  ).toBeInTheDocument();
  expect(container.querySelectorAll("[data-endemic-zone]")).toHaveLength(4);
});
