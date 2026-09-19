import {
  Button,
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
  fhirSearch,
  getEncounterDiagnoses,
  read,
  references,
  safeError,
} from "./api";
import {
  dateInZone,
  hasConcept,
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
  const { metadata: m } = catalogue;
  const [step, setStep] = useState(0);
  const [request, setRequest] = useState<Partial<CaseRequest>>(
    () => initial ?? { uuid: globalThis.crypto.randomUUID() },
  );
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<FhirResource[]>([]);
  const [patient, setPatient] = useState<FhirResource>();
  const [encounters, setEncounters] = useState<FhirResource[]>([]);
  const [observations, setObservations] = useState<FhirResource[]>([]);
  const [locations, setLocations] = useState<NamedReference[]>([]);
  const [providers, setProviders] = useState<NamedReference[]>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [result, setResult] = useState<CaseResult>();
  const [queued, setQueued] = useState(false);
  const generation = useRef(0);
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
    void Promise.all([
      references("location", abort.signal),
      references("provider", abort.signal),
    ])
      .then(([nextLocations, nextProviders]) => {
        if (abort.signal.aborted) return;
        setLocations(nextLocations);
        const ownProviders = nextProviders.filter(
          (item) => item.person?.uuid === session?.user?.person?.uuid,
        );
        setProviders(ownProviders);
        if (ownProviders.length === 1 && !initial?.providerUuid)
          setRequest((current) => ({
            ...current,
            providerUuid: ownProviders[0].uuid,
          }));
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure);
      });
    return () => abort.abort();
  }, [session?.user?.person?.uuid, initial?.providerUuid]);

  useEffect(() => {
    if (!initial) return;
    const abort = new AbortController();
    void Promise.all([
      read<FhirResource>(
        `/ws/fhir2/R4/Patient/${encodeURIComponent(initial.patientUuid)}`,
        abort.signal,
      ),
      fhirSearch("Encounter", { patient: initial.patientUuid }, abort.signal),
      fhirSearch("Observation", { patient: initial.patientUuid }, abort.signal),
    ])
      .then(([nextPatient, nextEncounters, nextObservations]) => {
        if (abort.signal.aborted) return;
        setPatient(nextPatient);
        setEncounters(nextEncounters);
        setObservations(nextObservations);
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure);
      });
    return () => abort.abort();
  }, [initial]);

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
  async function search() {
    const current = ++generation.current;
    setBusy(true);
    setError(undefined);
    try {
      const found = await fhirSearch("Patient", { name: query });
      if (current === generation.current) setPatients(found);
    } catch (failure) {
      if (current === generation.current) setError(failure);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function choosePatient(id: string) {
    const selected = patients.find((item) => item.id === id);
    const current = ++generation.current;
    setPatient(selected);
    setEncounters([]);
    setObservations([]);
    setError(undefined);
    setRequest((value) => ({
      uuid: value.uuid,
      providerUuid: value.providerUuid,
      patientUuid: id,
    }));
    if (!id) return;
    setBusy(true);
    try {
      const [nextEncounters, nextObservations] = await Promise.all([
        fhirSearch("Encounter", { patient: id }),
        fhirSearch("Observation", { patient: id }),
      ]);
      if (current !== generation.current) return;
      setEncounters(
        nextEncounters.filter(
          (item) =>
            referenceId(item.subject?.reference) === id &&
            item.status !== "entered-in-error" &&
            item.type?.some((type) =>
              type.coding?.some((code) => code.code === m.encounterTypeUuid),
            ),
        ),
      );
      setObservations(
        nextObservations.filter(
          (item) =>
            referenceId(item.subject?.reference) === id &&
            item.status !== "entered-in-error",
        ),
      );
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
    if (!id || !request.patientUuid) return;
    setBusy(true);
    setError(undefined);
    try {
      const diagnoses = await getEncounterDiagnoses(id, request.patientUuid);
      if (current !== generation.current) return;
      const sourceObs = observations.filter(
        (obs) => referenceId(obs.encounter?.reference) === id,
      );
      setRequest((value) => ({
        ...value,
        ...prefill(sourceObs, diagnoses, catalogue),
      }));
    } catch (failure) {
      if (current === generation.current) setError(failure);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  function next() {
    const errors = validateCase(request, m, patient, source);
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
    if (!relevant.length) setStep((value) => value + 1);
  }
  async function submit() {
    if (submitting.current || !userUuid) return;
    const errors = validateCase(request, m, patient, source);
    setInvalid(errors);
    if (errors.length) {
      setStep(1);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const saved = await saveCase(request as CaseRequest, userUuid, online);
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
  const labResults = observations.filter(
    (obs) =>
      disease?.laboratoryTests.some((test) =>
        hasConcept(obs, test.resultConceptUuid),
      ) && ["final", "amended", "corrected"].includes(obs.status ?? ""),
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
            <div className={styles.actions}>
              <TextInput
                id="patient-search"
                labelText={t("searchPatient", "Patient name")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button
                kind="secondary"
                disabled={busy || query.trim().length < 2}
                onClick={search}
              >
                {t("search", "Search")}
              </Button>
            </div>
          )}
          {!initial && (
            <Select
              id="case-patient"
              labelText={t("fields.patientUuid")}
              value={request.patientUuid ?? ""}
              disabled={busy}
              invalid={invalid.includes("patientUuid")}
              invalidText={t(
                "requiredSelection",
                "Select a valid value to continue.",
              )}
              onChange={(event) => choosePatient(event.target.value)}
            >
              <SelectItem
                value=""
                text={t("selectPatient", "Select a patient")}
              />
              {patients.map((item) => (
                <SelectItem
                  key={item.id}
                  value={item.id}
                  text={`${patientName(item)} · ${item.identifier?.[0]?.value ?? ""} · ${item.birthDate ?? ""}`}
                />
              ))}
            </Select>
          )}
          {patient && (
            <Tile>
              <strong>{patientName(patient)}</strong>
              <p>
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
          {select(
            "eventUuid",
            catalogue.events.map((item) => ({
              value: item.uuid,
              text: item.name,
            })),
            (value) =>
              setRequest((current) => ({
                ...current,
                eventUuid: value,
                severity: "",
                species: "",
                status: "",
                laboratoryResultUuid: "",
              })),
          )}
          {select(
            "severity",
            disease?.severities.map((item) => ({
              value: item.key,
              text: item.label,
            })) ?? [],
          )}
          {!!disease?.species.length &&
            select(
              "species",
              disease.species.map((item) => ({
                value: item.key,
                text: item.label,
              })),
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
              const status = test?.positiveAnswerUuids.some((code) =>
                codes.includes(code),
              )
                ? "CONFIRMED"
                : test?.negativeAnswerUuids.some((code) => codes.includes(code))
                  ? "DISCARDED"
                  : "";
              setRequest((current) => ({
                ...current,
                laboratoryResultUuid: value,
                status,
              }));
            },
          )}
          {select(
            "status",
            m.statuses.map((item) => ({ value: item.key, text: item.label })),
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
            {(["onsetDate", "status", "severity", "species", "origin"] as const)
              .filter((key) => request[key])
              .map((key) => (
                <div key={key}>
                  <dt>{t(`fields.${key}`)}</dt>
                  <dd>
                    {[
                      ...m.statuses,
                      ...m.origins,
                      ...(disease?.severities ?? []),
                      ...(disease?.species ?? []),
                    ].find((item) => item.key === request[key])?.label ??
                      request[key]}
                  </dd>
                </div>
              ))}
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
