import {
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  TextInput,
  Tile,
} from "@carbon/react";
import { useConfig, useConnectivity } from "@openmrs/esm-framework";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { getReport } from "./api";
import { dateInZone } from "./case-form.utils";
import type { Config } from "./config-schema";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import type { Catalogue, Report } from "./types";
import styles from "./dashboard.scss";

function SeriesChart({
  report,
  channel,
}: {
  report: Report;
  channel?: boolean;
}) {
  const { t } = useTranslation(moduleName);
  const titleId = useId();
  const values = channel ? report.channel : report.curve;
  const width = 800;
  const height = 240;
  const pad = 28;
  const maximum = Math.max(
    1,
    ...values.map((point) => point.cases),
    ...(channel ? report.channel.map((point) => point.q3 ?? 0) : []),
  );
  const x = (index: number) =>
    pad + (index * (width - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (value: number) =>
    height - pad - (value * (height - 2 * pad)) / maximum;
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
    <figure className={styles.chart}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          {channel
            ? t("endemicChannel", "Endemic channel")
            : t("epidemicCurve", "Epidemic curve")}
        </title>
        <line
          x1={pad}
          y1={pad}
          x2={pad}
          y2={height - pad}
          stroke="currentColor"
        />
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="currentColor"
        />
        <text x={2} y={pad}>
          {maximum}
        </text>
        <text x={6} y={height - pad}>
          0
        </text>
        {channel &&
          (["q1", "q2", "q3"] as const).map((key, index) => (
            <path
              key={key}
              d={line(report.channel.map((point) => point[key]))}
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
        {values.map((point, index) => (
          <circle
            key={point.date}
            cx={x(index)}
            cy={y(point.cases)}
            r="3"
            fill="#0f62fe"
          >
            <title>
              {point.date}: {point.cases}
            </title>
          </circle>
        ))}
        <text x={pad} y={height - 3}>
          {values[0]?.date}
        </text>
        <text x={width - pad} y={height - 3} textAnchor="end">
          {values.at(-1)?.date}
        </text>
      </svg>
      <figcaption>
        {t("confirmedCases", "Confirmed cases")}
        {channel ? " · Q1 (25%) · Q2 (50%) · Q3 (75%)" : ""}
      </figcaption>
    </figure>
  );
}
export function ReportPanel({ catalogue }: { catalogue: Catalogue }) {
  const { t } = useTranslation(moduleName);
  const online = useConnectivity();
  const config = useConfig<Config>();
  const today = dateInZone(catalogue.metadata.timezone);
  const defaultStart = new Date(`${today}T12:00:00Z`);
  defaultStart.setUTCDate(
    defaultStart.getUTCDate() - (config.reportLookbackDays ?? 28) + 1,
  );
  const [event, setEvent] = useState(catalogue.events[0]?.uuid ?? "");
  const [from, setFrom] = useState(
    [
      defaultStart.toISOString().slice(0, 10),
      catalogue.metadata.surveillanceStartDate,
    ]
      .sort()
      .at(-1) ?? today,
  );
  const [to, setTo] = useState(today);
  const [period, setPeriod] = useState(config.defaultReportPeriod ?? "semana");
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const [dimension, setDimension] = useState("ageGroup");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reconnect must refresh the same selected report from the server.
  useEffect(() => {
    const abort = new AbortController();
    setReport(undefined);
    setError(undefined);
    if (!event || !from || !to || from > to || to > today) return;
    setLoading(true);
    void getReport(event, from, to, period, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setReport(value);
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [event, from, to, period, today, online]);
  return (
    <section className={styles.form} aria-label={t("indicators", "Indicators")}>
      <div className={styles.filters}>
        <Select
          id="report-event"
          labelText={t("fields.eventUuid")}
          value={event}
          onChange={(event) => setEvent(event.target.value)}
        >
          {catalogue.events.map((item) => (
            <SelectItem key={item.uuid} value={item.uuid} text={item.name} />
          ))}
        </Select>
        <TextInput
          id="report-from"
          type="date"
          labelText={t("from", "From")}
          value={from}
          min={catalogue.metadata.surveillanceStartDate}
          max={to}
          onChange={(event) => setFrom(event.target.value)}
        />
        <TextInput
          id="report-to"
          type="date"
          labelText={t("to", "To")}
          value={to}
          min={from}
          max={today}
          onChange={(event) => setTo(event.target.value)}
        />
        <Select
          id="report-period"
          labelText={t("period", "Period")}
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          {["dia", "semana", "mes", "trimestre", "semestre"].map((value) => (
            <SelectItem
              key={value}
              value={value}
              text={t(`periods.${value}`)}
            />
          ))}
        </Select>
      </div>
      {from > to || to > today ? (
        <InlineNotification
          kind="error"
          hideCloseButton
          title={t("errors.INVALID_DATE_RANGE")}
        />
      ) : null}
      {!online && (
        <InlineNotification
          kind="warning"
          hideCloseButton
          title={t("offline", "Offline")}
          subtitle={t(
            "cachedReportNotice",
            "Previously downloaded reports may be shown. Their calculation date is displayed below.",
          )}
        />
      )}
      {loading && <InlineLoading description={t("loading", "Loading")} />}
      {error ? <ErrorNotification error={error} /> : null}
      {report && (
        <>
          <Tile>
            <h3>
              {t("confirmedCases", "Confirmed cases")}: {report.total}
            </h3>
            <p>
              {t("calculatedAt", "Calculated at")}:{" "}
              {new Date(report.generatedAt).toLocaleString()}
            </p>
          </Tile>
          {report.warnings.map((code) => (
            <InlineNotification
              key={code}
              kind="info"
              lowContrast
              hideCloseButton
              title={t(`alerts.${code}`)}
            />
          ))}
          {report.total === 0 && (
            <p>{t("noCases", "No confirmed cases in this period.")}</p>
          )}
          <h3>{t("epidemicCurve", "Epidemic curve")}</h3>
          <SeriesChart report={report} />
          <h3>{t("endemicChannel", "Endemic channel")}</h3>
          <SeriesChart report={report} channel />
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <caption>{t("channelDetail", "Endemic channel detail")}</caption>
              <thead>
                <tr>
                  {[
                    "date",
                    "cases",
                    "q1",
                    "q2",
                    "q3",
                    "historyYears",
                    "zone",
                  ].map((key) => (
                    <th key={key} scope="col">
                      {t(`columns.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.channel.map((point) => (
                  <tr key={point.date}>
                    <td>{point.date}</td>
                    <td>{point.cases}</td>
                    <td>{point.q1 ?? "—"}</td>
                    <td>{point.q2 ?? "—"}</td>
                    <td>{point.q3 ?? "—"}</td>
                    <td>{point.sampleSize}</td>
                    <td>
                      <span className={styles.zone} data-zone={point.zone}>
                        {t(`zones.${point.zone}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>{t("dailyDetail", "View daily counts")}</summary>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("columns.date")}</th>
                  <th scope="col">{t("columns.cases")}</th>
                </tr>
              </thead>
              <tbody>
                {report.curve.map((point) => (
                  <tr key={point.date}>
                    <td>{point.date}</td>
                    <td>{point.cases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <h3>{t("demographics", "Demographic distribution")}</h3>
          <Select
            id="demographic-dimension"
            labelText={t("groupBy", "Group by")}
            value={dimension}
            onChange={(event) => setDimension(event.target.value)}
          >
            {[
              "age",
              "ageGroup",
              "sex",
              "disease",
              "ethnicity",
              "pregnancy",
              "period",
            ].map((value) => (
              <SelectItem
                key={value}
                value={value}
                text={t(`dimensions.${value}`)}
              />
            ))}
          </Select>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t(`dimensions.${dimension}`)}</th>
                <th scope="col">{t("columns.cases")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.demographics[dimension] ?? {}).map(
                ([key, count]) => (
                  <tr key={key}>
                    <td>
                      {key === "UNKNOWN"
                        ? t("unknown", "Unknown")
                        : dimension === "disease"
                          ? catalogue.events.find((event) => event.uuid === key)
                              ?.name
                          : dimension === "pregnancy"
                            ? t(`yesNo.${key}`)
                            : dimension === "sex"
                              ? t(`sexValues.${key}`, key)
                              : key}
                    </td>
                    <td>{count}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
