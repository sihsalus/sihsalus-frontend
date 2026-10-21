import {
  Button,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  Tile,
} from "@carbon/react";
import { useConnectivity } from "@openmrs/esm-framework";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiBase, read } from "./api";
import { dateInZone } from "./case-form.utils";
import { moduleName } from "./constants";
import { DateInput } from "./date-input.component";
import { ErrorNotification } from "./error-notification.component";
import { ReportAddressFilter } from "./report-address-filter.component";
import type { Catalogue, ReportZoneLevel } from "./types";
import styles from "./dashboard.scss";

type Indicator = "completeness" | "fatality" | "timeliness";
export interface IndicatorResult {
  indicator: Indicator;
  numerator: number;
  denominator: number;
  percentage: number | null;
}

export function IndicatorsPanel({
  catalogue,
  locationUuid,
}: {
  catalogue: Catalogue;
  locationUuid?: string;
}) {
  const { t, i18n } = useTranslation(moduleName);
  const online = useConnectivity();
  const today = dateInZone(catalogue.catalog.timezone);
  const [event, setEvent] = useState(catalogue.events[0]?.uuid ?? "");
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [zoneLevel, setZoneLevel] = useState<ReportZoneLevel>("CENTRO_POBLADO");
  const [address, setAddress] = useState("");
  const [diagnosisType, setDiagnosisType] = useState("CONFIRMADO");
  return (
    <section className={styles.form} aria-label={t("indicators")}>
      <h3>{t("filters")}</h3>
      <div className={styles.filters}>
        <Select
          id="indicators-event"
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
          id="indicators-from"
          type="date"
          labelText={t("indicatorPanel.from")}
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
        />
        <DateInput
          id="indicators-to"
          type="date"
          labelText={t("indicatorPanel.to")}
          value={to}
          min={from}
          max={today}
          onChange={(e) => setTo(e.target.value)}
        />
        <Select
          id="indicators-diagnosis"
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
          idPrefix="indicators"
          locationUuid={locationUuid}
          onChange={(value, level) => {
            setAddress(value);
            setZoneLevel(level);
          }}
        />
      </div>
      {(!from || !to || from > to || to > today) && (
        <InlineNotification
          kind="error"
          title={t("errors.INVALID_DATE_RANGE")}
          hideCloseButton
        />
      )}
      <div className={styles.indicatorGrid}>
        {(["completeness", "fatality", "timeliness"] as const).map(
          (indicator) => (
            <IndicatorCard
              key={indicator}
              indicator={indicator}
              diagnosisType={
                indicator === "fatality" ? "CONFIRMADO" : diagnosisType
              }
              filters={{ event, from, to, zoneLevel, address }}
              ready={!!event && !!from && !!to && from <= to && to <= today}
              online={online}
              language={i18n.language}
            />
          ),
        )}
      </div>
    </section>
  );
}

function IndicatorCard({
  indicator,
  diagnosisType,
  filters,
  ready,
  online,
  language,
}: {
  indicator: Indicator;
  diagnosisType: string;
  filters: Record<string, string>;
  ready: boolean;
  online: boolean;
  language: string;
}) {
  const { t } = useTranslation(moduleName);
  const [result, setResult] = useState<IndicatorResult>();
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  const query = new URLSearchParams({
    ...filters,
    indicator,
    diagnosisType,
  }).toString();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reconnection and retry reload the current cohort.
  useEffect(() => {
    const abort = new AbortController();
    setResult(undefined);
    setError(undefined);
    if (ready)
      void read<IndicatorResult>(
        `${apiBase}/reports/indicators?${query}`,
        abort.signal,
      )
        .then((value) => {
          if (!abort.signal.aborted) setResult(value);
        })
        .catch((reason) => {
          if (!abort.signal.aborted) setError(reason);
        });
    return () => abort.abort();
  }, [query, ready, retry, online]);
  return (
    <Tile className={styles.indicatorCard}>
      <h4>
        <strong>{t(`indicatorPanel.${indicator}`)}</strong>
      </h4>
      {error ? (
        <>
          <ErrorNotification error={error} />
          <Button kind="ghost" onClick={() => setRetry((value) => value + 1)}>
            {t("retry")}
          </Button>
        </>
      ) : result ? (
        <>
          <p className={styles.indicatorValue}>
            <strong>
              {result.percentage === null
                ? t("indicatorPanel.noCases")
                : new Intl.NumberFormat(language, {
                    style: "percent",
                    maximumFractionDigits: 2,
                  }).format(result.percentage / 100)}
            </strong>
          </p>
          <p className={styles.indicatorCount}>
            {t(
              indicator === "fatality"
                ? "indicatorPanel.confirmedCount"
                : "indicatorPanel.count",
              {
                numerator: result.numerator,
                denominator: result.denominator,
              },
            )}
          </p>
        </>
      ) : ready ? (
        <InlineLoading description={t("loading")} />
      ) : null}
    </Tile>
  );
}
