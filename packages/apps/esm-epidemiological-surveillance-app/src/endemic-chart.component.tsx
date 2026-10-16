import { useId } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import { demographicPeriodLabel } from "./demographic-period";
import type { Catalogue, Report } from "./types";
import styles from "./dashboard.scss";

export function historyColor(year: number) {
  return `hsl(${(year * 137.508) % 360} 65% 35%)`;
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
  const values = report.channel;
  const width = Math.max(800, values.length * 72 + 100);
  const height = 360,
    left = 65,
    right = 35,
    top = 25,
    bottom = 110;
  const maximum = Math.max(
    1,
    ...values.flatMap((point) => [
      point.cases,
      point.q3 ?? 0,
      ...years.map((year) => point.historicalCases?.[year] ?? 0),
    ]),
  );
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
  return (
    <figure className={styles.endemicChart}>
      <div
        className={styles.chartScroll}
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
          <text x={left - 8} y={top + 4} textAnchor="end">
            {maximum}
          </text>
          <text x={left - 8} y={height - bottom} textAnchor="end">
            0
          </text>
          <text
            transform={`translate(16 ${(height - bottom + top) / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            {t("columns.cases")}
          </text>
          <text x={width / 2} y={height - 8} textAnchor="middle">
            {t(`endemic.axes.${report.period}`)}
          </text>
          {(["q1", "q2", "q3"] as const).map((key, index) => (
            <path
              key={key}
              d={line(values.map((point) => point[key]))}
              fill="none"
              stroke={["#198038", "#b28600", "#da1e28"][index]}
              strokeWidth="2"
              strokeDasharray={["3 3", "8 3", "12 3"][index]}
            />
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
                  values.map((point) => point.historicalCases?.[year] ?? null),
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
      <figcaption>
        {t(`reportDiagnoses.${report.diagnosisType}`)} · Q1 (25%) · Q2 (50%) ·
        Q3 (75%)
      </figcaption>
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
  );
}
