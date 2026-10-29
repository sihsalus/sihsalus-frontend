import {
  Button,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import { makeUrl, showToast } from "@openmrs/esm-framework";
import { RequirePrivilege } from "@sihsalus/esm-rbac";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiBase, attendAlert, getAlerts } from "./api";
import {
  caseRegisterPrivilege,
  caseViewPrivilege,
  epidemiologicalSurveillanceReadPrivilege,
  managePrivilege,
  moduleName,
  reportPrivilege,
} from "./constants";
import { ErrorNotification } from "./error-notification.component";
import styles from "./dashboard.scss";
import type { SurveillanceAlert } from "./types";
import { TablePagination } from "./table-pagination.component";

function caseDescription(alert: SurveillanceAlert) {
  const missing = "\u2014";
  if (alert.type === "OUTBREAK") return missing;
  const diagnosis = [alert.diagnosisIcd10, alert.diagnosisDisplay]
    .filter(Boolean)
    .join(" - ");
  if (!alert.patientDisplay && !alert.encounterDate && !diagnosis)
    return missing;
  return [
    alert.patientDisplay || missing,
    alert.encounterDate
      ? new Date(alert.encounterDate).toLocaleString()
      : missing,
    diagnosis || missing,
  ].join(" \u00b7 ");
}

export function alertInformation(
  alert: SurveillanceAlert,
  translate: (key: string) => string,
) {
  const information = alert.additionalInformation ?? "—";
  if (alert.type !== "OUTBREAK") return information;
  // Historical alerts store this field as text, including focus and origin codes.
  return information
    .replace(
      /(\bfoco previo:\s*)(ACTIVE|RESIDUAL|ELIMINATED|UNCLASSIFIED)(?=\s*(?:;|$))/g,
      (_match, label: string, focus: string) =>
        `${label}${translate(`geo.classes.${focus}`)}`,
    )
    .replace(
      /(\borigen:\s*)(AUTOCTONO|IMPORTADO_NACIONAL|IMPORTADO_INTERNACIONAL|RECAIDA|RECRUDESCENCIA|INDUCIDO|INTRODUCIDO|UNKNOWN)(?=\s*(?:;|$))/g,
      (_match, label: string, origin: string) =>
        `${label}${translate(`geo.origins.${origin}`)}`,
    );
}

export const alertReasons = [
  "IMMEDIATE_EVENT",
  "STATUS_CHANGED",
  "DEATH",
  "CONFIRMED_PREGNANCY",
  "EPIDEMIC_THRESHOLD",
  "SUSTAINED_INCREASE",
  "AUTOCHTHONOUS_ELIMINATED",
  "FOCUS_CASES",
];
export function AlertAccess({ children }: { children: React.ReactNode }) {
  return [
    epidemiologicalSurveillanceReadPrivilege,
    caseViewPrivilege,
    caseRegisterPrivilege,
    reportPrivilege,
    managePrivilege,
  ].reduceRight(
    (content, privilege) => (
      <RequirePrivilege key={privilege} privilege={privilege} hideUnauthorized>
        {content}
      </RequirePrivilege>
    ),
    <>{children}</>,
  );
}

/** Receives committed case alerts immediately; checks for other users' new alerts while the module is open. */
export function AlertNotifications() {
  const { t } = useTranslation(moduleName);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const abort = new AbortController();
    const display = (alerts: SurveillanceAlert[]) => {
      for (const alert of alerts) {
        if (seen.current.has(alert.uuid) || alert.status !== "PENDING")
          continue;
        seen.current.add(alert.uuid);
        showToast({
          title: t("alertInbox.title"),
          description: `${alert.eventName} · ${caseDescription(alert)} · ${t(`alertInbox.reasons.${alert.reason}`)} · ${new Date(alert.generatedAt).toLocaleString()}`,
          kind: "warning",
          critical: true,
        });
      }
    };
    const receive = (event: Event) => {
      display((event as CustomEvent<SurveillanceAlert[]>).detail);
      window.dispatchEvent(new Event("surveillance-alerts-changed"));
    };
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || abort.signal.aborted) return;
      refreshing = true;
      try {
        const alerts = await getAlerts({ status: "PENDING" }, abort.signal);
        if (!abort.signal.aborted) {
          const hasNew = alerts.some((alert) => !seen.current.has(alert.uuid));
          display(alerts);
          if (hasNew)
            window.dispatchEvent(new Event("surveillance-alerts-changed"));
        }
      } catch {
        /* The inbox exposes retrieval errors and retry; do not interrupt case entry. */
      } finally {
        refreshing = false;
      }
    };
    window.addEventListener("surveillance-alerts-generated", receive);
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh);
    let stream: EventSource | undefined;
    try {
      stream = new EventSource(makeUrl(`${apiBase}/alerts/stream`), {
        withCredentials: true,
      });
      stream.onopen = () => void refresh();
      stream.onmessage = () => {
        void refresh();
        window.dispatchEvent(new Event("surveillance-alerts-changed"));
      };
    } catch {
      /* Periodic retrieval remains available if EventSource is unsupported. */
    }
    return () => {
      abort.abort();
      stream?.close();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("surveillance-alerts-generated", receive);
    };
  }, [t]);
  return null;
}

export function AlertsPanel() {
  const { t } = useTranslation(moduleName);
  const [filters, setFilters] = useState({ type: "", reason: "", status: "" });
  const [rows, setRows] = useState<SurveillanceAlert[]>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string>();
  const [saved, setSaved] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Refresh and stream signals deliberately reload the inbox.
  useEffect(() => {
    const abort = new AbortController();
    setRows(undefined);
    setError(undefined);
    void getAlerts(
      Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      abort.signal,
    )
      .then((value) => {
        if (!abort.signal.aborted) {
          setRows(value);
          setPage(1);
        }
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure);
      });
    return () => abort.abort();
  }, [filters, revision]);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("surveillance-alerts-changed", refresh);
    window.addEventListener("surveillance-alerts-generated", refresh);
    return () => {
      window.removeEventListener("surveillance-alerts-changed", refresh);
      window.removeEventListener("surveillance-alerts-generated", refresh);
    };
  }, []);
  const attend = async (uuid: string) => {
    setBusy(uuid);
    setSaved(false);
    setError(undefined);
    try {
      await attendAlert(uuid);
      setSaved(true);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <section className={styles.form} aria-label={t("alertInbox.title")}>
      <h3>{t("filters", "Filters")}</h3>
      <div className={styles.alertFilters}>
        {(
          [
            ["type", ["IMMEDIATE", "OUTBREAK"]],
            ["reason", alertReasons],
            ["status", ["PENDING", "ATTENDED"]],
          ] as const
        ).map(([field, options]) => (
          <Select
            key={field}
            id={`alert-${field}`}
            labelText={t(`alertInbox.${field}`)}
            value={filters[field]}
            onChange={(event) =>
              setFilters({ ...filters, [field]: event.target.value })
            }
          >
            <SelectItem value="" text={t("alertInbox.all")} />
            {options.map((option) => (
              <SelectItem
                key={option}
                value={option}
                text={t(
                  `alertInbox.${field === "reason" ? "reasons" : "values"}.${option}`,
                )}
              />
            ))}
          </Select>
        ))}
        <Button
          kind="tertiary"
          onClick={() => setRevision((value) => value + 1)}
        >
          {t("alertInbox.refresh")}
        </Button>
      </div>
      {error ? <ErrorNotification error={error} /> : null}
      {saved && (
        <InlineNotification
          kind="success"
          title={t("alertInbox.attendedSuccess")}
          onCloseButtonClick={() => setSaved(false)}
        />
      )}
      {!rows && !error && <InlineLoading description={t("loading")} />}
      {rows?.length === 0 && <p>{t("alertInbox.empty")}</p>}
      {rows && rows.length > 0 && (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table aria-label={t("alertInbox.title")}>
              <TableHead>
                <TableRow>
                  {[
                    "type",
                    "case",
                    "event",
                    "center",
                    "reason",
                    "generatedAt",
                    "additionalInformation",
                    "status",
                    "attendedAt",
                    "attendedBy",
                    "actions",
                  ].map((key) => (
                    <TableHeader key={key}>
                      {t(`alertInbox.${key}`)}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows
                  .slice((page - 1) * pageSize, page * pageSize)
                  .map((alert) => (
                    <TableRow key={alert.uuid}>
                      <TableCell>
                        {t(`alertInbox.values.${alert.type}`)}
                      </TableCell>
                      <TableCell>{caseDescription(alert)}</TableCell>
                      <TableCell>{alert.eventName}</TableCell>
                      <TableCell>{alert.center ?? "—"}</TableCell>
                      <TableCell>
                        {t(`alertInbox.reasons.${alert.reason}`)}
                      </TableCell>
                      <TableCell>
                        {new Date(alert.generatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{alertInformation(alert, t)}</TableCell>
                      <TableCell>
                        {t(`alertInbox.values.${alert.status}`)}
                      </TableCell>
                      <TableCell>
                        {alert.attendedAt
                          ? new Date(alert.attendedAt).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>{alert.attendedBy ?? "—"}</TableCell>
                      <TableCell>
                        {alert.status === "PENDING" && (
                          <Button
                            size="sm"
                            disabled={Boolean(busy)}
                            onClick={() => void attend(alert.uuid)}
                          >
                            {t("alertInbox.attend")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={rows.length}
            onChange={({ page: nextPage, pageSize: nextSize }) => {
              setPage(nextSize === pageSize ? nextPage : 1);
              setPageSize(nextSize);
            }}
          />
        </>
      )}
    </section>
  );
}
