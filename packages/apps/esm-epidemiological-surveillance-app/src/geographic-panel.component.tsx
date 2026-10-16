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

export function GeographicPanel({ catalogue }: { catalogue: Catalogue }) {
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
  const valid = validGeographicRange(from, to, today);
  const query = JSON.stringify({
    event,
    from,
    to,
    address,
    zoneLevel,
    diagnosisType,
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
        if (!abort.signal.aborted)
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
  const columns = geographicOrigins.filter(
    (origin) => !hideZero || report?.foci.some((f) => f.origins[origin]),
  );
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
        <TextInput
          id="geo-year"
          labelText={t("geo.referenceYear")}
          disabled
          value={valid ? from.slice(0, 4) : ""}
        />
        <ReportAddressFilter
          idPrefix="geo"
          includeCenter={false}
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
          <h3>{t("geo.mapTitle")}</h3>
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
          <h3>{t("geo.tableTitle")}</h3>
          <Checkbox
            id="geo-hide-zero"
            labelText={t("geo.hideZero")}
            checked={hideZero}
            onChange={(_, { checked }) => setHideZero(checked)}
          />
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <caption>{t("geo.tableTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("reportCenter")}</th>
                  {columns.map((origin) => (
                    <th scope="col" key={origin}>
                      {t(`geo.origins.${origin}`)}
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
                      <td key={origin}>{focus.origins[origin] ?? 0}</td>
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
                        (sum, f) => sum + (f.origins[origin] ?? 0),
                        0,
                      )}
                    </td>
                  ))}
                  <td>{report.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <h3>{t("geo.pieTitle")}</h3>
          {report.total > 0 && <CenterPie report={report} />}
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
