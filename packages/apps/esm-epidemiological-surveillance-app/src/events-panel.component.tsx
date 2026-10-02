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

const today = () => new Date().toISOString().slice(0, 10);

export function EventsPanel({
  catalogue: _catalogue,
  onEventsChanged,
}: {
  catalogue?: Catalogue;
  onEventsChanged?: () => void;
}) {
  const { t } = useTranslation(moduleName);
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
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
  const [validFrom, setValidFrom] = useState(today());
  const [validTo, setValidTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<unknown>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(
    () =>
      getEvents(true)
        .then((result) => {
          setEvents(result);
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
    if (!concept || !referenceRegulation.trim() || !validFrom)
      return setFormError({ responseBody: { code: "REQUIRED_FIELDS" } });
    if (validTo && validTo < validFrom)
      return setFormError({ responseBody: { code: "INVALID_EVENT" } });
    setBusy(true);
    setFormError(undefined);
    try {
      const payload = {
        conceptUuid: concept.uuid,
        periodicity,
        referenceRegulation: referenceRegulation.trim(),
        validFrom,
        validTo: validTo || null,
      };
      if (editing) await updateEvent(editing.uuid, payload);
      else await saveEvent(payload);
      setOpen(false);
      load();
      onEventsChanged?.();
    } catch (reason) {
      setFormError(reason);
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
    { key: "from", header: t("eventsTable.from", "Vigente desde") },
    { key: "to", header: t("eventsTable.to", "Vigente hasta") },
  ];
  const periodicities = {
    INMEDIATA: t("periodicityValues.inmediata", "Inmediata"),
    DIARIA: t("periodicityValues.diaria", "Diaria"),
    SEMANAL: t("periodicityValues.semanal", "Semanal"),
  };
  const rows = events.map((event) => ({
    id: event.uuid,
    concept: event.conceptDisplay ?? event.conceptUuid,
    periodicity: periodicities[event.periodicity] ?? event.periodicity,
    reference: event.referenceRegulation,
    from: event.validFrom,
    to: event.validTo ?? "—",
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
            setValidFrom(today());
            setValidTo("");
            setFormError(undefined);
            setOpen(true);
          }}
        >
          {t("newEvent", "Nueva versión de evento")}
        </Button>
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
                                setValidFrom(
                                  event.validFrom?.slice(0, 10) ?? "",
                                );
                                setValidTo(event.validTo?.slice(0, 10) ?? "");
                                setFormError(undefined);
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
            totalItems={events.length}
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
              : t("newEvent", "Nueva versión de evento notificable")
          }
          primaryButtonText={t("save", "Guardar")}
          secondaryButtonText={t("cancel", "Cancelar")}
          primaryButtonDisabled={
            busy || !concept || !referenceRegulation.trim() || !validFrom
          }
          onRequestClose={() => {
            if (!busy) setOpen(false);
          }}
          onRequestSubmit={save}
        >
          <div
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
              titleText={t("eventsTable.concept", "Enfermedad (Concepto)")}
              items={concepts}
              selectedItem={concept}
              itemToString={(item) => item?.display ?? ""}
              onInputChange={search}
              onChange={({ selectedItem }) => setConcept(selectedItem ?? null)}
            />
            <Select
              id="event-periodicity"
              labelText={t("period", "Periodicidad")}
              value={periodicity}
              onChange={(event) =>
                setPeriodicity(
                  event.target.value as SurveillanceEvent["periodicity"],
                )
              }
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
              labelText={t("referenceRegulation", "Norma de referencia")}
              value={referenceRegulation}
              onChange={(event) => setReferenceRegulation(event.target.value)}
            />
            <TextInput
              id="event-valid-from"
              type="date"
              labelText={t("validFrom", "Vigente desde")}
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
            />
            <TextInput
              id="event-valid-to"
              type="date"
              labelText={t("validTo", "Vigente hasta (opcional)")}
              value={validTo}
              onChange={(event) => setValidTo(event.target.value)}
            />
          </div>
        </Modal>
      )}
    </section>
  );
}
