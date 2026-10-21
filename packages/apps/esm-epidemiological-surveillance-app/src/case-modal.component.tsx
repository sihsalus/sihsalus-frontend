import { DateTimeInput } from "./date-time-input.component";
import { FieldError } from "./field-error.component";
import {
  caseDateErrors,
  serverFieldErrors,
  type FieldErrors,
} from "./field-validation";
import { DateInput } from "./date-input.component";
import {
  RequiredFieldLabel,
  requiredCaseFields,
} from "./required-field-label.component";
import { displayDate, displayDateTime } from "./date-display";
import {
  Button,
  InlineLoading,
  Modal,
  Select,
  SelectItem,
} from "@carbon/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  safeError,
  getEncounterObservations,
  getSurveillanceCase,
  updateSurveillanceCase,
} from "./api";
import {
  dateInZone,
  findDiagnosisMapping,
  pregnancyEligible,
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
  "notificationDate",
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
  habitualResidence: ["1", "2", "3"],
  vaccinationStatus: ["SI", "NO", "IGN"],
  deathAttribution: ["SI", "NO", "POR_DETERMINAR"],
  surveillanceType: ["PASIVA", "BUSQUEDA_ACTIVA"],
} as const;

// PUT is a replacement: copy only the request contract, never patient demographics or response metadata.
export function caseUpdatePayload(
  value: SurveillanceCaseDraft,
): SurveillanceCaseDraft {
  return {
    pregnant: value.pregnant,
    patientUuid: value.patientUuid,
    encounterUuid: value.encounterUuid,
    providerUuid: value.providerUuid,
    locationUuid: value.locationUuid,
    diagnosisUuid: value.diagnosisUuid,
    diagnosisType: value.diagnosisType,
    origin: value.origin || undefined,
    habitualResidence: value.habitualResidence,
    vaccinationStatus: value.vaccinationStatus || undefined,
    surveillanceType: value.surveillanceType || undefined,
    onsetDate: value.onsetDate || undefined,
    notificationDate: value.notificationDate || undefined,
    deathAttribution: value.diagnosisType === "CONFIRMADO" ? (value.deathAttribution ?? null) : null,
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
  const [observations, setObservations] = useState<FhirResource[]>([]);
  const [disease, setDisease] =
    useState<Catalogue["catalog"]["diseases"][number]>();
  const [infectionDisplay, setInfectionDisplay] = useState("");
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const fieldProps = (key: string) => ({
    invalid: !!fieldErrors[key],
    invalidText: fieldErrors[key]
      ? t(`validation.${fieldErrors[key]}`)
      : undefined,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  const canEdit = mode === "edit" && !!value;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry reloads the same case.
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError(undefined);
    setValue(undefined);
    void (async () => {
      const record = await getSurveillanceCase(uuid, abort.signal);
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
        setValue({ ...record, deathAttribution: record.patientDeathDate && record.diagnosisType === "CONFIRMADO" ? (record.deathAttribution ?? "POR_DETERMINAR") : null });
        setObservations(labs);

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
  const change = (key: keyof SurveillanceCaseDraft, next: string) => {
    setFieldErrors((current) => {
      const errors = { ...current };
      delete errors[key];
      if (
        key.endsWith("Date") &&
        value &&
        Object.keys(current).some((field) => field.endsWith("Date"))
      ) {
        for (const field of Object.keys(errors))
          if (field.endsWith("Date")) delete errors[field];
        Object.assign(
          errors,
          caseDateErrors(
            { ...value, [key]: next },
            dateInZone(catalogue.catalog.timezone),
            undefined, value.encounterDate,
          ),
        );
      }
      return errors;
    });
    setValue((current) => (current ? { ...current, [key]: next } : current));
  };
  const save = async () => {
    if (!value || !canEdit || submitting.current) return;
    const dates = caseDateErrors(value, dateInZone(catalogue.catalog.timezone), undefined, value.encounterDate);
    for (const key of ["habitualResidence", "vaccinationStatus", "surveillanceType"] as const) {
      if (!value[key]) dates[key] = "required";
    }
    setFieldErrors(dates);
    setError(undefined);
    if (Object.keys(dates).length) return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await updateSurveillanceCase(uuid, caseUpdatePayload(value));
      onSaved();
    } catch (reason) {
      const failure = safeError(reason);
      const fields = serverFieldErrors(failure);
      setFieldErrors(fields);
      setError(Object.keys(fields).length ? undefined : failure);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const fieldLabel = (key: string, editable = true) => (
    <RequiredFieldLabel
      required={canEdit && editable && requiredCaseFields.has(key)}
    >
      {t(`caseDetails.fields.${key}`)}
    </RequiredFieldLabel>
  );
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
  const enumLabel = (key: string, entry?: string | null) =>
    entry ? t(`caseDetails.values.${key}.${entry}`, entry) : "—";
  const detailFields: Record<string, string> = {
    name: "patientUuid",
    encounter: "encounterUuid",
    provider: "providerUuid",
    location: "locationUuid",
    diagnosisEncounter: "diagnosisUuid",
  };
  const detail = (
    key: string,
    label: React.ReactNode,
    content?: string | number | null,
  ) => (
    <div key={key}>
      <dt>{label}</dt>
      <dd>
        {content == null || content === "" ? "\u2014" : content}
        <FieldError message={fieldProps(detailFields[key]).invalidText} />
      </dd>
    </div>
  );
  const renderOption = (key: keyof typeof options) => (
    <>
      <Select
        key={key}
        id={`edit-${key}`}
        {...fieldProps(key)}
        labelText={fieldLabel(key, key !== "diagnosisType")}
        disabled={key === "diagnosisType" || (key === "deathAttribution" && !value.patientDeathDate)}
        value={String(value[key as keyof SurveillanceCase] ?? "")}
        onChange={(event) =>
          change(key as keyof SurveillanceCaseDraft, event.target.value)
        }
      >
        {key !== "diagnosisType" && key !== "deathAttribution" && (
          <SelectItem value="" text={t("notAvailable")} />
        )}
        {key === "deathAttribution" && !value.patientDeathDate && <SelectItem value="" text={t("notAvailable")} />}
        {options[key].map((entry) => (
          <SelectItem key={entry} value={entry} text={enumLabel(key, entry)} />
        ))}
      </Select>
      {key === "diagnosisType" && (
        <FieldError message={fieldProps(key).invalidText} />
      )}
    </>
  );
  return (
    <Modal
      open
      size="lg"
      passiveModal={mode === "view"}
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
            {detail("dni", t("casesTable.dni"), value.patientIdentifier)}
            {detail(
              "name",
              t("casesTable.patient"),
              [
                value.patientPaternalSurname,
                value.patientMaternalSurname,
                value.patientGivenNames,
              ]
                .filter(Boolean)
                .join(" ") || value.patientDisplay,
            )}
            {detail(
              "sex",
              t("casesTable.sex"),
              enumLabel("sex", value.patientSex),
            )}
            {detail("age", t("casesTable.age"), value.patientAge)}
            {detail(
              "residence",
              t("caseDetails.residence"),
              value.patientResidence,
            )}
            {detail(
              "encounter",
              fieldLabel("encounterUuid", false),
              [displayDateTime(value.encounterDate), value.encounterDisplay]
                .filter(Boolean)
                .join(" · "),
            )}
            {detail(
              "provider",
              fieldLabel("providerUuid", false),
              value.providerDisplay,
            )}
            {detail(
              "location",
              fieldLabel("locationUuid", false),
              value.locationDisplay,
            )}
            {detail(
              "diagnosisEncounter",
              fieldLabel("diagnosisUuid", false),
              value.diagnosisDisplay,
            )}
          </dl>
          {canEdit ? (
            <fieldset disabled={busy} className={styles.caseEditFields}>
              <legend>{t("caseDetails.editableFields")}</legend>
              {renderOption("origin")}
              <InfectionAddressSelector
                invalidText={
                  fieldErrors.infectionAddressUuid
                    ? t(`validation.${fieldErrors.infectionAddressUuid}`)
                    : undefined
                }
                value={value.infectionAddressUuid}
                display={infectionDisplay}
                onChange={(next, display) => {
                  change("infectionAddressUuid", next);
                  setInfectionDisplay(display || "");
                }}
              />
              {dateFields
                .filter((key) => key === "onsetDate")
                .map((key) => (
                  <DateInput
                    key={key}
                    id={`edit-${key}`}
                    {...fieldProps(key)}
                    type="date"

                    max={dateInZone(catalogue.catalog.timezone)}

                    labelText={fieldLabel(key)}
                    value={value[key]?.slice(0, 10) ?? ""}
                    onChange={(event) => change(key, event.target.value)}
                  />
                ))}
              <Select
                id="edit-laboratory"
                {...fieldProps("laboratoryObservationUuid")}
                labelText={fieldLabel("laboratoryObservationUuid")}
                value={value.laboratoryObservationUuid || ""}
                onChange={(event) => {
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.laboratoryObservationUuid;
                    delete next.diagnosisType;
                    return next;
                  });
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
                          deathAttribution: classification === "CONFIRMED" && current.patientDeathDate
                            ? (current.deathAttribution ?? "POR_DETERMINAR") : null,
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
              {renderOption("diagnosisType")}
              {renderOption("habitualResidence")}
              {renderOption("vaccinationStatus")}
              {pregnancyEligible(value.patientSex, value.patientAge) && (
              <Select
                id="edit-pregnant"
                labelText={t("fields.pregnant")}
                value={
                  value.pregnant &&
                  pregnancyEligible(value.patientSex, value.patientAge)
                    ? "SI"
                    : "NO"
                }
                onChange={(event) =>
                  setValue({ ...value, pregnant: event.target.value === "SI" })
                }
              >
                <SelectItem value="SI" text={t("vaccinationValues.SI")} />
                <SelectItem value="NO" text={t("vaccinationValues.NO")} />
              </Select>
              )}
              {renderOption("surveillanceType")}
              <DateTimeInput id="edit-notificationDate" labelText={fieldLabel("notificationDate")}
                value={value.notificationDate ?? ""} {...fieldProps("notificationDate")}
                onChange={(event) => change("notificationDate", event.target.value)} />
              {value.patientDeathDate && value.diagnosisType === "CONFIRMADO" && renderOption("deathAttribution")}
            </fieldset>
          ) : (
            <dl className={styles.caseDetails}>
              {pregnancyEligible(value.patientSex, value.patientAge) && detail(
                "pregnant",
                t("fields.pregnant"),
                value.pregnant == null
                  ? undefined
                  : t(
                      value.pregnant
                        ? "vaccinationValues.SI"
                        : "vaccinationValues.NO",
                    ),
              )}
              {Object.keys(options).filter((key) => key !== "deathAttribution" || (!!value.patientDeathDate && value.diagnosisType === "CONFIRMADO")).map((key) =>
                detail(
                  key,
                  fieldLabel(key),
                  enumLabel(key, value[key as keyof typeof options]),
                ),
              )}
              {dateFields.map((key) =>
                detail(key, fieldLabel(key), key === "notificationDate" ? displayDateTime(value[key]) : displayDate(value[key])),
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
