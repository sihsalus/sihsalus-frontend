import {
  Button,
  ComboBox,
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
  TextInput,
} from "@carbon/react";
import { Edit, View } from "@carbon/react/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import styles from "./dashboard.scss";
import { listSurveillanceCases, searchPatients } from "./api";
import { patientAge, patientDni, patientName } from "./case-form.utils";
import { ErrorNotification } from "./error-notification.component";
import { CaseModal } from "./case-modal.component";
import { TablePagination } from "./table-pagination.component";
import type { Catalogue, FhirResource, SurveillanceCase } from "./types";

export function CasesPanel({
  catalogue,
  revision,
  onNewCase,
}: {
  catalogue: Catalogue;
  revision: number;
  onNewCase: () => void;
}) {
  const { t } = useTranslation(moduleName);
  const [selectedCase, setSelectedCase] = useState<{
    uuid: string;
    mode: "view" | "edit";
  }>();
  const [savedRevision, setSavedRevision] = useState(0);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [cases, setCases] = useState<SurveillanceCase[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [patients, setPatients] = useState<FhirResource[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload after a new case increments revision.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    void listSurveillanceCases(
      Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== ""),
      ),
    )
      .then((result) => {
        if (active) {
          setCases(result);
          setPage(1);
        }
      })
      .catch((reason) => {
        if (active) setError(reason);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, revision, savedRevision]);
  const update = (key: string, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  return (
    <>
      <Button kind="tertiary" onClick={onNewCase}>
        Nuevo caso
      </Button>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
          marginBlock: "1rem",
        }}
      >
        <ComboBox
          id="case-filter-patient"
          titleText="Paciente"
          items={patients}
          itemToString={(item) =>
            item ? `${patientName(item)} · DNI: ${patientDni(item)}` : ""
          }
          placeholder="Buscar y seleccionar paciente"
          onInputChange={(value) => {
            if (value.trim().length > 1)
              void searchPatients(value).then(setPatients);
          }}
          onChange={({ selectedItem }) =>
            update("patient", selectedItem?.id ?? "")
          }
        />
        <Select
          id="case-filter-diagnosis"
          labelText="Diagnóstico"
          value={filters.diagnosisConcept ?? ""}
          onChange={(event) => update("diagnosisConcept", event.target.value)}
        >
          <SelectItem value="" text="Todos" />
          {catalogue.events.map((event) => (
            <SelectItem
              key={event.uuid}
              value={event.conceptUuid}
              text={
                event.conceptDisplay ||
                t(
                  "casesTable.diagnosisUnavailable",
                  "Diagnóstico no disponible",
                )
              }
            />
          ))}
        </Select>
        <TextInput
          id="case-filter-onset-from"
          type="date"
          labelText="Inicio de síntomas desde"
          value={filters.onsetFrom ?? ""}
          onChange={(event) => update("onsetFrom", event.target.value)}
        />
        <TextInput
          id="case-filter-onset-to"
          type="date"
          labelText="Inicio de síntomas hasta"
          value={filters.onsetTo ?? ""}
          onChange={(event) => update("onsetTo", event.target.value)}
        />
        <TextInput
          id="case-filter-notification-from"
          type="date"
          labelText="Notificación desde"
          value={filters.notificationFrom ?? ""}
          onChange={(event) => update("notificationFrom", event.target.value)}
        />
        <TextInput
          id="case-filter-notification-to"
          type="date"
          labelText="Notificación hasta"
          value={filters.notificationTo ?? ""}
          onChange={(event) => update("notificationTo", event.target.value)}
        />
        <Select
          id="case-filter-fatal"
          labelText="Fallecimiento registrado"
          value={filters.fatal ?? ""}
          onChange={(event) => update("fatal", event.target.value)}
        >
          <SelectItem value="" text="Todos" />
          <SelectItem value="false" text="No" />
          <SelectItem value="true" text="Sí" />
        </Select>
      </div>
      {loading ? <InlineLoading description="Cargando casos" /> : null}
      {error ? <ErrorNotification error={error} /> : null}
      {!loading && !error && (
        <div className={styles.tableWrapper}>
          <TableContainer title={t("casesTable.title", "Casos registrados")}>
            <Table
              size="lg"
              useZebraStyles
              className={styles.recordsTable}
              aria-label={t("casesTable.title", "Casos registrados")}
            >
              <TableHead>
                <TableRow>
                  <TableHeader>{t("casesTable.dni", "DNI")}</TableHeader>
                  <TableHeader>
                    {t("casesTable.patient", "Apellidos y nombres")}
                  </TableHeader>
                  <TableHeader>{t("casesTable.age", "Edad")}</TableHeader>
                  <TableHeader>{t("casesTable.sex", "Sexo")}</TableHeader>
                  <TableHeader>
                    {t("casesTable.diagnosis", "Diagnóstico")}
                  </TableHeader>
                  <TableHeader>
                    {t("casesTable.onset", "Inicio de síntomas")}
                  </TableHeader>
                  <TableHeader>
                    {t("casesTable.notification", "Notificación")}
                  </TableHeader>
                  <TableHeader>
                    {t("casesTable.actions", "Acciones")}
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {cases
                  .slice((page - 1) * pageSize, page * pageSize)
                  .map((item) => (
                    <TableRow key={item.uuid}>
                      <TableCell>{item.patientIdentifier || "—"}</TableCell>
                      <TableCell className={styles.patientCell}>
                        {item.patientDisplay || "—"}
                      </TableCell>
                      <TableCell>
                        {item.patientBirthDate
                          ? (patientAge(
                              item.patientBirthDate,
                              new Date().toISOString().slice(0, 10),
                            ) ?? "—")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {item.patientSex === "M"
                          ? t("casesTable.male", "Masculino")
                          : item.patientSex === "F"
                            ? t("casesTable.female", "Femenino")
                            : item.patientSex || "—"}
                      </TableCell>
                      <TableCell className={styles.diagnosisCell}>
                        {item.diagnosisDisplay ||
                          t(
                            "casesTable.diagnosisUnavailable",
                            "Diagnóstico no disponible",
                          )}
                      </TableCell>
                      <TableCell className={styles.dateCell}>
                        {item.onsetDate || "—"}
                      </TableCell>
                      <TableCell className={styles.dateCell}>
                        {item.notificationDate || "—"}
                      </TableCell>
                      <TableCell>
                        <div className={styles.cellActions}>
                          <Button
                            kind="ghost"
                            size="sm"
                            hasIconOnly
                            renderIcon={View}
                            iconDescription={t("casesTable.view", "Ver caso")}
                            onClick={() =>
                              setSelectedCase({ uuid: item.uuid, mode: "view" })
                            }
                          />
                          <Button
                            kind="ghost"
                            size="sm"
                            renderIcon={Edit}
                            hasIconOnly
                            iconDescription={t("edit", "Editar")}
                            onClick={() =>
                              setSelectedCase({ uuid: item.uuid, mode: "edit" })
                            }
                            disabled={!!item.deathDate}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                {cases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      {t(
                        "casesTable.empty",
                        "No hay casos para los filtros seleccionados.",
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={cases.length}
            onChange={({ page: nextPage, pageSize: nextSize }) => {
              setPage(nextSize === pageSize ? nextPage : 1);
              setPageSize(nextSize);
            }}
          />
        </div>
      )}
      {selectedCase && (
        <CaseModal
          key={`${selectedCase.uuid}-${selectedCase.mode}`}
          {...selectedCase}
          catalogue={catalogue}
          onClose={() => setSelectedCase(undefined)}
          onSaved={() => {
            setSelectedCase(undefined);
            setSavedRevision((current) => current + 1);
          }}
        />
      )}
    </>
  );
}
