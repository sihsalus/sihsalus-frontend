import { ReportExport } from "./report-export.component";
import { Checkbox } from "@carbon/react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import { demographicPeriodLabel } from "./demographic-period";
import type { Catalogue, Report } from "./types";
import styles from "./dashboard.scss";

const zones = [
  { key: "success", color: "#a7f0ba" },
  { key: "safety", color: "#fff1b8" },
  { key: "alert", color: "#ffd9be" },
  { key: "epidemic", color: "#ffb3b8" },
] as const;

export function historyColor(year: number) {
  return `hsl(${(year * 137.508) % 360} 65% 35%)`;
}

export function caseAxisTicks(peak: number): number[] {
  const ceiling = Math.ceil(Math.max(1, peak) * 1.1);
  // At most six intervals, using whole-case steps from the 1–2–5 series.
  const roughStep = ceiling / 6;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const factor =
    [1, 2, 5, 10].find((value) => value * magnitude >= roughStep) ?? 10;
  const step = Math.max(1, factor * magnitude);
  return Array.from(
    { length: Math.ceil(ceiling / step) + 1 },
    (_, index) => index * step,
  );
}

export function endemicAxisLabel(
  date: string,
  period: string,
  calendar: Catalogue["catalog"],
) {
  const full = demographicPeriodLabel(
    { key: date, label: date },
    period,
    calendar,
  );
  return period === "dia"
    ? full.replace(/\/\d{4}$/, "")
    : full.replace(/^\d{4}-/, "");
}

export function EndemicChart({
  report,
  years,
  calendar,
}: {
  report: Report;
  years: number[];
  calendar: Catalogue["catalog"];
}) {
  const { t } = useTranslation(moduleName);
  const titleId = useId();
  const [showZones, setShowZones] = useState(true);
  const values = report.channel;
  const width = Math.max(800, values.length * 72 + 100);
  const height = 360,
    left = 65,
    right = 35,
    top = 25,
    bottom = 110;
  const peak = Math.max(
    1,
    ...values.flatMap((point) => [
      point.cases,
      point.q3 ?? 0,
      ...years.map((year) => point.historicalCases?.[year] ?? 0),
    ]),
  );
  const ticks = caseAxisTicks(peak);
  const maximum = ticks[ticks.length - 1];
  const x = (index: number) =>
    left + (index * (width - left - right)) / Math.max(1, values.length - 1);
  const y = (value: number) =>
    height - bottom - (value * (height - top - bottom)) / maximum;
  const label = (date: string) =>
    demographicPeriodLabel({ key: date, label: date }, report.period, calendar);
  const line = (points: (number | null)[]) => {
    let started = false;
    return points
      .map((value, index) => {
        if (value === null) {
          started = false;
          return "";
        }
        const command = started ? "L" : "M";
        started = true;
        return `${command}${x(index)},${y(value)}`;
      })
      .join(" ");
  };
  // Close each continuous band separately so missing quartiles remain gaps.
  const band = (zone: number) => {
    const paths: string[] = [];
    let segment: { index: number; lower: number; upper: number }[] = [];
    const close = () => {
      if (!segment.length) return;
      if (segment.length === 1) {
        const { index, lower, upper } = segment[0];
        const start = Math.max(left, x(index) - 6);
        const end = Math.min(width - right, x(index) + 6);
        paths.push(
          `M${start},${y(lower)} L${start},${y(upper)} L${end},${y(upper)} L${end},${y(lower)} Z`,
        );
      } else {
        paths.push(
          `${segment.map(({ index, upper }, i) => `${i ? "L" : "M"}${x(index)},${y(upper)}`).join(" ")} ${segment
            .reverse()
            .map(({ index, lower }) => `L${x(index)},${y(lower)}`)
            .join(" ")} Z`,
        );
      }
      segment = [];
    };
    values.forEach((point, index) => {
      if (point.q1 == null || point.q2 == null || point.q3 == null) {
        close();
        return;
      }
      const boundaries = [0, point.q1, point.q2, point.q3, maximum];
      segment.push({
        index,
        lower: boundaries[zone],
        upper: boundaries[zone + 1],
      });
    });
    close();
    return paths.join(" ");
  };
  return (
    <ReportExport
      kind="image"
      name="canal-endemico"
      title={t("endemicChannel")}
    >
      <figure className={styles.endemicChart}>
        <div className={styles.endemicControls} data-export-exclude>
          <Checkbox
            id={`${titleId}-legend`}
            labelText={t("endemic.showZones")}
            checked={showZones}
            onChange={(_, { checked }) => setShowZones(checked)}
          />
        </div>
        <div
          className={styles.chartScroll}
          data-export-scroll
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the chart.
          tabIndex={0}
          role="region"
          aria-label={t("endemicChannel")}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ minWidth: width }}
            role="img"
            aria-labelledby={titleId}
          >
            <title id={titleId}>{t("endemicChannel")}</title>
            <line
              x1={left}
              y1={top}
              x2={left}
              y2={height - bottom}
              stroke="currentColor"
            />
            <line
              x1={left}
              y1={height - bottom}
              x2={width - right}
              y2={height - bottom}
              stroke="currentColor"
            />
            <text
              transform={`translate(16 ${(height - bottom + top) / 2}) rotate(-90)`}
              textAnchor="middle"
            >
              {t("columns.cases")}
            </text>
            <text x={width / 2} y={height - 8} textAnchor="middle">
              {t(`endemic.axes.${report.period}`)}
            </text>
            {showZones &&
              zones.map((zone, index) => (
                <path
                  key={zone.key}
                  data-endemic-zone={zone.key}
                  d={band(index)}
                  fill={zone.color}
                  stroke="none"
                />
              ))}
            {ticks.map((value) => (
              <g key={value} data-case-tick={value}>
                {value > 0 && (
                  <line
                    x1={left}
                    x2={width - right}
                    y1={y(value)}
                    y2={y(value)}
                    stroke="#525252"
                    strokeOpacity="0.2"
                    strokeWidth="1"
                  />
                )}
                <line
                  x1={left - 4}
                  x2={left}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="currentColor"
                />
                <text x={left - 8} y={y(value) + 4} textAnchor="end">
                  {value}
                </text>
              </g>
            ))}
            <path
              d={line(values.map((point) => point.cases))}
              fill="none"
              stroke="#0f62fe"
              strokeWidth="3"
            />
            {years.map((year) => (
              <g key={year} data-history-year={year}>
                <path
                  d={line(
                    values.map(
                      (point) => point.historicalCases?.[year] ?? null,
                    ),
                  )}
                  fill="none"
                  stroke={historyColor(year)}
                  strokeWidth="2"
                />
                {values.map((point, index) =>
                  point.historicalCases?.[year] == null ? null : (
                    <circle
                      key={point.date}
                      cx={x(index)}
                      cy={y(point.historicalCases[year])}
                      r="3"
                      fill={historyColor(year)}
                    >
                      <title>
                        {`${year} · ${label(point.date)}: ${point.historicalCases[year]}`}
                      </title>
                    </circle>
                  ),
                )}
              </g>
            ))}
            {values.map((point, index) => (
              <g key={point.date}>
                <circle cx={x(index)} cy={y(point.cases)} r="3" fill="#0f62fe">
                  <title>{`${label(point.date)}: ${point.cases}`}</title>
                </circle>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={height - bottom}
                  y2={height - bottom + 5}
                  stroke="currentColor"
                />
                <text
                  transform={`translate(${x(index)} ${height - bottom + 15}) rotate(-45)`}
                  textAnchor="end"
                >
                  {endemicAxisLabel(point.date, report.period, calendar)}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <figcaption>{t(`reportDiagnoses.${report.diagnosisType}`)}</figcaption>
        {showZones && (
          <ul
            className={styles.zoneLegend}
            aria-label={t("endemic.zoneLegend")}
          >
            {zones.map((zone) => (
              <li key={zone.key}>
                <span style={{ backgroundColor: zone.color }} />
                {t(`endemic.zones.${zone.key}`)}
              </li>
            ))}
          </ul>
        )}
        {years.length > 0 && (
          <ul
            className={styles.historyLegend}
            aria-label={t("endemic.yearLegend")}
          >
            <li>
              <span style={{ backgroundColor: "#0f62fe" }} />
              {report.from.slice(0, 4)}
            </li>
            {years.map((year) => (
              <li key={year}>
                <span style={{ backgroundColor: historyColor(year) }} />
                {year}
              </li>
            ))}
          </ul>
        )}
      </figure>
    </ReportExport>
  );
}
