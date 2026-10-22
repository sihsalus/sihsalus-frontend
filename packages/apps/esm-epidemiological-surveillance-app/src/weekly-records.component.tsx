import {
  Button,
  InlineLoading,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getWeeklyRecords } from "./api";
import { dateInZone } from "./case-form.utils";
import { displayDate } from "./date-display";
import { demographicPeriodLabel } from "./demographic-period";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import { ReportExport } from "./report-export.component";
import { TablePagination } from "./table-pagination.component";
import type { Catalogue } from "./types";
import {
  weeklyCells,
  weeklyColumns,
  weeklyExportRows,
  type WeeklyRecords,
} from "./weekly-records";
import styles from "./dashboard.scss";

export function WeeklyRecordsPanel({ catalogue }: { catalogue: Catalogue }) {
  const { t } = useTranslation(moduleName);
  const calendar = catalogue.catalog;
  const today = dateInZone(calendar.timezone);
  const current = demographicPeriodLabel(
    { key: today, label: today },
    "semana",
    calendar,
  );
  const currentYear = Number(current.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [week, setWeek] = useState(Number(current.slice(-2)));
  const [result, setResult] = useState<WeeklyRecords>();
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const firstYear = Number(calendar.surveillanceStartDate.slice(0, 4));
  const years = Array.from(
    { length: Math.max(1, currentYear - firstYear + 1) },
    (_, index) => currentYear - index,
  );
  const weeks = new Set<number>();
  // Derive valid weeks using the same configured calendar, including 53-week years.
  for (let day = 1; day <= 366; day++) {
    const date = new Date(Date.UTC(year, 0, day)).toISOString().slice(0, 10);
    const label = demographicPeriodLabel(
      { key: date, label: date },
      "semana",
      calendar,
    );
    if (Number(label.slice(0, 4)) === year) weeks.add(Number(label.slice(-2)));
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry refreshes the selected period.
  useEffect(() => {
    const abort = new AbortController();
    setResult(undefined);
    setError(undefined);
    setPage(1);
    void getWeeklyRecords(year, week, abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) setResult(data);
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure);
      });
    return () => abort.abort();
  }, [year, week, retry]);
  // A changed filter must never leave a previous week's export enabled.
  const visible =
    result?.year === year && result.week === week ? result : undefined;
  return (
    <section className={styles.form} aria-label={t("weekly.title")}>
      <h3>{t("filters")}</h3>
      <div className={styles.filters}>
        <Select
          id="weekly-year"
          labelText={t("weekly.year")}
          value={year}
          onChange={(event) => {
            setYear(Number(event.target.value));
            setWeek(1);
          }}
        >
          {years.map((value) => (
            <SelectItem key={value} value={value} text={String(value)} />
          ))}
        </Select>
        <Select
          id="weekly-week"
          labelText={t("weekly.week")}
          value={week}
          onChange={(event) => setWeek(Number(event.target.value))}
        >
          {[...weeks]
            .sort((a, b) => a - b)
            .map((value) => (
              <SelectItem
                key={value}
                value={value}
                text={`S${String(value).padStart(2, "0")}`}
              />
            ))}
        </Select>
      </div>
      {error ? (
        <>
          <ErrorNotification error={error} />
          <Button
            kind="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            {t("retry")}
          </Button>
        </>
      ) : !visible ? (
        <InlineLoading description={t("loading")} />
      ) : (
        <ReportExport
          kind="table"
          title={t("weekly.title")}
          name={`registro-semanal-${year}-S${String(week).padStart(2, "0")}`}
          rows={weeklyExportRows(visible.rows, t)}
        >
          <p>
            {displayDate(visible.from)} — {displayDate(visible.to)}
          </p>
          <div className={styles.weeklyTable}>
            <TableContainer>
              <Table size="sm" aria-label={t("weekly.title")}>
                <TableHead>
                  <TableRow>
                    {weeklyColumns.map((key) => (
                      <TableHeader key={key}>
                        {t(`weekly.columns.${key}`)}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.rows
                    .slice((page - 1) * pageSize, page * pageSize)
                    .map((row) => (
                      <TableRow key={row.id}>
                        {weeklyCells(row).map((value, index) => (
                          <TableCell key={weeklyColumns[index]}>
                            {value === "" ? "—" : value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  {!visible.rows.length && (
                    <TableRow>
                      <TableCell colSpan={weeklyColumns.length}>
                        {t("weekly.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={visible.rows.length}
            onChange={({ page: nextPage, pageSize: nextSize }) => {
              setPage(nextSize === pageSize ? nextPage : 1);
              setPageSize(nextSize);
            }}
          />
        </ReportExport>
      )}
    </section>
  );
}
