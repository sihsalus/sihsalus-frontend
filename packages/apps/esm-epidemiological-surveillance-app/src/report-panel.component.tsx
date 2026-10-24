import { ReportExport } from "./report-export.component";
import { DateInput } from "./date-input.component";
import {
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  Tile,
  MultiSelect,
} from "@carbon/react";
import { useConfig, useConnectivity } from "@openmrs/esm-framework";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getReport, SurveillanceApiError } from "./api";
import { dateInZone } from "./case-form.utils";
import type { Config } from "./config-schema";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import type {
  Catalogue,
  Report,
  ReportDiagnosis,
  ReportZoneLevel,
} from "./types";
import { ReportAddressFilter } from "./report-address-filter.component";
import { EndemicChart, endemicAxisLabel } from "./endemic-chart.component";
import { displayDate } from "./date-display";
import styles from "./dashboard.scss";

export function ReportPanel({
  catalogue,
  locationUuid,
}: {
  catalogue: Catalogue;
  locationUuid?: string;
}) {
  const { t } = useTranslation(moduleName);
  const online = useConnectivity();
  const config = useConfig<Config>();
  const today = dateInZone(catalogue.catalog.timezone);
  const defaultStart = new Date(`${today}T12:00:00Z`);
  defaultStart.setUTCDate(
    defaultStart.getUTCDate() - (config.reportLookbackDays ?? 28) + 1,
  );
  const [event, setEvent] = useState(catalogue.events[0]?.uuid ?? "");
  const [from, setFrom] = useState(
    [
      defaultStart.toISOString().slice(0, 10),
      catalogue.catalog.surveillanceStartDate,
      `${today.slice(0, 4)}-01-01`,
    ]
      .sort()
      .at(-1) ?? today,
  );
  const [to, setTo] = useState(today);
  const [period, setPeriod] = useState(config.defaultReportPeriod ?? "semana");
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const [zoneLevel, setZoneLevel] = useState<ReportZoneLevel>("CENTRO_POBLADO");
  const [diagnosisType, setDiagnosisType] =
    useState<ReportDiagnosis>("CONFIRMADO");
  const [address, setAddress] = useState("");
  const [compareYears, setCompareYears] = useState<number[]>([]);
  const outsideYear = [from, to].some(
    (date) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      date.slice(0, 4) !== today.slice(0, 4),
  );
  const selectedYears = compareYears.filter((year) =>
    report?.historicalYears?.includes(year),
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reconnect must refresh the same selected report from the server.
  useEffect(() => {
    const abort = new AbortController();
    setReport(undefined);
    setError(undefined);
    setLoading(false);
    if (!event || !from || !to) return;
    if (outsideYear) {
      setError(new SurveillanceApiError("OUTSIDE_CURRENT_YEAR", 422));
      return;
    }
    if (from > to || to > today) return;
    setLoading(true);
    void getReport(event, from, to, period, abort.signal, {
      zoneLevel,
      diagnosisType,
      address,
    })
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
  }, [
    event,
    from,
    to,
    period,
    today,
    online,
    zoneLevel,
    diagnosisType,
    address,
    outsideYear,
  ]);
  return (
    <section className={styles.form} aria-label={t("temporalInformation")}>
      <h3>{t("filters")}</h3>
      <div className={styles.filters}>
        <Select
          id="report-event"
          labelText={t("fields.eventUuid")}
          value={event}
          onChange={(event) => setEvent(event.target.value)}
        >
          {catalogue.events.map((item) => (
            <SelectItem
              key={item.uuid}
              value={item.uuid}
              text={item.conceptDisplay ?? item.conceptUuid}
            />
          ))}
        </Select>
        <DateInput
          id="report-from"
          type="date"
          labelText={t("demographic.from")}
          value={from}
          min={catalogue.catalog.surveillanceStartDate}
          max={to}
          onChange={(event) => setFrom(event.target.value)}
        />
        <DateInput
          id="report-to"
          type="date"
          labelText={t("demographic.to")}
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
        <Select
          id="report-diagnosis"
          labelText={t("reportDiagnosisType")}
          value={diagnosisType}
          onChange={(event) =>
            setDiagnosisType(event.target.value as ReportDiagnosis)
          }
        >
          {(["CONFIRMADO", "PROBABLE", "TODOS"] as const).map((value) => (
            <SelectItem
              key={value}
              value={value}
              text={t(`reportDiagnoses.${value}`)}
            />
          ))}
        </Select>
        <MultiSelect
          id="report-years"
          titleText={t("endemic.compareYears")}
          label={t("selectOption")}
          items={report?.historicalYears ?? []}
          selectedItems={selectedYears}
          itemToString={(item) => (item == null ? "" : String(item))}
          onChange={({ selectedItems }) => setCompareYears(selectedItems ?? [])}
        />
        <ReportAddressFilter
          locationUuid={locationUuid}
          onChange={(address, level) => {
            setAddress(address);
            setZoneLevel(level);
          }}
        />
      </div>
      {!outsideYear && (from > to || to > today) ? (
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
              {t(`reportDiagnoses.${report.diagnosisType}`)}: {report.total}
            </h3>
            <p>
              {t("calculatedAt", "Calculated at")}:{" "}
              {new Date(report.generatedAt).toLocaleString("es-PE")}
            </p>
          </Tile>
          {report.warnings
            .filter(
              (code) =>
                !["INSUFFICIENT_HISTORY", "PARTIAL_PERIOD"].includes(code),
            )
            .map((code) => (
              <InlineNotification
                key={code}
                kind="info"
                lowContrast
                hideCloseButton
                title={t(`alerts.${code}`)}
              />
            ))}
          {report.total === 0 && (
            <p>
              {t("noSelectedCases", "No cases match the selected filters.")}
            </p>
          )}
          <EndemicChart
            report={report}
            years={selectedYears}
            calendar={catalogue.catalog}
          />
          <ReportExport
            kind="table"
            name="informacion-temporal"
            title={t("channelDetail")}
          >
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <caption>
                  {t("channelDetail", "Endemic channel detail")}
                </caption>
                <thead>
                  <tr>
                    {[
                      "period",
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
                      <td>
                        {endemicAxisLabel(
                          point.date,
                          report.period,
                          catalogue.catalog,
                        )}
                      </td>
                      <td>{displayDate(point.date)}</td>
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
          </ReportExport>
        </>
      )}
    </section>
  );
}
