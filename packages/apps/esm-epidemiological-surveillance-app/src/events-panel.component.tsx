import { Add } from "@carbon/react/icons";
import { Button, ComboBox, DataTable, InlineLoading, Modal, Select, SelectItem, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, TextInput } from "@carbon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getEvents, saveEvent, searchConcepts, type RestConcept } from "./api";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import type { Catalogue, SurveillanceEvent } from "./types";
import styles from "./dashboard.scss";

const today = () => new Date().toISOString().slice(0, 10);

export function EventsPanel({ catalogue: _catalogue, onEventsChanged }: { catalogue?: Catalogue; onEventsChanged?: () => void }) {
  const { t } = useTranslation(moduleName);
  const [events, setEvents] = useState<SurveillanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [open, setOpen] = useState(false);
  const [concept, setConcept] = useState<RestConcept | null>(null);
  const [concepts, setConcepts] = useState<RestConcept[]>([]);
  const [periodicity, setPeriodicity] = useState<SurveillanceEvent["periodicity"]>("SEMANAL");
  const [referenceRegulation, setReferenceRegulation] = useState("");
  const [validFrom, setValidFrom] = useState(today());
  const [validTo, setValidTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<unknown>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(() => getEvents(true).then(setEvents).catch(setError).finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);
  const search = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) return setConcepts([]);
    timer.current = setTimeout(() => searchConcepts(value).then(setConcepts).catch(() => setConcepts([])), 250);
  };
  const create = async () => {
    if (!concept || !referenceRegulation.trim() || !validFrom) return setFormError({ responseBody: { code: "REQUIRED_FIELDS" } });
    setBusy(true); setFormError(undefined);
    try {
      await saveEvent({ conceptUuid: concept.uuid, periodicity, referenceRegulation: referenceRegulation.trim(), validFrom, validTo: validTo || undefined });
      setOpen(false); load(); onEventsChanged?.();
    } catch (reason) { setFormError(reason); } finally { setBusy(false); }
  };
  const headers = ["concept", "periodicity", "reference", "from", "to"].map((key) => ({ key, header: t(`eventsTable.${key}`, key) }));
  const rows = events.map((event) => ({ id: event.uuid, concept: event.conceptDisplay ?? event.conceptUuid, periodicity: event.periodicity, reference: event.referenceRegulation, from: event.validFrom, to: event.validTo ?? "—" }));
  return <section aria-label={t("events", "Eventos")} className={styles.form}>
    {error && <ErrorNotification error={error} />}
    <div className={styles.actions}><Button kind="primary" renderIcon={Add} onClick={() => { setConcept(null); setReferenceRegulation(""); setValidFrom(today()); setValidTo(""); setFormError(undefined); setOpen(true); }}>{t("newEvent", "Nueva versión de evento")}</Button></div>
    {loading ? <InlineLoading description={t("loading", "Cargando")} /> : <DataTable rows={rows} headers={headers}>{({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => <TableContainer title={t("notifiableEvents", "Eventos notificables")}><Table {...getTableProps()}><TableHead><TableRow>{tableHeaders.map((header) => { const { key, ...headerProps } = getHeaderProps({ header }); return <TableHeader key={key} {...headerProps}>{header.header}</TableHeader>; })}</TableRow></TableHead><TableBody>{tableRows.map((row) => { const { key, ...rowProps } = getRowProps({ row }); return <TableRow key={key} {...rowProps}>{row.cells.map((cell) => <TableCell key={cell.id}>{cell.value}</TableCell>)}</TableRow>; })}</TableBody></Table></TableContainer>}</DataTable>}
    {open && <Modal open modalHeading={t("newEvent", "Nueva versión de evento notificable")} primaryButtonText={t("save", "Guardar")} secondaryButtonText={t("cancel", "Cancelar")} primaryButtonDisabled={busy || !concept || !referenceRegulation.trim() || !validFrom} onRequestClose={() => setOpen(false)} onRequestSubmit={create}><div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>{formError && <ErrorNotification error={formError} />}{busy && <InlineLoading description={t("saving", "Guardando...")} />}<ComboBox id="event-concept" titleText={t("eventsTable.concept", "Enfermedad (Concepto)")} items={concepts} selectedItem={concept} itemToString={(item) => item?.display ?? ""} onInputChange={search} onChange={({ selectedItem }) => setConcept(selectedItem ?? null)} /><Select id="event-periodicity" labelText={t("period", "Periodicidad")} value={periodicity} onChange={(event) => setPeriodicity(event.target.value as SurveillanceEvent["periodicity"])}><SelectItem value="SEMANAL" text={t("periodicityValues.SEMANAL", "Semanal")} /><SelectItem value="INMEDIATA" text={t("periodicityValues.INMEDIATA", "Inmediata")} /><SelectItem value="DIARIA" text={t("periodicityValues.DIARIA", "Diaria")} /></Select><TextInput id="event-reference-regulation" labelText={t("referenceRegulation", "Norma de referencia")} value={referenceRegulation} onChange={(event) => setReferenceRegulation(event.target.value)} /><TextInput id="event-valid-from" type="date" labelText={t("validFrom", "Vigente desde")} value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /><TextInput id="event-valid-to" type="date" labelText={t("validTo", "Vigente hasta (opcional)")} value={validTo} onChange={(event) => setValidTo(event.target.value)} /></div></Modal>}
  </section>;
}
