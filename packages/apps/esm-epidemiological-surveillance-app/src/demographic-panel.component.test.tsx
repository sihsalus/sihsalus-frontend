import { addressChildren } from "./api";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  DemographicPanel,
  visibleDemographicAxes,
} from "./demographic-panel.component";
import { getDemographics } from "./demographic.resource";
import type { DemographicReport } from "./demographic.types";
import { catalogue } from "./test-fixtures";
import en from "../translations/en.json";
import { demographicPeriodLabel } from "./demographic-period";

const periodExamples = [
  ["dia", "2026-02-04", "04/02/2026"],
  ["semana", "2026-03-22", "2026-S12"],
  ["mes", "2026-02-01", "2026-02"],
  ["trimestre", "2026-01-01", "2026-T1"],
  ["semestre", "2026-07-01", "2026-2"],
  ["anio", "2026-01-01", "2026"],
];

it.each(["row", "column"] as const)(
  "formats all period labels on the %s axis",
  async (axis) => {
    vi.mocked(getDemographics).mockImplementation(async (filters) => {
      const key =
        periodExamples.find(([period]) => period === filters.period)?.[1] ??
        "2026-01-01";
      return {
        ...result,
        row: axis === "row" ? "period" : "sex",
        column: axis === "column" ? "period" : "sex",
        period: filters.period ?? "mes",
        rows: [{ key: axis === "row" ? key : "F", label: key }],
        columns: [{ key: axis === "column" ? key : "F", label: key }],
        values: [[2]],
        rowTotals: [2],
        columnTotals: [2],
      };
    });
    render(<DemographicPanel catalogue={catalogue} />);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText(axis === "row" ? "Row" : "Column"), {
      target: { value: "period" },
    });
    for (const [period, , expected] of periodExamples) {
      fireEvent.change(screen.getByLabelText("Period type"), {
        target: { value: period },
      });
      await screen.findByRole(axis === "row" ? "rowheader" : "columnheader", {
        name: expected,
      });
    }
  },
);

it.each([
  ["2025-12-28", "2025-S53"],
  ["2026-01-04", "2026-S01"],
  ["2026-12-27", "2026-S52"],
  ["2027-01-03", "2027-S01"],
])("uses epidemiological week years for %s", (key, expected) => {
  expect(
    demographicPeriodLabel({ key, label: key }, "semana", catalogue.catalog),
  ).toBe(expected);
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      let value: unknown = en;
      for (const part of key.split("."))
        value = (value as Record<string, unknown>)?.[part];
      return typeof value === "string" ? value : key;
    },
  }),
}));
vi.mock("@openmrs/esm-framework", () => ({ useConnectivity: () => true }));
vi.mock("./api", () => ({ addressChildren: vi.fn().mockResolvedValue([]) }));
vi.mock("./demographic.resource", () => ({ getDemographics: vi.fn() }));
vi.mock("./error-notification.component", () => ({
  ErrorNotification: () => <p role="alert">Safe error</p>,
}));
vi.mock("@carbon/react", async (original) => ({
  ...(await original<typeof import("@carbon/react")>()),
  MultiSelect: ({
    titleText,
    items,
    selectedItems,
    onChange,
  }: {
    titleText: string;
    items: { uuid: string; conceptDisplay: string }[];
    selectedItems: { uuid: string }[];
    onChange: (value: {
      selectedItems: { uuid: string; conceptDisplay: string }[];
    }) => void;
  }) => (
    <select
      multiple
      aria-label={titleText}
      value={selectedItems.map((item) => item.uuid)}
      onChange={(event) =>
        onChange({
          selectedItems: items.filter((item) =>
            Array.from(event.target.selectedOptions).some(
              (option) => option.value === item.uuid,
            ),
          ),
        })
      }
    >
      {items.map((item) => (
        <option key={item.uuid} value={item.uuid}>
          {item.conceptDisplay}
        </option>
      ))}
    </select>
  ),
}));
const result: DemographicReport = {
  row: "ageGroup",
  column: "sex",
  period: "mes",
  from: "2026-01-01",
  to: "2026-01-31",
  generatedAt: "2026-01-31T12:00:00Z",
  rows: [
    { key: "INFANTS", label: "INFANTS" },
    { key: "CHILDREN", label: "CHILDREN" },
    { key: "UNKNOWN", label: "UNKNOWN" },
  ],
  columns: [
    { key: "F", label: "F" },
    { key: "M", label: "M" },
    { key: "UNKNOWN", label: "UNKNOWN" },
  ],
  values: [
    [0, 0, 0],
    [2, 0, 0],
    [0, 0, 0],
  ],
  rowTotals: [0, 2, 0],
  columnTotals: [2, 0, 0],
  total: 2,
  excludedWithoutOnset: 0,
  ageGroups: [
    { key: "INFANTS", minAge: 0, maxAge: 1 },
    { key: "CHILDREN", minAge: 2, maxAge: 11 },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDemographics).mockResolvedValue(result);
});
it("shows row and column filters but only shows period type when needed", async () => {
  render(<DemographicPanel catalogue={catalogue} />);
  await screen.findByRole("table");
  expect(screen.getAllByRole("columnheader")[0]).toHaveTextContent(
    "Age group / Sex",
  );
  expect(screen.getByText("Filters")).toBeInTheDocument();
  expect(screen.queryByLabelText("Period type")).not.toBeInTheDocument();
  expect(vi.mocked(getDemographics).mock.calls[0][0]).not.toHaveProperty(
    "period",
  );
  fireEvent.change(screen.getByLabelText("Row"), {
    target: { value: "period" },
  });
  fireEvent.change(screen.getByLabelText("Period type"), {
    target: { value: "anio" },
  });
  await waitFor(() =>
    expect(getDemographics).toHaveBeenLastCalledWith(
      expect.objectContaining({ row: "period", period: "anio" }),
      expect.any(AbortSignal),
    ),
  );
});
it("clears and locks the single event and sends selected comparison diseases", async () => {
  render(<DemographicPanel catalogue={catalogue} />);
  await screen.findByRole("table");
  fireEvent.change(screen.getByLabelText("Column"), {
    target: { value: "disease" },
  });
  const single = screen.getByLabelText(en.fields.eventUuid);
  expect(single).toBeDisabled();
  expect(single).toHaveValue("");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  const multiple = screen.getByLabelText(
    "Diseases to compare",
  ) as HTMLSelectElement;
  multiple.options[0].selected = true;
  fireEvent.change(multiple);
  await waitFor(() =>
    expect(getDemographics).toHaveBeenLastCalledWith(
      expect.objectContaining({ compareEvents: "event", column: "disease" }),
      expect.any(AbortSignal),
    ),
  );
  expect(vi.mocked(getDemographics).mock.calls.at(-1)?.[0]).not.toHaveProperty(
    "event",
  );
  fireEvent.change(screen.getByLabelText("Column"), {
    target: { value: "sex" },
  });
  expect(single).toBeEnabled();
  expect(single).toHaveValue("");
  expect(
    screen.queryByLabelText("Diseases to compare"),
  ).not.toBeInTheDocument();
});
it("hides only all-zero rows and columns without changing totals", async () => {
  expect(visibleDemographicAxes(result, true)).toEqual({
    rows: [1],
    columns: [0],
  });
  render(<DemographicPanel catalogue={catalogue} />);
  await screen.findByText("Infants (0–1)");
  fireEvent.click(
    screen.getByLabelText("Hide rows and columns whose values are all 0"),
  );
  expect(screen.queryByText("Infants (0–1)")).not.toBeInTheDocument();
  expect(screen.getByText("Children (2–11)")).toBeInTheDocument();
  expect(
    screen.queryByRole("columnheader", { name: "Male" }),
  ).not.toBeInTheDocument();
});
it("retains filters on failure and supports retry", async () => {
  vi.mocked(getDemographics).mockRejectedValueOnce(new Error("synthetic"));
  render(<DemographicPanel catalogue={catalogue} />);
  await screen.findByText("Safe error");
  expect(screen.getByLabelText("Row")).toHaveValue("ageGroup");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("table");
  expect(getDemographics).toHaveBeenCalledTimes(2);
});

it("applies the geographic selection and clears it when changing level", async () => {
  vi.mocked(addressChildren).mockImplementation(async (level) =>
    level === "provinces"
      ? [{ uuid: "province", display: "Test province" }]
      : level === "districts"
        ? [{ uuid: "district", display: "Test district" }]
        : [{ uuid: "center", display: "Test center" }],
  );
  render(<DemographicPanel catalogue={catalogue} />);
  await screen.findByText("Test province");
  fireEvent.change(screen.getByLabelText("Province"), {
    target: { value: "province" },
  });
  await screen.findByText("Test district");
  fireEvent.change(screen.getByLabelText("District"), {
    target: { value: "district" },
  });
  await screen.findByText("Test center");
  fireEvent.change(screen.getByLabelText("Populated center"), {
    target: { value: "center" },
  });
  await waitFor(() =>
    expect(getDemographics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        zoneLevel: "CENTRO_POBLADO",
        address: "center",
      }),
      expect.any(AbortSignal),
    ),
  );
  fireEvent.change(screen.getByLabelText("Geographic level"), {
    target: { value: "DISTRITO" },
  });
  await waitFor(() =>
    expect(getDemographics).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoneLevel: "DISTRITO", address: "" }),
      expect.any(AbortSignal),
    ),
  );
  expect(screen.queryByLabelText("Populated center")).not.toBeInTheDocument();
});

it("allows date ranges longer than two years", async () => {
  render(<DemographicPanel catalogue={catalogue} />);
  await screen.findByRole("table");
  fireEvent.change(screen.getByLabelText(en.demographic.from), {
    target: { value: "17/09/2023" },
  });
  fireEvent.change(screen.getByLabelText(en.demographic.to), {
    target: { value: "13/10/2026" },
  });
  await waitFor(() =>
    expect(getDemographics).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2023-09-17", to: "2026-10-13" }),
      expect.any(AbortSignal),
    ),
  );
});
