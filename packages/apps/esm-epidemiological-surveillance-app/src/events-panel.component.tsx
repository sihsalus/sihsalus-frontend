import {
  Button,
  ComboBox,
  DataTable,
  InlineLoading,
  Modal,
  NumberInput,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
} from "@carbon/react";
import { Add, Edit, TrashCan } from "@carbon/react/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteEvent,
  getEvents,
  saveEvent,
  searchConcepts,
  updateEvent,
  type RestConcept,
} from "./api";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import type { Catalogue, SurveillanceEvent } from "./types";
import styles from "./dashboard.scss";

export function EventsPanel({
  catalogue: _catalogue,
  onEventsChanged,
}: {
  catalogue?: Catalogue;
  onEventsChanged?: () => void;
}) {
  const { t } = useTranslation(moduleName);
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [includeRetired, setIncludeRetired] = useState(false);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<SurveillanceEvent | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formConceptUuid, setFormConceptUuid] = useState("");
  const [formConceptDisplay, setFormConceptDisplay] = useState("");
  const [formPeriodicity, setFormPeriodicity] = useState("semanal");
  const [formDeadlineDays, setFormDeadlineDays] = useState(7);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<unknown>();

  // Concept search
  const [concepts, setConcepts] = useState<RestConcept[]>([]);
  const [searchingConcepts, setSearchingConcepts] = useState(false);
  const conceptSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadEvents = useCallback((showRetired: boolean) => {
    setLoading(true);
    setError(undefined);
    getEvents(showRetired)
      .then((data) => {
        setEvents(data);
      })
      .catch((err) => {
        setError(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadEvents(includeRetired);
  }, [includeRetired, loadEvents]);

  const handleConceptSearch = (input: string) => {
    if (conceptSearchTimer.current) {
      clearTimeout(conceptSearchTimer.current);
    }
    if (!input || input.trim().length < 2) {
      setConcepts([]);
      return;
    }
    conceptSearchTimer.current = setTimeout(() => {
      setSearchingConcepts(true);
      searchConcepts(input)
        .then((results) => setConcepts(results))
        .catch(() => setConcepts([]))
        .finally(() => setSearchingConcepts(false));
    }, 250);
  };

  const openCreateModal = () => {
    setFormName("");
    setFormConceptUuid("");
    setFormConceptDisplay("");
    setFormPeriodicity("semanal");
    setFormDeadlineDays(7);
    setFormError(undefined);
    setConcepts([]);
    setIsCreateOpen(true);
  };

  const openEditModal = (event: SurveillanceEvent) => {
    setActiveEvent(event);
    setFormName(event.name);
    setFormConceptUuid(event.conceptUuid);
    setFormConceptDisplay(event.conceptDisplay || event.conceptUuid);
    setFormPeriodicity(event.periodicity);
    setFormDeadlineDays(event.deadlineDays);
    setFormError(undefined);
    setIsEditOpen(true);
  };

  const openDeleteModal = (event: SurveillanceEvent) => {
    setActiveEvent(event);
    setFormError(undefined);
    setIsDeleteOpen(true);
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formConceptUuid) {
      setFormError({ responseBody: { code: "REQUIRED_FIELDS" } });
      return;
    }
    setFormBusy(true);
    setFormError(undefined);
    try {
      await saveEvent({
        uuid: globalThis.crypto.randomUUID(),
        name: formName.trim(),
        conceptUuid: formConceptUuid,
        periodicity: formPeriodicity,
        deadlineDays: formDeadlineDays,
      });
      setIsCreateOpen(false);
      loadEvents(includeRetired);
      onEventsChanged?.();
    } catch (err) {
      setFormError(err);
    } finally {
      setFormBusy(false);
    }
  };

  const handleEdit = async () => {
    if (!activeEvent) return;
    if (!formName.trim()) {
      setFormError({ responseBody: { code: "REQUIRED_FIELDS" } });
      return;
    }
    setFormBusy(true);
    setFormError(undefined);
    try {
      await updateEvent(activeEvent.uuid, {
        uuid: activeEvent.uuid,
        name: formName.trim(),
        conceptUuid: activeEvent.conceptUuid,
        periodicity: formPeriodicity,
        deadlineDays: formDeadlineDays,
      });
      setIsEditOpen(false);
      loadEvents(includeRetired);
      onEventsChanged?.();
    } catch (err) {
      setFormError(err);
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!activeEvent) return;
    setFormBusy(true);
    setFormError(undefined);
    try {
      await deleteEvent(activeEvent.uuid);
      setIsDeleteOpen(false);
      loadEvents(includeRetired);
      onEventsChanged?.();
    } catch (err) {
      setFormError(err);
    } finally {
      setFormBusy(false);
    }
  };

  const headers = [
    { key: "name", header: t("eventsTable.name", "Nombre del evento") },
    { key: "concept", header: t("eventsTable.concept", "Enfermedad (Concepto)") },
    { key: "periodicity", header: t("period", "Periodicidad") },
    { key: "deadlineDays", header: t("eventsTable.deadlineDays", "Plazo (días)") },
    { key: "status", header: t("eventsTable.status", "Estado") },
    { key: "actions", header: t("actions", "Acciones") },
  ];

  const rows = events.map((ev) => ({
    id: ev.uuid,
    name: ev.name,
    concept: ev.conceptDisplay || ev.conceptUuid,
    periodicity: t(`periodicityValues.${ev.periodicity}`, ev.periodicity),
    deadlineDays: ev.deadlineDays,
    status: ev.retired
      ? t("eventsTable.retired", "Retirado")
      : t("eventsTable.active", "Activo"),
    retired: ev.retired,
    raw: ev,
  }));

  return (
    <section aria-label={t("events", "Eventos")} className={styles.form}>
      {error && <ErrorNotification error={error} />}
      <div className={styles.actions}>
        <Button
          kind="primary"
          renderIcon={Add}
          onClick={openCreateModal}
        >
          {t("newEvent", "Nuevo evento")}
        </Button>
        <Button
          kind="ghost"
          onClick={() => setIncludeRetired((prev) => !prev)}
        >
          {includeRetired
            ? t("eventsTable.hideRetired", "Ocultar retirados")
            : t("eventsTable.showRetired", "Mostrar retirados")}
        </Button>
      </div>

      {loading ? (
        <InlineLoading description={t("loading", "Cargando")} />
      ) : (
        <DataTable rows={rows} headers={headers}>
          {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
            <TableContainer title={t("notifiableEvents", "Eventos Notificables")}>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {tableHeaders.map((header) => (
                      <TableHeader key={header.key} {...getHeaderProps({ header })}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map((row) => {
                    const rowData = rows.find((r) => r.id === row.id);
                    return (
                      <TableRow key={row.id} {...getRowProps({ row })}>
                        <TableCell>{rowData?.name}</TableCell>
                        <TableCell>{rowData?.concept}</TableCell>
                        <TableCell>{rowData?.periodicity}</TableCell>
                        <TableCell>{rowData?.deadlineDays}</TableCell>
                        <TableCell>
                          <Tag type={rowData?.retired ? "red" : "green"}>
                            {rowData?.status}
                          </Tag>
                        </TableCell>
                        <TableCell>
                          {!rowData?.retired && (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <Button
                                kind="ghost"
                                hasIconOnly
                                renderIcon={Edit}
                                iconDescription={t("edit", "Editar")}
                                tooltipPosition="top"
                                onClick={() => rowData?.raw && openEditModal(rowData.raw)}
                              />
                              <Button
                                kind="ghost"
                                hasIconOnly
                                renderIcon={TrashCan}
                                iconDescription={t("retire", "Retirar")}
                                tooltipPosition="top"
                                onClick={() => rowData?.raw && openDeleteModal(rowData.raw)}
                              />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}

      {/* Modal Crear Evento */}
      {isCreateOpen && (
        <Modal
          open={isCreateOpen}
          modalHeading={t("newEvent", "Nuevo evento notificable")}
          primaryButtonText={t("save", "Guardar")}
          secondaryButtonText={t("cancel", "Cancelar")}
          primaryButtonDisabled={formBusy || !formName.trim() || !formConceptUuid}
          onRequestClose={() => setIsCreateOpen(false)}
          onRequestSubmit={handleCreate}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            {formError && <ErrorNotification error={formError} />}
            {formBusy && <InlineLoading description={t("saving", "Guardando...")} />}
            <TextInput
              id="event-name-create"
              labelText={t("eventsTable.name", "Nombre del evento")}
              placeholder={t("eventsTable.namePlaceholder", "Ej. Dengue, Malaria...")}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <ComboBox
              id="event-concept-select"
              titleText={t("eventsTable.concept", "Enfermedad (Concepto)")}
              placeholder={t("eventsTable.searchConcept", "Escriba para buscar concepto...")}
              items={concepts}
              itemToString={(item) => (item ? item.display : "")}
              onInputChange={handleConceptSearch}
              onChange={({ selectedItem }) => {
                setFormConceptUuid(selectedItem?.uuid ?? "");
                setFormConceptDisplay(selectedItem?.display ?? "");
              }}
            />
            {searchingConcepts && <InlineLoading description={t("searching", "Buscando...")} />}
            <Select
              id="event-periodicity-create"
              labelText={t("period", "Periodicidad")}
              value={formPeriodicity}
              onChange={(e) => setFormPeriodicity(e.target.value)}
            >
              <SelectItem value="semanal" text={t("periodicityValues.semanal", "Semanal")} />
              <SelectItem value="inmediata" text={t("periodicityValues.inmediata", "Inmediata")} />
              <SelectItem value="diaria" text={t("periodicityValues.diaria", "Diaria")} />
            </Select>
            <NumberInput
              id="event-deadline-create"
              label={t("eventsTable.deadlineDays", "Plazo de notificación (días)")}
              min={0}
              max={365}
              value={formDeadlineDays}
              onChange={(_e, { value }) => setFormDeadlineDays(Number(value) || 0)}
            />
          </div>
        </Modal>
      )}

      {/* Modal Editar Evento */}
      {isEditOpen && (
        <Modal
          open={isEditOpen}
          modalHeading={t("editEvent", "Editar evento notificable")}
          primaryButtonText={t("save", "Guardar")}
          secondaryButtonText={t("cancel", "Cancelar")}
          primaryButtonDisabled={formBusy || !formName.trim()}
          onRequestClose={() => setIsEditOpen(false)}
          onRequestSubmit={handleEdit}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            {formError && <ErrorNotification error={formError} />}
            {formBusy && <InlineLoading description={t("saving", "Guardando...")} />}
            <TextInput
              id="event-name-edit"
              labelText={t("eventsTable.name", "Nombre del evento")}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <TextInput
              id="event-concept-edit"
              labelText={t("eventsTable.concept", "Enfermedad (Concepto)")}
              value={formConceptDisplay}
              disabled
            />
            <Select
              id="event-periodicity-edit"
              labelText={t("period", "Periodicidad")}
              value={formPeriodicity}
              onChange={(e) => setFormPeriodicity(e.target.value)}
            >
              <SelectItem value="semanal" text={t("periodicityValues.semanal", "Semanal")} />
              <SelectItem value="inmediata" text={t("periodicityValues.inmediata", "Inmediata")} />
              <SelectItem value="diaria" text={t("periodicityValues.diaria", "Diaria")} />
            </Select>
            <NumberInput
              id="event-deadline-edit"
              label={t("eventsTable.deadlineDays", "Plazo de notificación (días)")}
              min={0}
              max={365}
              value={formDeadlineDays}
              onChange={(_e, { value }) => setFormDeadlineDays(Number(value) || 0)}
            />
          </div>
        </Modal>
      )}

      {/* Modal Retirar Evento */}
      {isDeleteOpen && (
        <Modal
          open={isDeleteOpen}
          danger
          modalHeading={t("retireEvent", "¿Retirar evento notificable?")}
          primaryButtonText={t("retire", "Retirar")}
          secondaryButtonText={t("cancel", "Cancelar")}
          primaryButtonDisabled={formBusy}
          onRequestClose={() => setIsDeleteOpen(false)}
          onRequestSubmit={handleDelete}
        >
          <p style={{ marginTop: "1rem" }}>
            {t(
              "confirmRetireEvent",
              "¿Está seguro de que desea retirar el evento notificable \"{{name}}\"? Los eventos retirados no permitirán registrar nuevos casos.",
              { name: activeEvent?.name }
            )}
          </p>
          {formError && <ErrorNotification error={formError} />}
        </Modal>
      )}
    </section>
  );
}
