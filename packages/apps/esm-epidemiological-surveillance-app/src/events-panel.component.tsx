import { serverFieldErrors, type FieldErrors } from "./field-validation";
import { RequiredFieldLabel } from "./required-field-label.component";
import { Add, Edit } from "@carbon/react/icons";
import {
  Button,
  ComboBox,
  DataTable,
  InlineLoading,
  Modal,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from "@carbon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  safeError,
  getEvents,
  saveEvent,
  updateEvent,
  searchConcepts,
  type RestConcept,
} from "./api";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import type { Catalogue, SurveillanceEvent } from "./types";
import styles from "./dashboard.scss";
import { TablePagination } from "./table-pagination.component";

export function EventsPanel({
  catalogue: _catalogue,
  onEventsChanged,
}: {
  catalogue?: Catalogue;
  onEventsChanged?: () => void;
}) {
  const { t } = useTranslation(moduleName);
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [diseaseFilter, setDiseaseFilter] = useState("");
  const [periodicityFilter, setPeriodicityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SurveillanceEvent | null>(null);
  const [concept, setConcept] = useState<RestConcept | null>(null);
  const [concepts, setConcepts] = useState<RestConcept[]>([]);
  const [periodicity, setPeriodicity] =
    useState<SurveillanceEvent["periodicity"]>("SEMANAL");
  const [referenceRegulation, setReferenceRegulation] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<unknown>();
  const [attempted, setAttempted] = useState(false);
  const [remoteErrors, setRemoteErrors] = useState<FieldErrors>({});
  const localErrors: FieldErrors = {};
  if (!concept) localErrors.conceptUuid = "required";
  if (!referenceRegulation.trim()) localErrors.referenceRegulation = "required";
  else if (referenceRegulation.trim().length > 100)
    localErrors.referenceRegulation = "referenceLength";
  const fieldErrors = { ...remoteErrors, ...(attempted ? localErrors : {}) };
  const fieldProps = (field: string) => ({
    invalid: !!fieldErrors[field],
    invalidText: fieldErrors[field]
      ? t(`validation.${fieldErrors[field]}`)
      : undefined,
  });
  const clearField = (field: string) =>
    setRemoteErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(
    () =>
      getEvents(true)
        .then((result) => {
          setEvents(result);
          setDiseaseFilter((current) =>
            result.some(
              (event) =>
                event.conceptUuid === current && event.active !== false,
            )
              ? current
              : "",
          );
          setPage(1);
        })
        .catch(setError)
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  const search = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) return setConcepts([]);
    timer.current = setTimeout(
      () =>
        searchConcepts(value)
          .then(setConcepts)
          .catch(() => setConcepts([])),
      250,
    );
  };
  const save = async () => {
    if (busy) return;
    setAttempted(true);
    if (Object.keys(localErrors).length) return;
    setBusy(true);
    setFormError(undefined);
    try {
      const payload = {
        conceptUuid: concept.uuid,
        periodicity,
        referenceRegulation: referenceRegulation.trim(),
        active,
      };
      if (editing) await updateEvent(editing.uuid, payload);
      else await saveEvent(payload);
      setOpen(false);
      load();
      onEventsChanged?.();
    } catch (reason) {
      const failure = safeError(reason);
      const fields = serverFieldErrors(failure);
      setRemoteErrors(fields);
      setFormError(Object.keys(fields).length ? undefined : failure);
    } finally {
      setBusy(false);
    }
  };
  const headers = [
    {
      key: "concept",
      header: t("eventsTable.concept", "Enfermedad (Concepto)"),
    },
    {
      key: "periodicity",
      header: t("eventsTable.periodicity", "Periodicidad"),
    },
    {
      key: "reference",
      header: t("eventsTable.reference", "Norma de referencia"),
    },
    { key: "active", header: t("eventState", "Estado") },
  ];
  const periodicities = {
    INMEDIATA: t("periodicityValues.inmediata", "Inmediata"),
    DIARIA: t("periodicityValues.diaria", "Diaria"),
    SEMANAL: t("periodicityValues.semanal", "Semanal"),
  };
  const diseases = Array.from(
    new Map(
      events
        .filter((event) => event.active !== false)
        .map((event) => [
          event.conceptUuid,
          event.conceptDisplay ?? event.conceptUuid,
        ]),
    ).entries(),
  );
  const filteredEvents = events.filter(
    (event) =>
      (!diseaseFilter || event.conceptUuid === diseaseFilter) &&
      (!periodicityFilter || event.periodicity === periodicityFilter),
  );
  const rows = filteredEvents.map((event) => ({
    id: event.uuid,
    concept: event.conceptDisplay ?? event.conceptUuid,
    periodicity: periodicities[event.periodicity] ?? event.periodicity,
    reference: event.referenceRegulation,
    active:
      event.active !== false
        ? t("eventActive", "Activo")
        : t("eventInactive", "Inactivo"),
  }));
  return (
    <section aria-label={t("events", "Eventos")} className={styles.form}>
      {error && <ErrorNotification error={error} />}
      <div className={styles.actions}>
        <Button
          kind="primary"
          renderIcon={Add}
          onClick={() => {
            setEditing(null);
            setConcepts([]);
            setConcept(null);
            setPeriodicity("SEMANAL");
            setReferenceRegulation("");
            setActive(true);
            setFormError(undefined);
            setAttempted(false);
            setRemoteErrors({});
            setOpen(true);
          }}
        >
          {t("newEvent", "Nuevo evento")}
        </Button>
      </div>
      <h3>{t("filters", "Filtros")}</h3>
      <div className={styles.filters}>
        <Select
          id="event-filter-disease"
          labelText={t("eventFilterDisease", "Enfermedad")}
          value={diseaseFilter}
          onChange={(event) => {
            setDiseaseFilter(event.target.value);
            setPage(1);
          }}
        >
          <SelectItem value="" text={t("eventFilterAll", "Todos")} />
          {diseases.map(([uuid, label]) => (
            <SelectItem key={uuid} value={uuid} text={label} />
          ))}
        </Select>
        <Select
          id="event-filter-periodicity"
          labelText={t("eventFilterPeriodicity", "Periodicidad")}
          value={periodicityFilter}
          onChange={(event) => {
            setPeriodicityFilter(event.target.value);
            setPage(1);
          }}
        >
          <SelectItem value="" text={t("eventFilterAll", "Todos")} />
          {Object.entries(periodicities)
            .filter(([value]) => value !== "DIARIA")
            .map(([value, label]) => (
              <SelectItem key={value} value={value} text={label} />
            ))}
        </Select>
      </div>
      {loading ? (
        <InlineLoading description={t("loading", "Cargando")} />
      ) : (
        <div className={styles.tableWrapper}>
          <DataTable
            rows={rows.slice((page - 1) * pageSize, page * pageSize)}
            headers={headers}
            size="lg"
            useZebraStyles
          >
            {({
              rows: tableRows,
              headers: tableHeaders,
              getTableProps,
              getHeaderProps,
              getRowProps,
            }) => (
              <TableContainer
                title={t("notifiableEvents", "Eventos notificables")}
              >
                <Table
                  {...getTableProps()}
                  className={styles.recordsTable}
                  aria-label={t("notifiableEvents", "Eventos notificables")}
                >
                  <TableHead>
                    <TableRow>
                      {tableHeaders.map((header) => {
                        const { key, ...headerProps } = getHeaderProps({
                          header,
                        });
                        return (
                          <TableHeader key={key} {...headerProps}>
                            {header.header}
                          </TableHeader>
                        );
                      })}
                      <TableHeader>{t("eventActions", "Acciones")}</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map((row) => {
                      const { key, ...rowProps } = getRowProps({ row });
                      return (
                        <TableRow key={key} {...rowProps}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{cell.value}</TableCell>
                          ))}
                          <TableCell>
                            <Button
                              kind="ghost"
                              size="sm"
                              renderIcon={Edit}
                              hasIconOnly
                              iconDescription={t("edit", "Editar")}
                              onClick={() => {
                                const event = events.find(
                                  (item) => item.uuid === row.id,
                                );
                                if (!event) return;
                                const selected = {
                                  uuid: event.conceptUuid,
                                  display:
                                    event.conceptDisplay ?? event.conceptUuid,
                                };
                                setEditing(event);
                                setConcepts([selected]);
                                setConcept(selected);
                                setPeriodicity(event.periodicity);
                                setReferenceRegulation(
                                  event.referenceRegulation,
                                );
                                setActive(event.active !== false);
                                setFormError(undefined);
                                setAttempted(false);
                                setRemoteErrors({});
                                setOpen(true);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {tableRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={headers.length + 1}>
                          {t(
                            "eventsTable.empty",
                            "No hay eventos notificables registrados.",
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={filteredEvents.length}
            onChange={({ page: nextPage, pageSize: nextSize }) => {
              setPage(nextSize === pageSize ? nextPage : 1);
              setPageSize(nextSize);
            }}
          />
        </div>
      )}
      {open && (
        <Modal
          open
          modalHeading={
            editing
              ? t("editEvent", "Editar evento notificable")
              : t("newEvent", "Nuevo evento")
          }
          primaryButtonText={t("save", "Guardar")}
          secondaryButtonText={t("cancel", "Cancelar")}
          primaryButtonDisabled={busy}
          onRequestClose={() => {
            if (!busy) setOpen(false);
          }}
          onRequestSubmit={save}
        >
          <div
            className={styles.form}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            {formError && <ErrorNotification error={formError} />}
            {busy && (
              <InlineLoading description={t("saving", "Guardando...")} />
            )}
            <ComboBox
              id="event-concept"
              {...fieldProps("conceptUuid")}
              titleText={
                <RequiredFieldLabel>
                  {t("eventsTable.concept", "Enfermedad (Concepto)")}
                </RequiredFieldLabel>
              }
              items={concepts}
              selectedItem={concept}
              itemToString={(item) => item?.display ?? ""}
              onInputChange={search}
              onChange={({ selectedItem }) => {
                setConcept(selectedItem ?? null);
                clearField("conceptUuid");
              }}
            />
            <Select
              id="event-periodicity"
              {...fieldProps("periodicity")}
              labelText={
                <RequiredFieldLabel>
                  {t("period", "Periodicidad")}
                </RequiredFieldLabel>
              }
              value={periodicity}
              onChange={(event) => {
                setPeriodicity(
                  event.target.value as SurveillanceEvent["periodicity"],
                );
                clearField("periodicity");
              }}
            >
              <SelectItem
                value="SEMANAL"
                text={t("periodicityValues.SEMANAL", "Semanal")}
              />
              <SelectItem
                value="INMEDIATA"
                text={t("periodicityValues.INMEDIATA", "Inmediata")}
              />
            </Select>
            <TextInput
              id="event-reference-regulation"
              {...fieldProps("referenceRegulation")}
              labelText={
                <RequiredFieldLabel>
                  {t("referenceRegulation", "Norma de referencia")}
                </RequiredFieldLabel>
              }
              value={referenceRegulation}
              onChange={(event) => {
                setReferenceRegulation(event.target.value);
                clearField("referenceRegulation");
              }}
            />
            <Select
              id="event-active"
              labelText={
                <RequiredFieldLabel>
                  {t("eventState", "Estado")}
                </RequiredFieldLabel>
              }
              required
              value={active ? "active" : "inactive"}
              disabled={busy}
              onChange={(event) => setActive(event.target.value === "active")}
            >
              <SelectItem value="active" text={t("eventActive", "Activo")} />
              <SelectItem
                value="inactive"
                text={t("eventInactive", "Inactivo")}
              />
            </Select>
          </div>
        </Modal>
      )}
    </section>
  );
}
