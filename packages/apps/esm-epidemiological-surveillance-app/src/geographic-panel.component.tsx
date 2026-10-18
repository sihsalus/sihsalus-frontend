import { demographicDimensions } from "./demographic.types";
import { demographicPeriodLabel } from "./demographic-period";
import { ReportExport } from "./report-export.component";
import {
  Button,
  Checkbox,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  TextInput,
} from "@carbon/react";
import { useConnectivity } from "@openmrs/esm-framework";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { dateInZone } from "./case-form.utils";
import { moduleName } from "./constants";
import { DateInput } from "./date-input.component";
import { ErrorNotification } from "./error-notification.component";
import { GeographicMap } from "./geographic-map.component";
import {
  geographicOrigins,
  getGeography,
  type GeographicReport,
  type GeographicColumn,
} from "./geographic.resource";
import { ReportAddressFilter } from "./report-address-filter.component";
import type { Catalogue, ReportZoneLevel } from "./types";
import styles from "./dashboard.scss";
import geoStyles from "./geographic.scss";

export function validGeographicRange(from: string, to: string, today: string) {
  return (
    !!from &&
    !!to &&
    from <= to &&
    to <= today &&
    from.slice(0, 4) === to.slice(0, 4)
  );
}

export function geographicCenterLabel(
  label: string,
  address: string,
  zoneLevel: ReportZoneLevel,
) {
  if (!address || !label) return label;
  // The API's address display is Department → Province → District → Center.
  const parts = label.split(" → ");
  if (parts.length !== 4) return label;
  const hiddenLevels = {
    DEPARTAMENTO: 1,
    PROVINCIA: 2,
    DISTRITO: 3,
    CENTRO_POBLADO: 3,
  };
  return parts.slice(hiddenLevels[zoneLevel]).join(" → ");
}

export function GeographicPanel({
  catalogue,
  locationUuid,
}: {
  catalogue: Catalogue;
  locationUuid?: string;
}) {
  const { t } = useTranslation(moduleName);
  const today = dateInZone(catalogue.catalog.timezone);
  const online = useConnectivity();
  const [event, setEvent] = useState(catalogue.events[0]?.uuid ?? "");
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [diagnosisType, setDiagnosisType] = useState("CONFIRMADO");
  const [address, setAddress] = useState("");
  const [zoneLevel, setZoneLevel] = useState<ReportZoneLevel>("DEPARTAMENTO");
  const [report, setReport] = useState<GeographicReport>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [hideZero, setHideZero] = useState(false);
  const [column, setColumn] = useState<GeographicColumn>("origin");
  const [period, setPeriod] = useState("mes");
  const valid = validGeographicRange(from, to, today);
  const query = JSON.stringify({
    event,
    from,
    to,
    address,
    zoneLevel,
    diagnosisType,
    column,
    period: column === "period" ? period : "mes",
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry and connectivity changes refresh this query.
  useEffect(() => {
    const abort = new AbortController();
    setReport(undefined);
    setError(undefined);
    setLoading(false);
    if (!valid || !event) return;
    setLoading(true);
    const filters = JSON.parse(query);
    void getGeography(filters, abort.signal)
      .then((value) => {
        if (abort.signal.aborted) return;
        if (
          filters.column !== "origin" &&
          value.table?.column !== filters.column
        )
          throw new Error("Missing geographic breakdown");
        setReport({
          ...value,
          foci: value.foci.map((focus) => ({
            ...focus,
            label: geographicCenterLabel(
              focus.label,
              filters.address,
              filters.zoneLevel,
            ),
          })),
        });
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(reason);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [query, valid, event, retry, online]);
  const table = report?.table;
  const cells = new Map(
    table?.rows.map((row, index) => [Number(row.key), table.values[index]]),
  );
  const allColumns =
    table?.columns ??
    geographicOrigins.map((key) => ({ key, label: t(`geo.origins.${key}`) }));
  const count = (centerId: number, index: number) =>
    table
      ? (cells.get(centerId)?.[index] ?? 0)
      : (report?.foci.find((focus) => focus.centerId === centerId)?.origins[
          allColumns[index].key
        ] ?? 0);
  const columns = allColumns
    .map((_, index) => index)
    .filter(
      (index) =>
        !hideZero ||
        report?.foci.some((focus) => count(focus.centerId, index) > 0),
    );
  const columnLabel = (index: number) => {
    const item = allColumns[index];
    const dimension = table?.column ?? "origin";
    if (dimension === "origin") return t(`geo.origins.${item.key}`);
    if (item.key === "UNKNOWN") return t("demographic.unknown");
    if (dimension === "period")
      return demographicPeriodLabel(
        item,
        table?.period ?? period,
        catalogue.catalog,
      );
    if (dimension === "sex" || dimension === "pregnancy")
      return t(`demographic.values.${item.key}`);
    if (dimension === "ageGroup") {
      const group = table?.ageGroups.find((group) => group.key === item.key);
      return `${t(`ageGroups.${item.key}`)} (${group?.minAge ?? ""}\u2013${group?.maxAge ?? "\u221e"})`;
    }
    return item.label;
  };
  const tableTitle =
    column === "origin"
      ? t("geo.tableTitle")
      : `${t("reportCenter")} / ${t(`demographic.dimensions.${column}`)}`;
  return (
    <section className={styles.form} aria-label={t("geographic")}>
      <h3>{t("filters")}</h3>
      <div className={`${styles.filters} ${geoStyles.filters}`}>
        <Select
          id="geo-event"
          labelText={t("fields.eventUuid")}
          value={event}
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
          id="geo-from"
          type="date"
          labelText={t("demographic.from")}
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
        />
        <DateInput
          id="geo-to"
          type="date"
          labelText={t("demographic.to")}
          value={to}
          min={from}
          max={today}
          onChange={(e) => setTo(e.target.value)}
        />
        <Select
          id="geo-diagnosis"
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
        <Select
          id="geo-column"
          labelText={t("demographic.column")}
          value={column}
          onChange={(event) =>
            setColumn(event.target.value as GeographicColumn)
          }
        >
          {[
            ...demographicDimensions.filter((value) => value !== "disease"),
            "origin",
          ].map((value) => (
            <SelectItem
              key={value}
              value={value}
              text={
                value === "origin"
                  ? t("fields.origin")
                  : t(`demographic.dimensions.${value}`)
              }
            />
          ))}
        </Select>
        {column === "period" && (
          <Select
            id="geo-period"
            labelText={t("demographic.periodType")}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
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
        <TextInput
          id="geo-year"
          labelText={t("geo.referenceYear")}
          disabled
          value={valid ? from.slice(0, 4) : ""}
        />
        <ReportAddressFilter
          locationUuid={locationUuid}
          idPrefix="geo"
          includeCenter
          onChange={(value, level) => {
            setAddress(value);
            setZoneLevel(level);
          }}
        />
      </div>
      {!valid && (
        <InlineNotification
          kind="error"
          hideCloseButton
          title={t("geo.invalidRange")}
        />
      )}
      {!online && <p role="status">{t("geo.offline")}</p>}
      {loading && <InlineLoading description={t("loading")} />}
      {error && (
        <>
          <ErrorNotification error={error} />
          <Button onClick={() => setRetry((value) => value + 1)}>
            {t("retry")}
          </Button>
        </>
      )}
      {report && (
        <>
          <p>{t("geo.includedCases")}</p>
          <GeographicMap key={query + retry} report={report} />
          {report.total === 0 && <p>{t("geo.empty")}</p>}
          {report.unmappedCases > 0 && (
            <p role="status">
              {t("geo.unmapped", { count: report.unmappedCases })}
            </p>
          )}
          {report.foci.some((f) => f.classification === "UNCLASSIFIED") && (
            <p>{t("geo.unknownOrigin")}</p>
          )}
          {column === "ethnicity" && <p>{t("demographic.ethnicitySource")}</p>}
          <Checkbox
            id="geo-hide-zero"
            labelText={t("geo.hideZero")}
            checked={hideZero}
            onChange={(_, { checked }) => setHideZero(checked)}
          />
          <ReportExport
            kind="table"
            name="informacion-geografica"
            title={tableTitle}
          >
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <caption>{tableTitle}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("reportCenter")}</th>
                    {columns.map((origin) => (
                      <th scope="col" key={origin}>
                        {columnLabel(origin)}
                      </th>
                    ))}
                    <th scope="col">{t("geo.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.foci.map((focus) => (
                    <tr key={focus.centerId}>
                      <th scope="row">
                        {focus.label || t("demographic.unknown")}
                      </th>
                      {columns.map((origin) => (
                        <td key={origin}>{count(focus.centerId, origin)}</td>
                      ))}
                      <td>{focus.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">{t("geo.total")}</th>
                    {columns.map((origin) => (
                      <td key={origin}>
                        {report.foci.reduce(
                          (sum, f) => sum + count(f.centerId, origin),
                          0,
                        )}
                      </td>
                    ))}
                    <td>{report.total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </ReportExport>
          {report.total > 0 && (
            <ReportExport
              kind="image"
              name="distribucion-centros"
              title={t("geo.pieTitle")}
            >
              <CenterPie report={report} />
            </ReportExport>
          )}
        </>
      )}
    </section>
  );
}
export function CenterPie({ report }: { report: GeographicReport }) {
  const { t } = useTranslation(moduleName);
  let cumulative = 0;
  const slices = report.foci.map((focus, i) => {
    const start = cumulative;
    cumulative += focus.total / report.total;
    const point = (fraction: number) =>
      `${100 + 90 * Math.cos(fraction * 2 * Math.PI - Math.PI / 2)},${100 + 90 * Math.sin(fraction * 2 * Math.PI - Math.PI / 2)}`;
    return {
      focus,
      color: `hsl(${(i * 137.508) % 360} 65% 45%)`,
      percent: (100 * focus.total) / report.total,
      path: `M 100,100 L ${point(start)} A 90,90 0 ${cumulative - start > 0.5 ? 1 : 0},1 ${point(cumulative)} Z`,
    };
  });
  return (
    <div className={geoStyles.pieLayout}>
      <svg
        viewBox="0 0 200 200"
        className={geoStyles.pie}
        role="img"
        aria-label={t("geo.pieTitle")}
      >
        <title>{t("geo.pieTitle")}</title>
        {slices.map(({ focus, color, percent, path }) => (
          <g key={focus.centerId}>
            <title>
              {focus.label}: {focus.total} ({percent.toFixed(1)}%)
            </title>
            {percent === 100 ? (
              <circle cx="100" cy="100" r="90" fill={color} />
            ) : (
              <path d={path} fill={color} stroke="white" />
            )}
          </g>
        ))}
      </svg>
      <ul className={geoStyles.pieLegend} aria-label={t("reportCenter")}>
        {slices.map(({ focus, color, percent }) => (
          <li key={focus.centerId}>
            <span
              aria-hidden="true"
              className={geoStyles.swatch}
              style={{ backgroundColor: color }}
            />
            {focus.label || t("demographic.unknown")}: {focus.total} (
            {percent.toFixed(1)}%)
          </li>
        ))}
      </ul>
    </div>
  );
}
