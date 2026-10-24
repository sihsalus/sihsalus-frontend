import { ReportExport } from "./report-export.component";
import { DateInput } from "./date-input.component";
import {
  Button,
  Checkbox,
  InlineLoading,
  InlineNotification,
  MultiSelect,
  Select,
  SelectItem,
} from "@carbon/react";
import { useConnectivity } from "@openmrs/esm-framework";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { dateInZone } from "./case-form.utils";
import { moduleName } from "./constants";
import { getDemographics } from "./demographic.resource";
import { demographicPeriodLabel } from "./demographic-period";
import {
  demographicDimensions,
  type DemographicDimension,
  type DemographicReport,
} from "./demographic.types";
import { ErrorNotification } from "./error-notification.component";
import { ReportAddressFilter } from "./report-address-filter.component";
import type { Catalogue, ReportZoneLevel, SurveillanceEvent } from "./types";
import styles from "./dashboard.scss";

export function visibleDemographicAxes(
  report: DemographicReport,
  hideZero: boolean,
) {
  return {
    rows: report.rows
      .map((_, i) => i)
      .filter((i) => !hideZero || report.rowTotals[i] !== 0),
    columns: report.columns
      .map((_, i) => i)
      .filter((i) => !hideZero || report.columnTotals[i] !== 0),
  };
}

export function DemographicPanel({
  catalogue,
  locationUuid,
}: {
  catalogue: Catalogue;
  locationUuid?: string;
}) {
  const { t } = useTranslation(moduleName);
  const online = useConnectivity();
  const today = dateInZone(catalogue.catalog.timezone);
  const [row, setRow] = useState<DemographicDimension>("ageGroup");
  const [column, setColumn] = useState<DemographicDimension>("sex");
  const [event, setEvent] = useState(catalogue.events[0]?.uuid ?? "");
  const [compareEvents, setCompareEvents] = useState<SurveillanceEvent[]>([]);
  const [period, setPeriod] = useState("mes");
  const [from, setFrom] = useState(() => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 27);
    return (
      [date.toISOString().slice(0, 10), catalogue.catalog.surveillanceStartDate]
        .sort()
        .at(-1) ?? today
    );
  });
  const [to, setTo] = useState(today);
  const [diagnosisType, setDiagnosisType] = useState("CONFIRMADO");
  const [zoneLevel, setZoneLevel] = useState<ReportZoneLevel>("CENTRO_POBLADO");
  const [address, setAddress] = useState("");
  const [hideZero, setHideZero] = useState(false);
  const [report, setReport] = useState<DemographicReport>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const comparesDiseases = row === "disease" || column === "disease";
  const usesPeriod = row === "period" || column === "period";
  const invalidRange = !from || !to || from > to || to > today;
  const filters: Record<string, string> = {
    from,
    to,
    row,
    column,
    diagnosisType,
    zoneLevel,
    address,
  };
  if (usesPeriod) filters.period = period;
  if (comparesDiseases)
    filters.compareEvents = compareEvents.map((item) => item.uuid).join(",");
  else filters.event = event;
  const query = JSON.stringify(filters);
  const ready =
    !invalidRange &&
    row !== column &&
    (comparesDiseases ? compareEvents.length > 0 : !!event);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reconnection and explicit retry refresh the same query.
  useEffect(() => {
    const abort = new AbortController();
    setReport(undefined);
    setError(undefined);
    setLoading(false);
    if (!ready) return;
    setLoading(true);
    void getDemographics(JSON.parse(query), abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setReport(value);
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(reason);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [query, ready, retry, online]);
  const axisChange = (axis: "row" | "column", next: DemographicDimension) => {
    const willCompare =
      next === "disease" || (axis === "row" ? column : row) === "disease";
    if (willCompare) setEvent("");
    else setCompareEvents([]);
    if (axis === "row") setRow(next);
    else setColumn(next);
  };
  const label = (
    dimension: DemographicDimension,
    value: { key: string; label: string },
  ) => {
    if (value.key === "UNKNOWN") return t("demographic.unknown");
    if (dimension === "period")
      return demographicPeriodLabel(
        value,
        report?.period ?? period,
        catalogue.catalog,
      );
    if (dimension === "ageGroup") {
      const group = report?.ageGroups.find((g) => g.key === value.key);
      return `${group?.name ?? t(`ageGroups.${value.key}`, { defaultValue: value.label })} (${group?.minAge ?? ""}–${group?.maxAge ?? "∞"})`;
    }
    if (dimension === "sex" || dimension === "pregnancy")
      return t(`demographic.values.${value.key}`);
    return value.label;
  };
  const visible = report && visibleDemographicAxes(report, hideZero);
  return (
    <section className={styles.form} aria-label={t("demographic.title")}>
      <h3>{t("filters")}</h3>
      <div className={styles.filters}>
        <Select
          id="demographic-event"
          labelText={t("fields.eventUuid")}
          value={event}
          disabled={comparesDiseases}
          onChange={(e) => setEvent(e.target.value)}
        >
          <SelectItem value="" text={t("selectOption")} />
          {catalogue.events.map((item) => (
            <SelectItem
              key={item.uuid}
              value={item.uuid}
              text={item.conceptDisplay ?? item.conceptUuid}
            />
          ))}
        </Select>
        <DateInput
          id="demographic-from"
          type="date"
          labelText={t("demographic.from")}
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
        />
        <DateInput
          id="demographic-to"
          type="date"
          labelText={t("demographic.to")}
          value={to}
          min={from}
          max={today}
          onChange={(e) => setTo(e.target.value)}
        />
        <Select
          id="demographic-diagnosis"
          labelText={t("reportDiagnosisType")}
          value={diagnosisType}
          onChange={(e) => setDiagnosisType(e.target.value)}
        >
          {["CONFIRMADO", "PROBABLE", "TODOS"].map((value) => (
            <SelectItem
              key={value}
              value={value}
              text={t(`reportDiagnoses.${value}`)}
            />
          ))}
        </Select>
        <ReportAddressFilter
          locationUuid={locationUuid}
          idPrefix="demographic"

          onChange={(address, level) => {
            setAddress(address);
            setZoneLevel(level);
          }}
        />
        {(["row", "column"] as const).map((axis) => (
          <Select
            key={axis}
            id={`demographic-${axis}`}
            labelText={t(`demographic.${axis}`)}
            value={axis === "row" ? row : column}
            onChange={(e) =>
              axisChange(axis, e.target.value as DemographicDimension)
            }
          >
            {demographicDimensions.map((value) => (
              <SelectItem
                key={value}
                value={value}
                text={t(`demographic.dimensions.${value}`)}
                disabled={value === (axis === "row" ? column : row)}
              />
            ))}
          </Select>
        ))}
        {usesPeriod && (
          <Select
            id="demographic-period"
            labelText={t("demographic.periodType")}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {["dia", "semana", "mes", "trimestre", "semestre", "anio"].map(
              (value) => (
                <SelectItem
                  key={value}
                  value={value}
                  text={
                    value === "anio"
                      ? t("demographic.annual")
                      : t(`periods.${value}`)
                  }
                />
              ),
            )}
          </Select>
        )}
        {comparesDiseases && (
          <MultiSelect
            id="demographic-diseases"
            titleText={t("demographic.compareDiseases")}
            label={t("selectOption")}
            items={catalogue.events}
            selectedItems={compareEvents}
            itemToString={(item) => item?.conceptDisplay ?? ""}
            onChange={({ selectedItems }) =>
              setCompareEvents(selectedItems ?? [])
            }
          />
        )}
      </div>
      <Checkbox
        id="demographic-hide-zero"
        labelText={t("demographic.hideZero")}
        checked={hideZero}
        onChange={(_, { checked }) => setHideZero(checked)}
      />
      {invalidRange && (
        <InlineNotification
          kind="error"
          hideCloseButton
          title={t("errors.INVALID_DATE_RANGE")}
        />
      )}
      {!ready && !invalidRange && <p>{t("demographic.selectVariables")}</p>}
      {!online && (
        <InlineNotification
          kind="warning"
          hideCloseButton
          title={t("offline")}
          subtitle={t("cachedReportNotice")}
        />
      )}
      {loading && <InlineLoading description={t("loading")} />}
      {error && (
        <>
          <ErrorNotification error={error} />
          <Button kind="ghost" onClick={() => setRetry((v) => v + 1)}>
            {t("retry")}
          </Button>
        </>
      )}
      {report && visible && (
        <>
          <p>
            {t("calculatedAt")}:{" "}
            {new Date(report.generatedAt).toLocaleString("es-PE")} ·{" "}
            {t("demographic.total")}: {report.total}
          </p>
          <p>{t("demographic.basis")}</p>

          {(row === "ethnicity" || column === "ethnicity") && (
            <p>{t("demographic.ethnicitySource")}</p>
          )}
          {report.excludedWithoutOnset > 0 && (
            <p>
              {t("demographic.undated")}: {report.excludedWithoutOnset}
            </p>
          )}
          {report.total === 0 && <p>{t("noSelectedCases")}</p>}
          {visible.rows.length > 0 && visible.columns.length > 0 && (
            <ReportExport
              kind="table"
              name="informacion-demografica"
              title={`${t(`demographic.dimensions.${report.row}`)} / ${t(`demographic.dimensions.${report.column}`)}`}
            >
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <caption>
                    {t(`demographic.dimensions.${report.row}`)} /{" "}
                    {t(`demographic.dimensions.${report.column}`)}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        {t(`demographic.dimensions.${report.row}`)} /{" "}
                        {t(`demographic.dimensions.${report.column}`)}
                      </th>
                      {visible.columns.map((i) => (
                        <th scope="col" key={report.columns[i].key}>
                          {label(report.column, report.columns[i])}
                        </th>
                      ))}
                      <th scope="col">{t("demographic.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.rows.map((i) => (
                      <tr key={report.rows[i].key}>
                        <th scope="row">{label(report.row, report.rows[i])}</th>
                        {visible.columns.map((j) => (
                          <td key={report.columns[j].key}>
                            {report.values[i][j]}
                          </td>
                        ))}
                        <td>{report.rowTotals[i]}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">{t("demographic.total")}</th>
                      {visible.columns.map((j) => (
                        <td key={report.columns[j].key}>
                          {report.columnTotals[j]}
                        </td>
                      ))}
                      <td>{report.total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </ReportExport>
          )}
        </>
      )}
    </section>
  );
}
