import {
  Button,
  InlineLoading,
  Modal,
  Select,
  SelectItem,
  TextInput,
} from "@carbon/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getEncounterObservations,
  getPatient,
  getSurveillanceCase,
  updateSurveillanceCase,
  SurveillanceApiError,
} from "./api";
import {
  dateInZone,
  findDiagnosisMapping,
  patientAge,
  patientDni,
  patientName,
} from "./case-form.utils";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import { InfectionAddressSelector } from "./infection-address-selector.component";
import type {
  Catalogue,
  FhirResource,
  SurveillanceCase,
  SurveillanceCaseDraft,
} from "./types";
import styles from "./dashboard.scss";
import {
  classifyLaboratoryObservation,
  laboratoryLabel,
} from "./laboratory.utils";
import { getEncounterDiagnosesDetails } from "./api";

const dateFields = [
  "onsetDate",
  "investigationDate",
  "notificationDate",
  "deathDate",
] as const;
const options = {
  diagnosisType: ["CONFIRMADO", "PROBABLE", "DESCARTADO"],
  origin: [
    "AUTOCTONO",
    "IMPORTADO_NACIONAL",
    "IMPORTADO_INTERNACIONAL",
    "INDUCIDO",
    "INTRODUCIDO",
    "RECAIDA",
    "RECRUDESCENCIA",
  ],
  vaccinationStatus: ["SI", "NO", "IGN"],
  surveillanceType: ["PASIVA", "BUSQUEDA_ACTIVA"],
} as const;

// PUT is a replacement: copy only the request contract, never patient demographics or response metadata.
export function caseUpdatePayload(
  value: SurveillanceCaseDraft,
): SurveillanceCaseDraft {
  return {
    patientUuid: value.patientUuid,
    encounterUuid: value.encounterUuid,
    providerUuid: value.providerUuid,
    locationUuid: value.locationUuid,
    diagnosisUuid: value.diagnosisUuid,
    diagnosisType: value.diagnosisType,
    origin: value.origin || undefined,
    vaccinationStatus: value.vaccinationStatus || undefined,
    surveillanceType: value.surveillanceType || undefined,
    onsetDate: value.onsetDate || undefined,
    investigationDate: value.investigationDate || undefined,
    notificationDate: value.notificationDate || undefined,
    deathDate: value.deathDate || undefined,
    infectionAddressUuid: value.infectionAddressUuid || undefined,
    testOrderUuid: value.testOrderUuid || undefined,
    laboratoryObservationUuid: value.laboratoryObservationUuid || undefined,
  };
}

export function CaseModal({
  uuid,
  mode,
  catalogue,
  onClose,
  onSaved,
}: {
  uuid: string;
  mode: "view" | "edit";
  catalogue: Catalogue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(moduleName);
  const [value, setValue] = useState<SurveillanceCase>();
  const [patient, setPatient] = useState<FhirResource>();
  const [observations, setObservations] = useState<FhirResource[]>([]);
  const [disease, setDisease] =
    useState<Catalogue["catalog"]["diseases"][number]>();
  const [infectionDisplay, setInfectionDisplay] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  // Keep editing enabled while entering a NEW death date; the saved record determines the lock.
  const [locked, setLocked] = useState(false);
  const canEdit = mode === "edit" && !!value && !locked;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry reloads the same case.
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError(undefined);
    setValue(undefined);
    void (async () => {
      const record = await getSurveillanceCase(uuid, abort.signal);
      const person = await getPatient(record.patientUuid, abort.signal);
      const labs = await getEncounterObservations(
        record.encounterUuid,
        record.patientUuid,
        abort.signal,
      );
      const diagnoses = await getEncounterDiagnosesDetails(
        record.encounterUuid,
        record.patientUuid,
        abort.signal,
      );
      const diagnosis = diagnoses.find(
        (item) => item.uuid === record.diagnosisUuid,
      );
      const mapping =
        diagnosis && findDiagnosisMapping(diagnosis.conceptUuid, catalogue);
      const caseDisease = catalogue.catalog.diseases.find(
        (item) => item.eventUuid === mapping?.eventUuid,
      );
      if (!abort.signal.aborted) {
        setDisease(caseDisease);
        setInfectionDisplay(record.infectionAddressDisplay || "");
        setValue(record);
        setPatient(person);
        setObservations(labs);
        setLocked(!!record.deathDate);
      }
    })()
      .catch((reason) => {
        if (!abort.signal.aborted) setError(reason);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [uuid, mode, retry, catalogue]);
  const change = (key: keyof SurveillanceCaseDraft, next: string) =>
    setValue((current) => (current ? { ...current, [key]: next } : current));
  const save = async () => {
    if (!value || !canEdit || submitting.current) return;
    const onset = value.onsetDate;
    if (
      onset &&
      dateFields.slice(1).some((key) => {
        const date = value[key];
        return date && date < onset;
      })
    ) {
      setError(new SurveillanceApiError("INVALID_DATE_RANGE", 422));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await updateSurveillanceCase(uuid, caseUpdatePayload(value));
      onSaved();
    } catch (reason) {
      setError(reason);
      if (
        reason instanceof SurveillanceApiError &&
        reason.code === "CASE_CLOSED"
      )
        setLocked(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const fieldLabel = (key: string) => t(`caseDetails.fields.${key}`);
  const labResults = observations.filter(
    (obs) =>
      classifyLaboratoryObservation(obs, catalogue.catalog, disease) !== null,
  );
  const selectedResult = observations.find(
    (obs) => obs.id === value?.laboratoryObservationUuid,
  );
  const resultDisplay = selectedResult
    ? laboratoryLabel(selectedResult)
    : value?.laboratoryObservationDisplay;
  const enumLabel = (key: string, entry?: string) =>
    entry ? t(`caseDetails.values.${key}.${entry}`, entry) : "—";
  const detail = (key: string, label: string, content?: string | number) => (
    <div key={key}>
      <dt>{label}</dt>
      <dd>{content === undefined || content === "" ? "—" : content}</dd>
    </div>
  );
  return (
    <Modal
      open
      size="lg"
      passiveModal={mode === "view" || locked}
      modalHeading={t(
        mode === "view" ? "caseDetails.view" : "caseDetails.edit",
      )}
      primaryButtonText={t("save", "Guardar")}
      secondaryButtonText={t("cancel", "Cancelar")}
      primaryButtonDisabled={
        loading || busy || !canEdit || !value?.diagnosisType
      }
      onRequestClose={() => {
        if (!busy) onClose();
      }}
      onRequestSubmit={save}
    >
      {loading && <InlineLoading description={t("loading", "Cargando")} />}
      {error && <ErrorNotification error={error} />}
      {!loading && !value && (
        <Button
          kind="tertiary"
          onClick={() => setRetry((current) => current + 1)}
        >
          {t("retry", "Reintentar")}
        </Button>
      )}
      {!loading && value && (
        <div className={styles.form}>
          <dl className={styles.caseDetails}>
            {detail(
              "dni",
              t("casesTable.dni"),
              patient ? patientDni(patient) : value.patientIdentifier,
            )}
            {detail(
              "name",
              t("casesTable.patient"),
              patient ? patientName(patient) : value.patientDisplay,
            )}
            {detail(
              "sex",
              t("casesTable.sex"),
              enumLabel("sex", patient?.gender ?? value.patientSex),
            )}
            {detail(
              "age",
              t("casesTable.age"),
              patientAge(
                patient?.birthDate ?? value.patientBirthDate,
                dateInZone(catalogue.catalog.timezone),
              ),
            )}
            {detail(
              "residence",
              t("caseDetails.residence"),
              patient?.residence,
            )}
            {detail(
              "diagnosis",
              t("casesTable.diagnosis"),
              value.diagnosisDisplay,
            )}
            {detail(
              "encounter",
              fieldLabel("encounterUuid"),
              [value.encounterDate?.slice(0, 10), value.encounterDisplay]
                .filter(Boolean)
                .join(" · "),
            )}
            {detail(
              "provider",
              fieldLabel("providerUuid"),
              value.providerDisplay,
            )}
            {detail(
              "location",
              fieldLabel("locationUuid"),
              value.locationDisplay,
            )}
            {detail(
              "diagnosisEncounter",
              fieldLabel("diagnosisUuid"),
              value.encounterDisplay,
            )}
          </dl>
          {locked && <p>{t("caseDetails.locked")}</p>}
          {canEdit ? (
            <fieldset disabled={busy} className={styles.caseEditFields}>
              <legend>{t("caseDetails.editableFields")}</legend>
              {Object.entries(options).map(([key, choices]) => (
                <Select
                  key={key}
                  id={`edit-${key}`}
                  labelText={fieldLabel(key)}
                  disabled={key === "diagnosisType"}
                  value={value[key as keyof SurveillanceCase] ?? ""}
                  onChange={(event) =>
                    change(
                      key as keyof SurveillanceCaseDraft,
                      event.target.value,
                    )
                  }
                >
                  {key !== "diagnosisType" && (
                    <SelectItem value="" text={t("notAvailable")} />
                  )}
                  {choices.map((entry) => (
                    <SelectItem
                      key={entry}
                      value={entry}
                      text={enumLabel(key, entry)}
                    />
                  ))}
                </Select>
              ))}
              {dateFields.map((key) => (
                <TextInput
                  key={key}
                  id={`edit-${key}`}
                  type="date"
                  labelText={fieldLabel(key)}
                  value={value[key]?.slice(0, 10) ?? ""}
                  onChange={(event) => change(key, event.target.value)}
                />
              ))}
              {value.deathDate && <p>{t("caseDetails.deathWarning")}</p>}
              <InfectionAddressSelector
                value={value.infectionAddressUuid}
                display={infectionDisplay}
                onChange={(next, display) => {
                  change("infectionAddressUuid", next);
                  setInfectionDisplay(display || "");
                }}
              />
              <Select
                id="edit-laboratory"
                labelText={fieldLabel("laboratoryObservationUuid")}
                value={value.laboratoryObservationUuid || ""}
                onChange={(event) => {
                  const obs = labResults.find(
                    (item) => item.id === event.target.value,
                  );
                  const classification =
                    obs &&
                    classifyLaboratoryObservation(
                      obs,
                      catalogue.catalog,
                      disease,
                    );
                  setValue((current) =>
                    current
                      ? {
                          ...current,
                          laboratoryObservationUuid: obs?.id,
                          laboratoryObservationDisplay: undefined,
                          testOrderUuid: obs?.orderUuid,
                          testOrderDisplay: obs?.orderDisplay,
                          diagnosisType:
                            classification === "CONFIRMED"
                              ? "CONFIRMADO"
                              : classification === "DISCARDED"
                                ? "DESCARTADO"
                                : "PROBABLE",
                        }
                      : current,
                  );
                }}
              >
                <SelectItem value="" text={t("notAvailable")} />
                {value.laboratoryObservationUuid &&
                  !labResults.some(
                    (obs) => obs.id === value.laboratoryObservationUuid,
                  ) && (
                    <SelectItem
                      value={value.laboratoryObservationUuid}
                      text={resultDisplay || t("notAvailable")}
                    />
                  )}
                {labResults.map((obs) => (
                    <SelectItem
                      key={obs.id}
                      value={obs.id}
                      text={laboratoryLabel(obs) || t("laboratoryResult")}
                    />
                  ))}
              </Select>
            </fieldset>
          ) : (
            <dl className={styles.caseDetails}>
              {Object.keys(options).map((key) =>
                detail(
                  key,
                  fieldLabel(key),
                  enumLabel(key, value[key as keyof SurveillanceCase]),
                ),
              )}
              {dateFields.map((key) =>
                detail(key, fieldLabel(key), value[key]),
              )}
              {detail(
                "infection",
                fieldLabel("infectionAddressUuid"),
                infectionDisplay,
              )}
              {detail(
                "result",
                fieldLabel("laboratoryObservationUuid"),
                resultDisplay,
              )}
            </dl>
          )}
          {busy && <InlineLoading description={t("saving", "Guardando...")} />}
        </div>
      )}
    </Modal>
  );
}
