import {
  Button,
  ComboBox,
  InlineLoading,
  InlineNotification,
  ProgressIndicator,
  ProgressStep,
  Select,
  SelectItem,
  TextInput,
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
} from "./api";
import {
  dateInZone,
  findDiagnosisMapping,
  hasConcept,
  patientDni,
  patientName,
  prefill,
  referenceId,
  validateCase,
  valueConcepts,
} from "./case-form.utils";
import { moduleName } from "./constants";
import { CaseResultView } from "./case-result.component";
import { ErrorNotification } from "./error-notification.component";
import { saveCase } from "./offline";
import type {
  CaseRequest,
  CaseResult,
  Catalogue,
  EncounterDiagnosis,
  FhirResource,
  NamedReference,
} from "./types";
import styles from "./dashboard.scss";

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
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [result, setResult] = useState<CaseResult>();
  const [queued, setQueued] = useState(false);
  const generation = useRef(0);
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

  useEffect(() => {
    const abort = new AbortController();
    void Promise.allSettled([
      references("location", abort.signal),
      references("provider", abort.signal),
    ])
      .then(([locationsResult, providersResult]) => {
        if (abort.signal.aborted) return;
        if (locationsResult.status === "fulfilled") setLocations(locationsResult.value);
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
      })
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
      ),
    ])
      .then(([nextPatient, nextEncounters, nextObservations, nextDiagDetails]) => {
        if (abort.signal.aborted) return;
        setPatient(nextPatient);
        if (nextPatient) setPatients([nextPatient]);
        setEncounters(nextEncounters);
        setObservations(nextObservations);
        setEncounterDiagnoses(nextDiagDetails);
        const matched = nextDiagDetails.find((d) => {
          const mapping = findDiagnosisMapping(d.uuid, catalogue);
          return mapping?.eventUuid === initial.eventUuid;
        });
        if (matched) {
          setSelectedDiagnosisUuid(matched.uuid);
        } else if (nextDiagDetails.length > 0) {
          setSelectedDiagnosisUuid(nextDiagDetails[0].uuid);
        }
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure);
      });
    return () => abort.abort();
  }, [initial, catalogue]);

  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const update = (key: keyof CaseRequest, value: string) => {
    setRequest((current) => ({ ...current, [key]: value }));
    setInvalid((current) => current.filter((field) => field !== key));
    setError(undefined);
  };
  const handlePatientInputChange = (searchStr: string) => {
    if (patientSearchTimer.current) clearTimeout(patientSearchTimer.current);
    if (!searchStr || searchStr.trim().length < 2) return;
    patientSearchTimer.current = setTimeout(async () => {
      const current = ++generation.current;
      setBusy(true);
      setError(undefined);
      try {
        const found = await searchPatients(searchStr);
        if (current === generation.current) setPatients(found);
      } catch (failure) {
        if (current === generation.current) setError(failure);
      } finally {
        if (current === generation.current) setBusy(false);
      }
    }, 250);
  };
  async function choosePatient(id: string) {
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
    if (!id) return;
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
    const current = ++generation.current;
    const selected = encounters.find((item) => item.id === id);
    setRequest((value) => ({
      uuid: value.uuid,
      providerUuid: value.providerUuid,
      patientUuid: value.patientUuid,
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
        getEncounterDiagnosesDetails(id, request.patientUuid),
        getEncounterObservations(id, request.patientUuid),
      ]);
      if (current !== generation.current) return;
      setObservations(sourceObservations);
      setEncounterDiagnoses(diagDetails);
      const diagUuids = diagDetails.map((d) => d.uuid);
      const prefilled = prefill(sourceObservations, diagUuids, catalogue);
      setRequest((value) => ({
        ...value,
        ...prefilled,
      }));
      if (prefilled.eventUuid) {
        const matched = diagDetails.find((d) => {
          const mapping = findDiagnosisMapping(d.uuid, catalogue);
          return mapping?.eventUuid === prefilled.eventUuid;
        });
        if (matched) {
          setSelectedDiagnosisUuid(matched.uuid);
        } else if (diagDetails.length > 0) {
          setSelectedDiagnosisUuid(diagDetails[0].uuid);
        }
      } else if (diagDetails.length === 1) {
        const mapping = findDiagnosisMapping(diagDetails[0].uuid, catalogue);
        if (mapping) {
          setSelectedDiagnosisUuid(diagDetails[0].uuid);
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
    const mapping = findDiagnosisMapping(diag.uuid, catalogue);
    return {
      uuid: diag.uuid,
      display: diag.display,
      mapping,
      label: mapping?.eventName
        ? `${diag.display} (${mapping.eventName})`
        : diag.display,
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
    const errors = validateCase(currentRequest, m, patient, source);
    const relevant =
      step === 0
        ? errors.filter((field) =>
            [
              "patientUuid",
              "sourceEncounterUuid",
              "providerUuid",
              "locationUuid",
            ].includes(field),
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
      const saved = await saveCase(
        currentRequest as CaseRequest,
        userUuid,
        online,
      );
      setQueued(saved.queued);
      setResult(saved.result);
      onSaved();
    } catch (failure) {
      setError(safeError(failure));
      onSaved();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function select(
    key: keyof CaseRequest,
    items: { value: string; text: string }[],
    onChange?: (value: string) => void,
  ) {
    return (
      <Select
        id={`case-${key}`}
        labelText={t(`fields.${key}`)}
        value={request[key] ?? ""}
        disabled={busy}
        invalid={invalid.includes(key)}
        invalidText={t(
          "requiredSelection",
          "Select a valid value to continue.",
        )}
        onChange={(event) =>
          (onChange ?? ((value) => update(key, value)))(event.target.value)
        }
      >
        <SelectItem value="" text={t("selectOption", "Select an option")} />
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} text={item.text} />
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
  const labResults = observations.filter((obs) => {
    if (!["final", "amended", "corrected"].includes(obs.status ?? ""))
      return false;
    const test = disease?.laboratoryTests.find((item) =>
      hasConcept(obs, item.resultConceptUuid),
    );
    if (!test) return false;
    const codes = valueConcepts(obs);
    const isPositive = test.positiveAnswerUuids.some((code) =>
      codes.includes(code),
    );
    const isNegative = test.negativeAnswerUuids.some((code) =>
      codes.includes(code),
    );
    return isPositive || isNegative;
  });
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
      {busy && <InlineLoading description={t("loading", "Loading")} />}
      {invalid.length > 0 && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t("completeFields", "Complete the highlighted fields")}
          subtitle={invalid.map((field) => t(`fields.${field}`)).join(", ")}
        />
      )}
      {step === 0 && (
        <>
          {!initial && (
            <ComboBox
              id="case-patient"
              titleText={t("fields.patientUuid", "Paciente")}
              placeholder={t("selectPatient", "Buscar y seleccionar paciente...")}
              items={patients}
              itemToString={(item) =>
                item
                  ? `${patientName(item)}${patientDni(item) ? ` · DNI: ${patientDni(item)}` : ""}${item.birthDate ? ` · ${item.birthDate}` : ""}`
                  : ""
              }
              onInputChange={handlePatientInputChange}
              onChange={({ selectedItem }) => {
                choosePatient(selectedItem?.id ?? "");
              }}
              invalid={invalid.includes("patientUuid")}
              invalidText={t(
                "requiredSelection",
                "Select a valid value to continue.",
              )}
            />
          )}
          {patient && (
            <Tile>
              <strong>{patientName(patient)}</strong>
              <p>
                {patientDni(patient) ? `DNI: ${patientDni(patient)} · ` : ""}
                {patient.birthDate} ·{" "}
                {t(`sexValues.${patient.gender ?? "unknown"}`)}
              </p>
            </Tile>
          )}
          {select(
            "sourceEncounterUuid",
            encounters.map((item) => ({
              value: item.id,
              text: `${item.period?.start?.slice(0, 10) ?? ""} · ${item.type?.[0]?.text ?? item.type?.[0]?.coding?.[0]?.display ?? t("careRecord", "Care record")}`,
            })),
            chooseEncounter,
          )}
          {select(
            "providerUuid",
            providers.map((item) => ({ value: item.uuid, text: item.display })),
          )}
          {select(
            "locationUuid",
            locations.map((item) => ({ value: item.uuid, text: item.display })),
          )}
        </>
      )}
      {step === 1 && (
        <>
          <Select
            id="case-disease-diagnosis"
            labelText={t("fields.eventUuid", "Enfermedad")}
            value={selectedDiagnosisUuid}
            disabled={busy || !encounterDiagnoses.length}
            invalid={invalid.includes("eventUuid")}
            invalidText={t(
              "requiredSelection",
              "Select a valid value to continue.",
            )}
            onChange={(event) => onDiagnosisChange(event.target.value)}
          >
            <SelectItem value="" text={t("selectOption", "Select an option")} />
            {diagnosisOptions.map((item) => (
              <SelectItem
                key={item.uuid}
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
              title={t("noDiagnosesInEncounterTitle", "Atención sin diagnósticos")}
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
          <TextInput
            id="case-onset"
            type="date"
            labelText={t("fields.onsetDate")}
            value={request.onsetDate ?? ""}
            max={dateInZone(m.timezone)}
            invalid={invalid.includes("onsetDate")}
            invalidText={t(
              "invalidDate",
              "Use a valid date between birth and care, no later than today.",
            )}
            onChange={(event) => update("onsetDate", event.target.value)}
          />
          {select(
            "laboratoryResultUuid",
            labResults.map((obs) => ({
              value: obs.id,
              text: `${obs.code?.text ?? obs.code?.coding?.[0]?.display ?? t("laboratoryResult", "Laboratory result")} · ${obs.effectiveDateTime?.slice(0, 10) ?? ""} · ${obs.valueCodeableConcept?.text ?? obs.valueCodeableConcept?.coding?.[0]?.display ?? ""}`,
            })),
            (value) => {
              const obs = labResults.find((item) => item.id === value);
              const test = disease?.laboratoryTests.find(
                (item) => !!obs && hasConcept(obs, item.resultConceptUuid),
              );
              const codes = obs ? valueConcepts(obs) : [];
              let nextStatus = "SUSPECTED";
              if (obs && test) {
                if (
                  test.positiveAnswerUuids.some((code) => codes.includes(code))
                ) {
                  nextStatus = "CONFIRMED";
                } else if (
                  test.negativeAnswerUuids.some((code) => codes.includes(code))
                ) {
                  nextStatus = "DISCARDED";
                }
              }
              setRequest((current) => ({
                ...current,
                laboratoryResultUuid: value,
                status: nextStatus,
              }));
            },
          )}
          {select(
            "status",
            request.laboratoryResultUuid
              ? request.status === "CONFIRMED"
                ? [
                    {
                      value: "CONFIRMED",
                      text:
                        m.statuses.find((s) => s.key === "CONFIRMED")?.label ??
                        "Confirmado",
                    },
                  ]
                : [
                    {
                      value: "DISCARDED",
                      text:
                        m.statuses.find((s) => s.key === "DISCARDED")?.label ??
                        "Descartado",
                    },
                  ]
              : [
                  {
                    value: "SUSPECTED",
                    text:
                      m.statuses.find((s) => s.key === "SUSPECTED")?.label ??
                      "Sospechoso",
                  },
                ],
          )}
        </>
      )}
      {step === 2 && (
        <Tile>
          <h3>{t("reviewBeforeSave", "Review before registering")}</h3>
          <p>
            {patient ? patientName(patient) : ""} · {event?.name}
          </p>
          <dl>
            {(["onsetDate", "status", "origin"] as const)
              .filter((key) => request[key])
              .map((key) => (
                <div key={key}>
                  <dt>{t(`fields.${key}`)}</dt>
                  <dd>
                    {[...m.statuses, ...m.origins].find(
                      (item) => item.key === request[key],
                    )?.label ?? request[key]}
                  </dd>
                </div>
              ))}
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
            {request.species && (
              <div>
                <dt>{t("fields.species")}</dt>
                <dd>
                  {disease?.species.find(
                    (item) => item.key === request.species,
                  )?.label ?? request.species}
                </dd>
              </div>
            )}
          </dl>
          <p>
            {t(
              "classificationNotice",
              "The server validates ICD-10, laboratory evidence, duplicates and alerts before confirming the registration.",
            )}
          </p>
          <p>
            {t(
              "notificationNotice",
              "Regulatory export to NOTI is not included in this iteration.",
            )}
          </p>
        </Tile>
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
