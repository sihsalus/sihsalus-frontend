import { diagnosisLabel } from "./diagnosis-display";
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
  ComboBox,
  InlineLoading,
  InlineNotification,
  ProgressIndicator,
  ProgressStep,
  Select,
  SelectItem,
  Tile,
} from "@carbon/react";
import { useConnectivity, useSession } from "@openmrs/esm-framework";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getEncounterDiagnosesDetails,
  getEncounterObservations,
  getPatient,
  encountersForPatient,
  references,
  safeError,
  searchPatients,
  createSurveillanceCase,
} from "./api";
import {
  dateInZone,
  findDiagnosisMapping,
  patientDni,
  patientName,
  patientAge,
  pregnancyEligible,
  encounterDate,
  prefill,
  referenceId,
  validateCase,
  toSurveillanceCaseDraft,
} from "./case-form.utils";
import { moduleName } from "./constants";
import { CaseResultView } from "./case-result.component";
import { ErrorNotification } from "./error-notification.component";
import { InfectionAddressSelector } from "./infection-address-selector.component";
import type {
  CaseRequest,
  CaseResult,
  Catalogue,
  EncounterDiagnosis,
  FhirResource,
  NamedReference,
} from "./types";
import styles from "./dashboard.scss";
import {
  classifyLaboratoryObservation,
  laboratoryLabel,
} from "./laboratory.utils";

export function CaseForm({
  catalogue,
  initial,
  onSaved,
}: {
  catalogue: Catalogue;
  initial?: CaseRequest;
  onSaved: () => void;
}) {
  const { t } = useTranslation(moduleName);
  const session = useSession();
  const online = useConnectivity();
  const { catalog: m } = catalogue;
  const [step, setStep] = useState(0);
  const [infectionAddressDisplay, setInfectionAddressDisplay] = useState("");
  const [request, setRequest] = useState<Partial<CaseRequest>>(
    () => initial ?? { uuid: globalThis.crypto.randomUUID() },
  );
  const [patients, setPatients] = useState<FhirResource[]>([]);
  const [patient, setPatient] = useState<FhirResource>();
  const [encounters, setEncounters] = useState<FhirResource[]>([]);
  const [observations, setObservations] = useState<FhirResource[]>([]);
  const [encounterDiagnoses, setEncounterDiagnoses] = useState<
    EncounterDiagnosis[]
  >([]);
  const [selectedDiagnosisUuid, setSelectedDiagnosisUuid] =
    useState<string>("");
  const [locations, setLocations] = useState<NamedReference[]>([]);
  const [providers, setProviders] = useState<NamedReference[]>([]);
  const [remoteErrors, setRemoteErrors] = useState<FieldErrors>({});
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [result, setResult] = useState<CaseResult>();
  const [queued, setQueued] = useState(false);
  const generation = useRef(0);
  const patientSearchGeneration = useRef(0);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const patientSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const source = encounters.find(
    (item) => item.id === request.sourceEncounterUuid,
  );
  const disease = m.diseases.find(
    (item) => item.eventUuid === request.eventUuid,
  );
  const event = catalogue.events.find(
    (item) => item.uuid === request.eventUuid,
  );
  const userUuid = session?.user?.uuid;
  const investigationDate = encounterDate(source, m.timezone);
  const caseAge = investigationDate
    ? patientAge(patient?.birthDate, investigationDate)
    : undefined;
  const canSelectPregnancy = pregnancyEligible(patient?.gender, caseAge);
  useEffect(() => {
    if (!patient || !source) return;
    setRequest((current) => ({
      ...current,
      investigationDate,
      pregnant: canSelectPregnancy ? (current.pregnant ?? false) : false,
    }));
  }, [investigationDate, canSelectPregnancy, patient, source]);
  useEffect(() => {
    if (!patient) return;
    setRequest((current) => ({ ...current,
      deathAttribution: patient?.deathDate && request.status === "CONFIRMED" ? (current.deathAttribution ?? "POR_DETERMINAR") : null,
    }));
  }, [patient, request.status]);
  const ageLabel = (item: FhirResource) => {
    const age = patientAge(
      item.birthDate,
      investigationDate ?? dateInZone(m.timezone),
    );
    return age === undefined
      ? t("patientAgeUnknown")
      : `${age} ${t(age === 1 ? "patientAgeYear" : "patientAgeYears")}`;
  };

  useEffect(() => {
    const abort = new AbortController();
    void Promise.allSettled([
      references("location", abort.signal),
      references("provider", abort.signal),
    ]).then(([locationsResult, providersResult]) => {
      if (abort.signal.aborted) return;
      if (locationsResult.status === "fulfilled")
        setLocations(locationsResult.value);
      if (providersResult.status === "fulfilled") {
        const ownProviders = providersResult.value.filter(
          (item) => item.person?.uuid === session?.user?.person?.uuid,
        );
        setProviders(ownProviders);
        if (ownProviders.length === 1 && !initial?.providerUuid)
          setRequest((current) => ({
            ...current,
            providerUuid: ownProviders[0].uuid,
          }));
      }
      if (
        locationsResult.status === "rejected" &&
        providersResult.status === "rejected"
      )
        setError(locationsResult.reason);
    });
    return () => abort.abort();
  }, [session?.user?.person?.uuid, initial?.providerUuid]);

  useEffect(() => {
    if (!initial) return;
    const abort = new AbortController();
    void Promise.all([
      getPatient(initial.patientUuid, abort.signal),
      encountersForPatient(initial.patientUuid, abort.signal),
      getEncounterObservations(
        initial.sourceEncounterUuid,
        initial.patientUuid,
        abort.signal,
      ),
      getEncounterDiagnosesDetails(
        initial.sourceEncounterUuid,
        initial.patientUuid,
        abort.signal,
        m.icd10SourceUuid,
      ),
    ])
      .then(
        ([nextPatient, nextEncounters, nextObservations, nextDiagDetails]) => {
          if (abort.signal.aborted) return;
          setPatient(nextPatient);
          if (nextPatient) setPatients([nextPatient]);
          setEncounters(nextEncounters);
          setObservations(nextObservations);
          const notifyingDiagnoses = nextDiagDetails.filter((d) =>
            findDiagnosisMapping(d.conceptUuid, catalogue),
          );
          setEncounterDiagnoses(notifyingDiagnoses);
          const matched = notifyingDiagnoses.find((d) => {
            const mapping = findDiagnosisMapping(d.conceptUuid, catalogue);
            return mapping?.eventUuid === initial.eventUuid;
          });
          if (matched) {
            setSelectedDiagnosisUuid(matched.uuid);
          } else if (notifyingDiagnoses.length > 0) {
            setSelectedDiagnosisUuid(notifyingDiagnoses[0].uuid);
          }
        },
      )
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure);
      });
    return () => abort.abort();
  }, [initial, catalogue, m.icd10SourceUuid]);

  useEffect(
    () => () => {
      generation.current++;
      patientSearchGeneration.current++;
      if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
    },
    [],
  );
  const update = (key: keyof CaseRequest, value: string) => {
    setRequest((current) => ({ ...current, [key]: value }));
    setRemoteErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key.endsWith("Date"))
        for (const field of Object.keys(next))
          if (field.endsWith("Date")) delete next[field];
      return next;
    });
    setInvalid((current) => current.filter((field) => field !== key));
    setError(undefined);
  };
  const handlePatientInputChange = (searchStr: string) => {
    if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
    const current = ++patientSearchGeneration.current;
    setSearchingPatients(false);
    if (!searchStr || searchStr.trim().length < 2) return;
    patientSearchTimer.current = setTimeout(async () => {
      setSearchingPatients(true);
      try {
        const found = await searchPatients(searchStr);
        if (current === patientSearchGeneration.current) setPatients(found);
      } catch (failure) {
        if (current === patientSearchGeneration.current) setError(failure);
      } finally {
        if (current === patientSearchGeneration.current) setSearchingPatients(false);
      }
    }, 250);
  };
  async function choosePatient(id: string) {
    if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
    patientSearchGeneration.current++;
    setSearchingPatients(false);
    setInfectionAddressDisplay("");
    const selected = patients.find((item) => item.id === id);
    const current = ++generation.current;
    setPatient(selected);
    setEncounters([]);
    setObservations([]);
    setEncounterDiagnoses([]);
    setSelectedDiagnosisUuid("");
    setError(undefined);
    setRequest((value) => ({
      uuid: value.uuid,
      providerUuid: value.providerUuid,
      patientUuid: id,
    }));
    if (!id) {
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const nextEncounters = await encountersForPatient(id);
      if (current !== generation.current) return;
      setEncounters(nextEncounters);
    } catch (failure) {
      if (current === generation.current) setError(failure);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function chooseEncounter(id: string) {
    setInfectionAddressDisplay("");
    const current = ++generation.current;
    const selected = encounters.find((item) => item.id === id);
    setRequest((value) => ({
      uuid: value.uuid,
      providerUuid: value.providerUuid,
      patientUuid: value.patientUuid,
      deathAttribution: patient?.deathDate ? "POR_DETERMINAR" : null,
      sourceEncounterUuid: id,
      locationUuid: referenceId(selected?.location?.[0]?.location.reference),
    }));
    setEncounterDiagnoses([]);
    setSelectedDiagnosisUuid("");
    if (!id || !request.patientUuid) return;
    setBusy(true);
    setError(undefined);
    try {
      const [diagDetails, sourceObservations] = await Promise.all([
        getEncounterDiagnosesDetails(id, request.patientUuid, undefined, m.icd10SourceUuid),
        getEncounterObservations(id, request.patientUuid),
      ]);
      if (current !== generation.current) return;
      setObservations(sourceObservations);
      const notifyingDiagnoses = diagDetails.filter((d) =>
        findDiagnosisMapping(d.conceptUuid, catalogue),
      );
      setEncounterDiagnoses(notifyingDiagnoses);
      const conceptUuids = notifyingDiagnoses.map((d) => d.conceptUuid);
      const prefilled = prefill(sourceObservations, conceptUuids, catalogue);
      setRequest((value) => ({
        ...value,
        ...prefilled,
      }));
      if (prefilled.eventUuid) {
        const matched = notifyingDiagnoses.find((d) => {
          const mapping = findDiagnosisMapping(d.conceptUuid, catalogue);
          return mapping?.eventUuid === prefilled.eventUuid;
        });
        if (matched) {
          setSelectedDiagnosisUuid(matched.uuid);
        } else if (notifyingDiagnoses.length > 0) {
          setSelectedDiagnosisUuid(notifyingDiagnoses[0].uuid);
        }
      } else if (notifyingDiagnoses.length === 1) {
        const mapping = findDiagnosisMapping(
          notifyingDiagnoses[0].conceptUuid,
          catalogue,
        );
        if (mapping) {
          setSelectedDiagnosisUuid(notifyingDiagnoses[0].uuid);
          setRequest((value) => ({
            ...value,
            eventUuid: mapping.eventUuid,
            severity: mapping.severity,
            species: mapping.species,
          }));
        }
      }
    } catch (failure) {
      if (current === generation.current) setError(failure);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  const diagnosisOptions = encounterDiagnoses.map((diag) => {
    const mapping = findDiagnosisMapping(diag.conceptUuid, catalogue);
    return {
      uuid: diag.uuid,
      display: diag.display,
      mapping,
      label: diagnosisLabel(diag.display, diag.icd10 ?? mapping?.icd10Code),
    };
  });
  const onDiagnosisChange = (diagUuid: string) => {
    setSelectedDiagnosisUuid(diagUuid);
    const item = diagnosisOptions.find((d) => d.uuid === diagUuid);
    if (item?.mapping) {
      setRequest((current) => ({
        ...current,
        eventUuid: item.mapping?.eventUuid ?? "",
        severity: item.mapping?.severity ?? "",
        species: item.mapping?.species ?? "",
        status: !current.laboratoryResultUuid ? "SUSPECTED" : current.status,
      }));
    } else {
      setRequest((current) => ({
        ...current,
        eventUuid: "",
        severity: "",
        species: "",
      }));
    }
    setInvalid((current) =>
      current.filter(
        (field) => !["eventUuid", "severity", "species"].includes(field),
      ),
    );
  };
  function next() {
    const currentRequest = {
      ...request,
      status:
        request.status || (!request.laboratoryResultUuid ? "SUSPECTED" : ""),
    };
    setRemoteErrors({});
    const errors = validateCase(currentRequest, m, patient, source);
    const relevant =
      step === 0
        ? errors.filter((field) =>
            ["patientUuid", "sourceEncounterUuid"].includes(field),
          )
        : errors;
    setInvalid(relevant);
    if (!relevant.length) {
      setRequest(currentRequest);
      setStep((value) => value + 1);
    }
  }
  async function submit() {
    if (submitting.current || !userUuid) return;
    const currentRequest = {
      ...request,
      status:
        request.status || (!request.laboratoryResultUuid ? "SUSPECTED" : ""),
    };
    setRemoteErrors({});
    const errors = validateCase(currentRequest, m, patient, source);
    setInvalid(errors);
    if (errors.length) {
      setStep(1);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const saved = await createSurveillanceCase(
        toSurveillanceCaseDraft(
          currentRequest as CaseRequest,
          selectedDiagnosisUuid,
        ),
      );
      setQueued(false);
      setResult({
        uuid: saved.uuid,
        diagnosisConceptUuid: saved.diagnosisUuid,
        icd10: saved.diagnosisIcd10 ?? "",
        periodicity: "",
        deadlineDays: 0,
        replayed: false,
        immediateAlerts: [],
        outbreakAlerts: [],
        warnings: [],
      });
      onSaved();
    } catch (failure) {
      const safe = safeError(failure);
      const fields = serverFieldErrors(safe, true);
      setRemoteErrors(fields);
      if (Object.keys(fields).length) {
        setInvalid(Object.keys(fields));
        setStep(fields.patientUuid || fields.sourceEncounterUuid ? 0 : 1);
        setError(undefined);
      } else setError(safe);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const dateErrors = caseDateErrors(
    request,
    dateInZone(m.timezone),
    patient?.birthDate,
    source?.period?.start,
  );
  const fieldProps = (key: string) => {
    const reason =
      remoteErrors[key] ??
      (key.endsWith("Date")
        ? (dateErrors[key] ??
          (!request[key as keyof CaseRequest] ? "required" : undefined))
        : !request[key as keyof CaseRequest]
          ? key === "laboratoryResultUuid"
            ? "laboratoryRequired"
            : "required"
          : "selection");
    return {
      invalid: invalid.includes(key) && !!reason,
      invalidText:
        invalid.includes(key) && reason ? t(`validation.${reason}`) : undefined,
    };
  };
  function select(
    key: keyof CaseRequest,
    items: { value: string; text: string }[],
    onChange?: (value: string) => void,
  ) {
    return (
      <Select
        id={`case-${key}`}
        labelText={
          <RequiredFieldLabel required={requiredCaseFields.has(key)}>
            {t(`fields.${key}`)}
          </RequiredFieldLabel>
        }
        value={String(request[key] ?? "")}
        disabled={busy}
        {...fieldProps(key)}
        onChange={(event) => {
          const affected =
            key === "laboratoryResultUuid" ? [key, "status"] : [key];
          setInvalid((current) =>
            current.filter((field) => !affected.includes(field)),
          );
          setRemoteErrors((current) => {
            const next = { ...current };
            for (const field of affected) delete next[field];
            return next;
          });
          (onChange ?? ((value) => update(key, value)))(event.target.value);
        }}
      >
        <SelectItem value="" text={t("selectOption", "Select an option")} />
        {items.map((item, index) => (
          <SelectItem
            key={item.value || `opt-${index}`}
            value={item.value}
            text={item.text}
          />
        ))}
      </Select>
    );
  }
  if (result) return <CaseResultView result={result} />;
  if (queued)
    return (
      <InlineNotification
        kind="warning"
        lowContrast
        hideCloseButton
        title={t("queuedTitle", "Pending synchronization")}
        subtitle={t(
          "queuedDescription",
          "Saved on this device. Server validation and alert assessment will run after reconnection.",
        )}
      />
    );
  const classifyLabObservation = (obs: FhirResource) =>
    classifyLaboratoryObservation(obs, m, disease);
  const labResults = observations.filter(
    (obs) => classifyLabObservation(obs) !== null,
  );
  return (
    <section
      aria-label={t("registerCase", "Register case")}
      className={styles.form}
    >
      <ProgressIndicator currentIndex={step} spaceEqually>
        <ProgressStep label={t("identify", "Patient and care")} />
        <ProgressStep label={t("classify", "Classify case")} />
        <ProgressStep label={t("review", "Review and register")} />
      </ProgressIndicator>
      {!online && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={t("offline", "Offline")}
          subtitle={t(
            "offlineCapture",
            "Use previously downloaded patients and records. Cases remain pending until the server validates them.",
          )}
        />
      )}
      {error ? <ErrorNotification error={error} /> : null}
      {(busy || searchingPatients) && <InlineLoading description={t("loading", "Loading")} />}
      {step === 0 && (
        <>
          {!initial && (
            <ComboBox
              id="case-patient"
              titleText={
                <RequiredFieldLabel>
                  {t("fields.patientUuid", "Paciente")}
                </RequiredFieldLabel>
              }
              placeholder={t(
                "selectPatient",
                "Buscar y seleccionar paciente...",
              )}
              items={patients}
              itemToString={(item) =>
                item
                  ? `${patientName(item)} · ${ageLabel(item)}${patientDni(item) ? ` · DNI: ${patientDni(item)}` : ""}`
                  : ""
              }
              onInputChange={handlePatientInputChange}
              onChange={({ selectedItem }) => {
                choosePatient(selectedItem?.id ?? "");
              }}
              {...fieldProps("patientUuid")}
            />
          )}
          {patient && (
            <Tile>
              <strong>{patientName(patient)}</strong>
              <p>
                {patientDni(patient) ? `DNI: ${patientDni(patient)} · ` : ""}
                {t(`sexValues.${patient.gender ?? "unknown"}`)}
                {` · ${ageLabel(patient)}`}
              </p>
            </Tile>
          )}
          {select(
            "sourceEncounterUuid",
            encounters.map((item) => ({
              value: item.id,
              text: `${displayDate(item.period?.start)} · ${item.type?.[0]?.text ?? item.type?.[0]?.coding?.[0]?.display ?? t("careRecord", "Care record")}`,
            })),
            chooseEncounter,
          )}
        </>
      )}
      {step === 1 && (
        <>
          <Select
            id="case-providerUuid"
            labelText={
              <RequiredFieldLabel>
                {t("fields.providerUuid")}
              </RequiredFieldLabel>
            }
            value={request.providerUuid ?? ""}
            disabled
            {...fieldProps("providerUuid")}
            onChange={() => {}}
          >
            <SelectItem value="" text={t("selectOption", "Select an option")} />
            {providers.map((item) => (
              <SelectItem
                key={item.uuid}
                value={item.uuid}
                text={item.display}
              />
            ))}
          </Select>
          <FieldError message={fieldProps("providerUuid").invalidText} />
          <Select
            id="case-locationUuid"
            labelText={
              <RequiredFieldLabel>
                {t("fields.locationUuid")}
              </RequiredFieldLabel>
            }
            value={request.locationUuid ?? ""}
            disabled
            {...fieldProps("locationUuid")}
            onChange={() => {}}
          >
            <SelectItem value="" text={t("selectOption", "Select an option")} />
            {locations.map((item) => (
              <SelectItem
                key={item.uuid}
                value={item.uuid}
                text={item.display}
              />
            ))}
          </Select>
          <FieldError message={fieldProps("locationUuid").invalidText} />
          <Select
            id="case-disease-diagnosis"
            labelText={
              <RequiredFieldLabel>
                {t("fields.diagnosisUuid", "Diagnóstico de la atención")}
              </RequiredFieldLabel>
            }
            value={selectedDiagnosisUuid}
            disabled={busy || !encounterDiagnoses.length}
            {...fieldProps("eventUuid")}
            onChange={(event) => onDiagnosisChange(event.target.value)}
          >
            <SelectItem value="" text={t("selectOption", "Select an option")} />
            {diagnosisOptions.map((item, index) => (
              <SelectItem
                key={item.uuid || `diag-${index}`}
                value={item.uuid}
                text={item.label}
              />
            ))}
          </Select>
          {!encounterDiagnoses.length && (
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title={t(
                "noDiagnosesInEncounterTitle",
                "Atención sin diagnósticos",
              )}
              subtitle={t(
                "noDiagnosesInEncounter",
                "La atención seleccionada no tiene diagnósticos asociados para vigilancia epidemiológica.",
              )}
            />
          )}
          {select(
            "origin",
            m.origins.map((item) => ({ value: item.key, text: item.label })),
          )}
          <InfectionAddressSelector
            invalidText={
              invalid.includes("infectionAddressUuid")
                ? t(
                    `validation.${remoteErrors.infectionAddressUuid ?? "selection"}`,
                  )
                : undefined
            }
            value={request.infectionAddressUuid}
            display={infectionAddressDisplay}
            onChange={(value, display) => {
              update("infectionAddressUuid", value);
              setInfectionAddressDisplay(display ?? "");
            }}
          />
          <DateInput
            id="case-onset"
            type="date"
            labelText={t("fields.onsetDate")}
            value={request.onsetDate ?? ""}
            max={dateInZone(m.timezone)}
            {...fieldProps("onsetDate")}
            onChange={(event) => update("onsetDate", event.target.value)}
          />
          {select(
            "laboratoryResultUuid",
            labResults.map((obs) => ({
              value: obs.id,
              text:
                laboratoryLabel(obs) ||
                t("laboratoryResult", "Laboratory result"),
            })),
            (value) => {
              const obs = labResults.find((item) => item.id === value);
              const classification = obs ? classifyLabObservation(obs) : null;
              const nextStatus = classification ?? "SUSPECTED";
              setRequest((current) => ({
                ...current,
                laboratoryResultUuid: value,
                status: nextStatus,
              }));
            },
          )}
          <Select
            id="case-status"
            labelText={
              <RequiredFieldLabel>{t("fields.status")}</RequiredFieldLabel>
            }
            value={request.status ?? ""}
            disabled
            {...fieldProps("status")}
            onChange={() => {}}
          >
            <SelectItem value="" text={t("selectOption", "Select an option")} />
            {m.statuses.map((s) => (
              <SelectItem
                key={s.key}
                value={s.key}
                text={t(`statuses.${s.key}`, s.label)}
              />
            ))}
          </Select>
          <FieldError message={fieldProps("status").invalidText} />
          {select("habitualResidence", ["1", "2", "3"].map((value) => ({
            value, text: t(`caseDetails.values.habitualResidence.${value}`),
          })))}
          {select(
            "vaccinationStatus",
            ["SI", "NO", "IGN"].map((value) => ({
              value,
              text: t(`vaccinationValues.${value}`),
            })),
          )}
          {canSelectPregnancy && (
            <Select
              id="case-pregnant"
              labelText={t("fields.pregnant")}
              value={request.pregnant ? "SI" : "NO"}
              disabled={busy}
              onChange={(e) =>
                setRequest((current) => ({
                  ...current,
                  pregnant: e.target.value === "SI",
                }))
              }
            >
              <SelectItem value="SI" text={t("vaccinationValues.SI")} />
              <SelectItem value="NO" text={t("vaccinationValues.NO")} />
            </Select>
          )}
          <Select
            id="case-investigationForm"
            labelText={<RequiredFieldLabel>{t("fields.investigationForm")}</RequiredFieldLabel>}
            value={request.investigationForm == null ? "" : request.investigationForm ? "SI" : "NO"}
            disabled={busy}
            {...fieldProps("investigationForm")}
            onChange={(event) => {
              setInvalid((current) => current.filter((field) => field !== "investigationForm"));
              setRemoteErrors((current) => { const next = { ...current }; delete next.investigationForm; return next; });
              setRequest((current) => ({ ...current, investigationForm: event.target.value === "" ? undefined : event.target.value === "SI" }));
            }}
          >
            <SelectItem value="" text={t("selectOption", "Select an option")} />
            <SelectItem value="SI" text={t("vaccinationValues.SI")} />
            <SelectItem value="NO" text={t("vaccinationValues.NO")} />
          </Select>
          {select(
            "surveillanceType",
            ["PASIVA", "BUSQUEDA_ACTIVA"].map((value) => ({
              value,
              text: t(`surveillanceValues.${value}`),
            })),
          )}
          <DateTimeInput id="case-notificationDate" labelText={t("fields.notificationDate")}
            value={request.notificationDate ?? ""} disabled={busy}
            {...fieldProps("notificationDate")}
            onChange={(event) => update("notificationDate", event.target.value)} />
          {patient?.deathDate && request.status === "CONFIRMED" && (
            <Select id="case-deathAttribution" labelText={t("fields.deathAttribution")}
              value={request.deathAttribution ?? ""} disabled={busy}
              {...fieldProps("deathAttribution")}
              onChange={(e) => update("deathAttribution", e.target.value)}>
              {["SI", "NO", "POR_DETERMINAR"].map((entry) =>
                <SelectItem key={entry} value={entry} text={t(`caseDetails.values.deathAttribution.${entry}`)} />)}
            </Select>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <Tile>
            <h3>{t("reviewBeforeSave", "Review before registering")}</h3>
            <p>
              {patient ? patientName(patient) : ""} ·{" "}
              {diagnosisOptions.find((item) => item.uuid === selectedDiagnosisUuid)?.label ?? event?.conceptDisplay}
            </p>
            <dl>
              <div>
                <dt>{t("fields.investigationForm")}</dt>
                <dd>{t(request.investigationForm ? "vaccinationValues.SI" : "vaccinationValues.NO")}</dd>
              </div>
              {canSelectPregnancy && <div>
                <dt>{t("fields.pregnant")}</dt>
                <dd>
                  {t(
                    request.pregnant
                      ? "vaccinationValues.SI"
                      : "vaccinationValues.NO",
                  )}
                </dd>
              </div>}
              <div>
                <dt>{t("casesTable.age")}</dt>
                <dd>{caseAge ?? t("patientAgeUnknown")}</dd>
              </div>
              {(
                [
                  "onsetDate",
                  "status",
                  "origin",
                  "habitualResidence",
                  "vaccinationStatus",
                  "surveillanceType",
                  "notificationDate",
                  "deathAttribution",
                ] as const
              )
                .filter((key) => request[key])
                .map((key) => (
                  <div key={key}>
                    <dt>{t(`fields.${key}`)}</dt>
                    <dd>
                      {key === "notificationDate" ? displayDateTime(request[key]) : key.endsWith("Date")
                        ? displayDate(request[key])
                        : key === "habitualResidence"
                          ? t(`caseDetails.values.habitualResidence.${request[key]}`)
                        : key === "deathAttribution"
                          ? t(`caseDetails.values.deathAttribution.${request[key]}`)
                        : key === "status"
                          ? t(`statuses.${request[key]}`)
                          : key === "vaccinationStatus"
                            ? t(`vaccinationValues.${request[key]}`)
                            : key === "surveillanceType"
                              ? t(`surveillanceValues.${request[key]}`)
                              : ([...m.statuses, ...m.origins].find(
                                  (item) => item.key === request[key],
                                )?.label ?? request[key])}
                    </dd>
                  </div>
                ))}
              {request.infectionAddressUuid && (
                <div>
                  <dt>{t("fields.infectionAddressUuid")}</dt>
                  <dd>
                    {infectionAddressDisplay || t("infectionPreservedCenter")}
                  </dd>
                </div>
              )}
              {request.severity && (
                <div>
                  <dt>{t("fields.severity")}</dt>
                  <dd>
                    {disease?.severities.find(
                      (item) => item.key === request.severity,
                    )?.label ?? request.severity}
                  </dd>
                </div>
              )}
            </dl>
          </Tile>
        </>
      )}
      <div className={styles.actions}>
        {step > 0 && (
          <Button
            kind="secondary"
            disabled={busy}
            onClick={() => setStep((value) => value - 1)}
          >
            {t("back", "Back")}
          </Button>
        )}
        {step < 2 ? (
          <Button disabled={busy || !!error} onClick={next}>
            {t("continue", "Continue")}
          </Button>
        ) : (
          <Button disabled={busy || !userUuid} onClick={submit}>
            {t("registerCase", "Register case")}
          </Button>
        )}
      </div>
    </section>
  );
}
