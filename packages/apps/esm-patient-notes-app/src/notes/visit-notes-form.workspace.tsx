import {
  Button,
  ButtonSet,
  Column,
  DismissibleTag,
  Form,
  FormGroup,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Row,
  Search,
  SkeletonText,
  Stack,
  TextArea,
  Tile,
  Tooltip,
} from "@carbon/react";
import {
  Add,
  CloseFilled,
  Information,
  WarningFilled,
} from "@carbon/react/icons";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAttachment,
  createErrorHandler,
  type Encounter,
  ExtensionSlot,
  OpenmrsDatePicker,
  ResponsiveWrapper,
  restBaseUrl,
  showModal,
  showSnackbar,
  type UploadedFile,
  useConfig,
  useLayoutType,
  userHasAccess,
  useSession,
  Workspace2,
} from "@openmrs/esm-framework";
import {
  invalidateVisitAndEncounterData,
  type PatientWorkspace2DefinitionProps,
  useAllowedFileExtensions,
} from "@openmrs/esm-patient-common-lib";
import classnames from "classnames";
import dayjs from "dayjs";
import type { TFunction } from "i18next";
import { debounce } from "lodash-es";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Control, Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSWRConfig } from "swr";
import { z } from "zod";
import type { ConfigObject } from "../config-schema";
import { visitNotesEditPrivilege } from "../constants";
import type {
  Concept,
  Diagnosis,
  ObsPayload,
  VisitNotePayload,
} from "../types";
import {
  formatPrestacionalDisplay,
  getCie10DisplayParts,
  getCie10MappedCode,
  getPrestacionalDisplayParts,
} from "./catalog-concept.utils";
import { defaultVisitNoteClinicalConceptUuids } from "./visit-note-config-schema";
import {
  type ExistingEncounterDiagnosis,
  type ExistingEncounterProvider,
  findActiveObservation,
  getReferenceUuid,
  reconcileDiagnosisTypeObservations,
  reconcileEncounterDiagnoses,
  reconcileEncounterProviders,
  reconcileObservation,
} from "./visit-note-submission";
import {
  AmbiguousVisitNoteSaveError,
  assertCanonicalVisitNoteCanBeCreated,
  fetchDiagnosisConceptsByName,
  fetchPrestacionalConceptsByName,
  getCanonicalVisitNoteEncounterUuid,
  legacyNextAppointmentConceptUuid,
  legacyStructuredVisitNoteConceptUuids,
  parseTipoDxObs,
  saveCanonicalVisitNote,
  updateVisitNote,
  useCanonicalVisitNoteEncounter,
  useProviderSignatureDetails,
  type VisitNoteClinicalContext,
  useVisitNoteClinicalContext,
  useVisitNotes,
} from "./visit-notes.resource";
import styles from "./visit-notes-form.scss";

type VisitNotesFormData = Omit<
  z.infer<ReturnType<typeof createSchema>>,
  "images"
> & {
  images?: UploadedFile[];
};

interface VisitContextWithUuid {
  uuid?: string;
  visitType?: { uuid?: string };
  location?: {
    uuid?: string;
  };
  visit?: {
    uuid?: string;
    visitType?: { uuid?: string };
    location?: {
      uuid?: string;
    };
  };
}

type EncounterObsValue =
  | string
  | number
  | boolean
  | { uuid?: string; display?: string };

interface EncounterFormObs {
  concept?: {
    uuid?: string;
  };
  formFieldNamespace?: string;
  formFieldPath?: string;
  uuid?: string;
  value?: EncounterObsValue;
  voided?: boolean;
}

interface DiagnosesDisplayProps {
  fieldName: string;
  isDiagnosisNotSelected: (diagnosis: Concept) => boolean;
  isLoading: boolean;
  isSearching: boolean;
  onAddDiagnosis: (diagnosis: Concept, searchInputField: string) => void;
  searchResults: Array<Concept>;
  t: TFunction;
  value: string;
}

interface DiagnosisSearchProps {
  control: Control<VisitNotesFormData>;
  error?: object;
  handleSearch: (
    fieldName: "primaryDiagnosisSearch" | "secondaryDiagnosisSearch",
  ) => void;
  labelText: string;
  name: "primaryDiagnosisSearch" | "secondaryDiagnosisSearch";
  placeholder: string;
  setIsSearching: (isSearching: boolean) => void;
}

interface PrestacionalSearchProps {
  error?: Error;
  requiredError?: string;
  isLoading: boolean;
  onAddPrestacional: (concept: Concept) => void;
  onSearch: (value: string) => void;
  searchResults: Array<Concept>;
  selectedConcept: Concept | null;
  t: TFunction;
  value: string;
}

interface SelectedDiagnosisProps {
  diagnosis: Diagnosis;
  kind: "primary" | "secondary";
  onRemove: () => void;
  t: TFunction;
}

interface CatalogHelpLinkProps {
  ariaLabel: string;
  href?: string;
  tooltipLabel: string;
}

function isMostlyUpperCase(value: string) {
  const letters: Array<string> = value.match(/\p{L}/gu) ?? [];
  if (!letters.length) {
    return false;
  }

  const upperCaseLetters = letters.filter(
    (letter) => letter === letter.toLocaleUpperCase("es-PE"),
  );
  return upperCaseLetters.length / letters.length > 0.8;
}

function toReadableDiagnosisName(value: string) {
  const normalizedValue = value.trim().replace(/\s+/g, " ");

  if (!isMostlyUpperCase(normalizedValue)) {
    return normalizedValue.replace(/\b[ivxlcdm]+\b/gi, (romanNumber) =>
      romanNumber.toLocaleUpperCase("es-PE"),
    );
  }

  return normalizedValue
    .toLocaleLowerCase("es-PE")
    .split(" ")
    .map((word, index) => {
      const normalizedWord = word.replace(/[^\p{L}]/gu, "");

      if (/^[ivxlcdm]+$/i.test(normalizedWord)) {
        return word.toLocaleUpperCase("es-PE");
      }

      return index === 0
        ? word.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("es-PE"))
        : word;
    })
    .join(" ");
}

function formatDiagnosisDisplay(conceptOrDiagnosis: Concept | Diagnosis) {
  const { code, name } = getCie10DisplayParts(conceptOrDiagnosis);
  const readableName = toReadableDiagnosisName(name);

  return code ? `${code} - ${readableName}` : readableName;
}

const createSchema = (_t: TFunction) => {
  return z.object({
    noteDate: z.date(),
    primaryDiagnosisSearch: z.string(),
    secondaryDiagnosisSearch: z.string().optional(),
    codigoPrestacional: z.string().optional(),
    nextAppointment: z.date().nullable().optional(),
    clinicalNote: z.string().optional(),
    images: z.array(z.any()).optional(),
  });
};

export function parseOpenmrsDateValue(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const parsed = dayjs(value instanceof Date ? value : String(value));
  return parsed.isValid() ? parsed.startOf("day").toDate() : null;
}

export function toOpenmrsDateValue(value?: Date | null): string | undefined {
  return value && dayjs(value).isValid()
    ? dayjs(value).format("YYYY-MM-DD")
    : undefined;
}

export function getSubmittedEncounterDatetime(
  noteDate: Date,
  wasExplicitlyChanged: boolean,
  now: Date = new Date(),
): string | undefined {
  if (!wasExplicitlyChanged) {
    return undefined;
  }

  // The visit date field is date-only, so it resolves to local midnight. Submitting
  // that verbatim backdates the encounter to 00:00 — wrong clinically, and rejected
  // outright when the visit started later the same day. Keep the chosen calendar day
  // and take the time of day from the clock.
  return dayjs(noteDate)
    .hour(now.getHours())
    .minute(now.getMinutes())
    .second(now.getSeconds())
    .millisecond(now.getMilliseconds())
    .format();
}

export type EditableVisitNoteEncounter = Encounter & {
  id: string;
  rawDatetime: string;
};

export interface VisitNotesFormProps {
  canonicalVerificationStatus?: "error" | "validating" | "verified";
  encounter?: EditableVisitNoteEncounter;
  formContext?: "creating" | "editing";
  onAfterSave?: () => unknown;
}

const VisitNotesFormContent: React.FC<
  PatientWorkspace2DefinitionProps<VisitNotesFormProps, {}>
> = ({
  closeWorkspace,
  workspaceProps: {
    canonicalVerificationStatus = "verified",
    formContext,
    encounter,
    onAfterSave,
  },
  groupProps: { patientUuid, patient, visitContext },
}) => {
  const isEditing: boolean = Boolean(
    formContext === "editing" && encounter?.id,
  );
  const searchTimeoutInMs = 500;
  const { t } = useTranslation();
  const isTablet = useLayoutType() === "tablet";
  const session = useSession();
  const { isPrimaryDiagnosisRequired, ...config } = useConfig<ConfigObject>();
  const visitNoteConfig = {
    ...defaultVisitNoteClinicalConceptUuids,
    ...config.visitNoteConfig,
  };
  const memoizedState = useMemo(
    () => ({ patientUuid, patient }),
    [patientUuid, patient],
  );
  const {
    clinicianEncounterRole,
    encounterNoteTextConceptUuid,
    codigoPrestacionalConceptUuid,
    nextAppointmentConceptUuid,
    encounterTypeUuid,
    formConceptUuid,
    diagnosisTypeConceptUuid,
    diagnosisTypePresuntivoUuid,
    diagnosisTypeDefinitivoUuid,
    diagnosisTypeRepetitivoUuid,
    outpatientVisitTypeUuid,
    professionalRegistrationProviderAttributeTypeUuid,
  } = visitNoteConfig;
  const currentVisitContext = visitContext as
    | VisitContextWithUuid
    | null
    | undefined;
  const visitUuid =
    currentVisitContext?.visit?.uuid ?? currentVisitContext?.uuid;
  const activeVisitTypeUuid =
    currentVisitContext?.visit?.visitType?.uuid ??
    currentVisitContext?.visitType?.uuid;
  const isOutpatientVisit =
    activeVisitTypeUuid?.toLowerCase() ===
    outpatientVisitTypeUuid.toLowerCase();
  const encounterVisitUuid = getReferenceUuid(
    (
      encounter as
        | (EditableVisitNoteEncounter & { visit?: string | { uuid?: string } })
        | undefined
    )?.visit,
  );
  const locationUuid =
    getReferenceUuid(encounter?.location) ??
    currentVisitContext?.visit?.location?.uuid ??
    currentVisitContext?.location?.uuid;
  const {
    clinicalContext,
    error: clinicalContextError,
    isLoading: isClinicalContextLoading,
    isValidating: isClinicalContextValidating,
  } = useVisitNoteClinicalContext(patientUuid, visitUuid);
  const [isLoadingPrimaryDiagnoses, setIsLoadingPrimaryDiagnoses] =
    useState(false);
  const [isLoadingSecondaryDiagnoses, setIsLoadingSecondaryDiagnoses] =
    useState(false);
  const [isLoadingPrestacionales, setIsLoadingPrestacionales] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPrimaryDiagnoses, setSelectedPrimaryDiagnoses] = useState<
    Array<Diagnosis>
  >([]);
  const [selectedSecondaryDiagnoses, setSelectedSecondaryDiagnoses] = useState<
    Array<Diagnosis>
  >([]);
  const [searchPrimaryResults, setSearchPrimaryResults] =
    useState<Array<Concept>>(null);
  const [searchSecondaryResults, setSearchSecondaryResults] =
    useState<Array<Concept>>(null);
  const [searchPrestacionalResults, setSearchPrestacionalResults] = useState<
    Array<Concept>
  >([]);
  const [selectedCodigoPrestacional, setSelectedCodigoPrestacional] =
    useState<Concept | null>(null);
  const [codigoPrestacionalSearchValue, setCodigoPrestacionalSearchValue] =
    useState("");
  const [combinedDiagnoses, setCombinedDiagnoses] = useState<Array<Diagnosis>>(
    [],
  );
  const [rows, setRows] = useState<number>();
  const [error, setError] = useState<Error>(null);
  const { allowedFileExtensions } = useAllowedFileExtensions();

  // MINSA/NTS-139 records each diagnosis as Presuntivo, Definitivo or
  // Repetitivo. OpenMRS patientdiagnoses only stores certainty, so SIH.SALUS
  // keeps the exact MINSA type as an obs keyed by the diagnosis concept UUID.
  const [diagnosisTipos, setDiagnosisTipos] = useState<Record<string, string>>(
    {},
  );
  const [hasDiagnosisChanges, setHasDiagnosisChanges] = useState(false);
  const submitInProgressRef = useRef(false);
  const isCanonicalVerificationBlocked =
    canonicalVerificationStatus !== "verified";

  const visitNoteFormSchema = useMemo(() => createSchema(t), [t]);
  const encounterObs = useMemo(
    () => (encounter?.obs ?? []) as Array<EncounterFormObs>,
    [encounter?.obs],
  );
  const getEncounterObs = useCallback(
    (conceptUuid: string, formFieldPath?: string) =>
      findActiveObservation(encounterObs, conceptUuid, formFieldPath) as
        | EncounterFormObs
        | undefined,
    [encounterObs],
  );
  const getEncounterObsValue = useCallback(
    (conceptUuid: string, formFieldPath?: string) => {
      const obs = getEncounterObs(conceptUuid, formFieldPath);
      if (obs?.value == null) {
        return "";
      }
      if (typeof obs.value === "object") {
        return String(obs.value.display ?? obs.value.uuid ?? "");
      }
      return String(obs.value);
    },
    [getEncounterObs],
  );
  const getEncounterObsConceptValue = useCallback(
    (conceptUuid: string, formFieldPath?: string): Concept | null => {
      const obs = getEncounterObs(conceptUuid, formFieldPath);
      if (!obs?.value || typeof obs.value !== "object") {
        return null;
      }

      const value = obs.value as { display?: string; uuid?: string };
      return value.uuid
        ? { uuid: value.uuid, display: value.display ?? value.uuid }
        : null;
    },
    [getEncounterObs],
  );
  const getEncounterCodigoPrestacionalValue = useCallback(
    () =>
      getEncounterObsConceptValue(
        codigoPrestacionalConceptUuid,
        "codigo-prestacional",
      )?.display ||
      getEncounterObsValue(
        codigoPrestacionalConceptUuid,
        "codigo-prestacional",
      ) ||
      getEncounterObsValue(
        legacyStructuredVisitNoteConceptUuids.sharedTextWithFormFieldPath,
        "codigo-prestacional",
      ),
    [
      codigoPrestacionalConceptUuid,
      getEncounterObsConceptValue,
      getEncounterObsValue,
    ],
  );
  const getEncounterNextAppointmentValue = useCallback(
    () =>
      parseOpenmrsDateValue(getEncounterObsValue(nextAppointmentConceptUuid)) ??
      parseOpenmrsDateValue(
        getEncounterObsValue(legacyNextAppointmentConceptUuid),
      ),
    [getEncounterObsValue, nextAppointmentConceptUuid],
  );

  const customResolver = useCallback(
    async (data, context, options) => {
      const zodResult = await zodResolver(visitNoteFormSchema)(
        data,
        context,
        options,
      );

      const requiredErrors: Record<string, { type: string; message: string }> =
        {};
      if (isPrimaryDiagnosisRequired && selectedPrimaryDiagnoses.length === 0) {
        requiredErrors.primaryDiagnosisSearch = {
          type: "custom",
          message: t(
            "primaryDiagnosisRequired",
            "Choose at least one primary diagnosis",
          ),
        };
      }
      if (isOutpatientVisit && selectedPrimaryDiagnoses.length !== 1) {
        requiredErrors.primaryDiagnosisSearch = {
          type: "custom",
          message: t(
            "outpatientPrimaryDiagnosisExactlyOne",
            "Consulta Externa requires exactly one primary diagnosis; record any others as secondary",
          ),
        };
      }
      if (
        isOutpatientVisit &&
        selectedPrimaryDiagnoses.some(
          (diagnosis) => !getCie10MappedCode(diagnosis),
        )
      ) {
        requiredErrors.primaryDiagnosisSearch = {
          type: "custom",
          message: t(
            "diagnosisCie10MappingRequired",
            "Every diagnosis must have a CIE-10 catalog mapping",
          ),
        };
      }
      if (
        isOutpatientVisit &&
        selectedSecondaryDiagnoses.some(
          (diagnosis) => !getCie10MappedCode(diagnosis),
        )
      ) {
        requiredErrors.secondaryDiagnosisSearch = {
          type: "custom",
          message: t(
            "diagnosisCie10MappingRequired",
            "Every diagnosis must have a CIE-10 catalog mapping",
          ),
        };
      }
      // The benefit code feeds FUA/HIS reporting, so free text without a catalog
      // selection is not a valid value.
      if (!selectedCodigoPrestacional) {
        requiredErrors.codigoPrestacional = {
          type: "custom",
          message: t(
            "codigoPrestacionalRequired",
            "Seleccione un código prestacional del catálogo",
          ),
        };
      }

      if (Object.keys(requiredErrors).length > 0) {
        return {
          ...zodResult,
          errors: {
            ...zodResult.errors,
            ...requiredErrors,
          },
        };
      }

      return zodResult;
    },
    [
      visitNoteFormSchema,
      isPrimaryDiagnosisRequired,
      isOutpatientVisit,
      selectedPrimaryDiagnoses,
      selectedSecondaryDiagnoses,
      selectedCodigoPrestacional,
      t,
    ],
  );

  const {
    clearErrors,
    control,
    formState: { errors, dirtyFields, isSubmitting },
    handleSubmit,
    setValue,
    watch,
  } = useForm<VisitNotesFormData>({
    mode: "onSubmit",
    resolver: customResolver,
    defaultValues: {
      primaryDiagnosisSearch: "",
      noteDate: isEditing ? new Date(encounter.rawDatetime) : new Date(),
      codigoPrestacional: isEditing
        ? getEncounterCodigoPrestacionalValue()
        : "",
      nextAppointment: isEditing ? getEncounterNextAppointmentValue() : null,
      clinicalNote: isEditing
        ? getEncounterObsValue(encounterNoteTextConceptUuid)
        : "",
    },
  });

  useEffect(() => {
    const existingCodigoPrestacional = getEncounterObsConceptValue(
      codigoPrestacionalConceptUuid,
      "codigo-prestacional",
    );
    if (isEditing && existingCodigoPrestacional) {
      setSelectedCodigoPrestacional(existingCodigoPrestacional);
    }
  }, [codigoPrestacionalConceptUuid, getEncounterObsConceptValue, isEditing]);

  useEffect(() => {
    const codigoPrestacional = clinicalContext?.codigoPrestacional?.trim();
    if (
      !isEditing &&
      codigoPrestacional &&
      !dirtyFields.codigoPrestacional &&
      !watch("codigoPrestacional")
    ) {
      setValue("codigoPrestacional", codigoPrestacional, { shouldDirty: true });
    }
    // Legacy notes carry the code as text only; seeding the search box lets the
    // operator confirm the catalog concept the mandatory validation now demands.
    if (codigoPrestacional && !selectedCodigoPrestacional) {
      setCodigoPrestacionalSearchValue(
        (current) => current || codigoPrestacional,
      );
    }
  }, [
    clinicalContext?.codigoPrestacional,
    dirtyFields.codigoPrestacional,
    isEditing,
    selectedCodigoPrestacional,
    setValue,
    watch,
  ]);

  useEffect(() => {
    const nextAppointment = parseOpenmrsDateValue(
      clinicalContext?.nextAppointment,
    );
    if (
      !isEditing &&
      nextAppointment &&
      !dirtyFields.nextAppointment &&
      !watch("nextAppointment")
    ) {
      setValue("nextAppointment", nextAppointment, { shouldDirty: true });
    }
  }, [
    clinicalContext?.nextAppointment,
    dirtyFields.nextAppointment,
    isEditing,
    setValue,
    watch,
  ]);

  useEffect(() => {
    if (encounter?.diagnoses?.length) {
      try {
        const transformedDiagnoses = encounter.diagnoses
          .filter((diagnosis) => !diagnosis.voided)
          .map((d) => {
            const codedConcept = d.diagnosis.coded as Concept | undefined;
            return {
              patient: patientUuid,
              diagnosis: { coded: codedConcept?.uuid },
              certainty: d.certainty,
              rank: d.rank,
              display: codedConcept?.display
                ? formatDiagnosisDisplay(codedConcept)
                : d.display,
              conceptMappings: codedConcept?.conceptMappings,
              mappings: codedConcept?.mappings,
            };
          });

        const primaryDiagnoses = transformedDiagnoses.filter(
          (d) => d.rank === 1,
        );
        const secondaryDiagnoses = transformedDiagnoses.filter(
          (d) => d.rank === 2,
        );

        setSelectedPrimaryDiagnoses(primaryDiagnoses);
        setSelectedSecondaryDiagnoses(secondaryDiagnoses);
        setCombinedDiagnoses([...primaryDiagnoses, ...secondaryDiagnoses]);

        // Restore the exact MINSA diagnosis type (P/D/R) saved alongside the
        // encounter, keyed back to its coded diagnosis via the formFieldPath.
        const restored = parseTipoDxObs(
          (encounter.obs ?? []) as Array<EncounterFormObs>,
        );
        if (Object.keys(restored).length) {
          setDiagnosisTipos(restored);
        }
      } catch (caughtError) {
        const transformedError = new Error(
          t("errorTransformingDiagnoses", "Error transforming diagnoses"),
          {
            cause: caughtError,
          },
        );
        setError(transformedError);
        createErrorHandler()(transformedError);
      }
    }
  }, [encounter, patientUuid, t]);

  const currentImages = watch("images");

  const { mutateVisitNotes } = useVisitNotes(patientUuid);
  const { mutate: globalMutate } = useSWRConfig();

  const mutateAttachments = useCallback(
    () =>
      globalMutate(
        (key) =>
          typeof key === "string" &&
          key.startsWith(`${restBaseUrl}/attachment`),
      ),
    [globalMutate],
  );

  const providerUuid = session?.currentProvider?.uuid;
  const encounterProvider = encounter?.encounterProviders?.[0]?.provider;
  const encounterProvidersPayload = useMemo(
    () =>
      reconcileEncounterProviders(
        isEditing,
        (encounter?.encounterProviders ??
          []) as Array<ExistingEncounterProvider>,
        providerUuid,
        clinicianEncounterRole,
      ),
    [
      clinicianEncounterRole,
      encounter?.encounterProviders,
      isEditing,
      providerUuid,
    ],
  );
  const registeredProviderUuid = isEditing
    ? (getReferenceUuid(encounterProvider) ?? providerUuid)
    : providerUuid;
  const { providerSignatureDetails } = useProviderSignatureDetails(
    registeredProviderUuid,
    professionalRegistrationProviderAttributeTypeUuid,
  );
  const registeredProviderName =
    providerSignatureDetails.name ??
    encounterProvider?.person?.display ??
    encounterProvider?.display ??
    session?.currentProvider?.identifier;
  const registeredProviderCode =
    providerSignatureDetails.professionalRegistration;

  const debouncedSearch = useMemo(
    () =>
      debounce((fieldQuery, fieldName) => {
        clearErrors(fieldName);
        if (fieldQuery) {
          if (fieldName === "primaryDiagnosisSearch") {
            setIsLoadingPrimaryDiagnoses(true);
          } else if (fieldName === "secondaryDiagnosisSearch") {
            setIsLoadingSecondaryDiagnoses(true);
          }

          fetchDiagnosisConceptsByName(fieldQuery, config.diagnosisConceptClass)
            .then((matchingConceptDiagnoses: Array<Concept>) => {
              if (fieldName === "primaryDiagnosisSearch") {
                setSearchPrimaryResults(matchingConceptDiagnoses);
                setIsLoadingPrimaryDiagnoses(false);
              } else if (fieldName === "secondaryDiagnosisSearch") {
                setSearchSecondaryResults(matchingConceptDiagnoses);
                setIsLoadingSecondaryDiagnoses(false);
              }
            })
            .catch((e) => {
              setError(e);
              createErrorHandler()(e);
            });
        }
      }, searchTimeoutInMs),
    [config.diagnosisConceptClass, clearErrors],
  );

  const debouncedPrestacionalSearch = useMemo(
    () =>
      debounce((query: string) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
          setSearchPrestacionalResults([]);
          setIsLoadingPrestacionales(false);
          return;
        }

        setIsLoadingPrestacionales(true);
        fetchPrestacionalConceptsByName(
          trimmedQuery,
          config.prestacionalConceptSourceName,
        )
          .then((matchingPrestacionales) => {
            setSearchPrestacionalResults(matchingPrestacionales);
            setIsLoadingPrestacionales(false);
          })
          .catch((e) => {
            setError(e);
            setIsLoadingPrestacionales(false);
            createErrorHandler()(e);
          });
      }, searchTimeoutInMs),
    [config.prestacionalConceptSourceName],
  );

  const handleSearch = useCallback(
    (fieldName: "primaryDiagnosisSearch" | "secondaryDiagnosisSearch") => {
      const fieldQuery = watch(fieldName);
      if (fieldQuery) {
        debouncedSearch(fieldQuery, fieldName);
      }
      setIsSearching(false);
    },
    [debouncedSearch, watch],
  );

  const handlePrestacionalSearch = useCallback(
    (value: string) => {
      setCodigoPrestacionalSearchValue(value);
      setSelectedCodigoPrestacional(null);
      setValue("codigoPrestacional", "");
      debouncedPrestacionalSearch(value);
    },
    [debouncedPrestacionalSearch, setValue],
  );

  const handleAddPrestacional = useCallback(
    (concept: Concept) => {
      setSelectedCodigoPrestacional(concept);
      setCodigoPrestacionalSearchValue("");
      setSearchPrestacionalResults([]);
      setValue("codigoPrestacional", formatPrestacionalDisplay(concept), {
        shouldDirty: true,
      });
      clearErrors("codigoPrestacional");
    },
    [clearErrors, setValue],
  );

  const handleRemovePrestacional = useCallback(() => {
    setSelectedCodigoPrestacional(null);
    setValue("codigoPrestacional", "", { shouldDirty: true });
  }, [setValue]);

  const createDiagnosis = useCallback(
    (concept: Concept) => ({
      certainty: "PROVISIONAL",
      display: formatDiagnosisDisplay(concept),
      diagnosis: {
        coded: concept.uuid,
      },
      patient: patientUuid,
      rank: 2,
      conceptMappings: concept.conceptMappings,
      mappings: concept.mappings,
    }),
    [patientUuid],
  );

  const handleAddDiagnosis = useCallback(
    (conceptDiagnosisToAdd: Concept, searchInputField: string) => {
      const newDiagnosis = createDiagnosis(conceptDiagnosisToAdd);
      if (searchInputField === "primaryDiagnosisSearch") {
        newDiagnosis.rank = 1;
        setValue("primaryDiagnosisSearch", "");
        setSearchPrimaryResults([]);
        setSelectedPrimaryDiagnoses((selectedDiagnoses) => [
          ...selectedDiagnoses,
          newDiagnosis,
        ]);
        clearErrors("primaryDiagnosisSearch");
      } else if (searchInputField === "secondaryDiagnosisSearch") {
        setValue("secondaryDiagnosisSearch", "");
        setSearchSecondaryResults([]);
        setSelectedSecondaryDiagnoses((selectedDiagnoses) => [
          ...selectedDiagnoses,
          newDiagnosis,
        ]);
      }
      setCombinedDiagnoses((combinedDiagnoses) => [
        ...combinedDiagnoses,
        newDiagnosis,
      ]);
      // Default tipo = Presuntivo for every newly added diagnosis
      setDiagnosisTipos((prev) => ({
        ...prev,
        [conceptDiagnosisToAdd.uuid]: diagnosisTypePresuntivoUuid,
      }));
      setHasDiagnosisChanges(true);
    },
    [createDiagnosis, setValue, clearErrors, diagnosisTypePresuntivoUuid],
  );

  const handleRemoveDiagnosis = useCallback(
    (diagnosisToRemove: Diagnosis, searchInputField: string) => {
      if (searchInputField === "primaryInputSearch") {
        setSelectedPrimaryDiagnoses(
          selectedPrimaryDiagnoses.filter(
            (diagnosis) =>
              diagnosis.diagnosis.coded !== diagnosisToRemove.diagnosis.coded,
          ),
        );
      } else if (searchInputField === "secondaryInputSearch") {
        setSelectedSecondaryDiagnoses(
          selectedSecondaryDiagnoses.filter(
            (diagnosis) =>
              diagnosis.diagnosis.coded !== diagnosisToRemove.diagnosis.coded,
          ),
        );
      }
      setCombinedDiagnoses(
        combinedDiagnoses.filter(
          (diagnosis) =>
            diagnosis.diagnosis.coded !== diagnosisToRemove.diagnosis.coded,
        ),
      );
      setDiagnosisTipos((prev) => {
        const next = { ...prev };
        delete next[diagnosisToRemove.diagnosis.coded];
        return next;
      });
      setHasDiagnosisChanges(true);
    },
    [combinedDiagnoses, selectedPrimaryDiagnoses, selectedSecondaryDiagnoses],
  );

  const handleDiagnosisTypeChange = useCallback(
    (diagnosisUuid: string, value: string) => {
      setDiagnosisTipos((prev) => ({ ...prev, [diagnosisUuid]: value }));
      setHasDiagnosisChanges(true);
    },
    [],
  );

  const isDiagnosisNotSelected = (diagnosis: Concept) => {
    const isPrimaryDiagnosisSelected = selectedPrimaryDiagnoses.some(
      (selectedDiagnosis) =>
        diagnosis.uuid === selectedDiagnosis.diagnosis.coded,
    );
    const isSecondaryDiagnosisSelected = selectedSecondaryDiagnoses.some(
      (selectedDiagnosis) =>
        diagnosis.uuid === selectedDiagnosis.diagnosis.coded,
    );

    return !isPrimaryDiagnosisSelected && !isSecondaryDiagnosisSelected;
  };

  const showImageCaptureModal = useCallback(() => {
    const close = showModal("capture-photo-modal", {
      saveFile: (file: UploadedFile) => {
        if (file.capturedFromWebcam && !file.fileName.includes(".")) {
          file.fileName = `${file.fileName}.png`;
        }

        setValue("images", currentImages ? [...currentImages, file] : [file]);
        close();
        return;
      },
      closeModal: () => {
        close();
      },
      allowedExtensions:
        allowedFileExtensions && Array.isArray(allowedFileExtensions)
          ? allowedFileExtensions.filter((ext) => !/pdf/i.test(ext))
          : [],
      collectDescription: true,
      multipleFiles: true,
    });
  }, [allowedFileExtensions, currentImages, setValue]);

  const handleRemoveImage = (index: number) => {
    const updatedImages = [...currentImages];
    updatedImages.splice(index, 1);
    setValue("images", updatedImages);

    showSnackbar({
      title: t("imageRemoved", "Image removed"),
      kind: "success",
      isLowContrast: true,
    });
  };

  const onSubmit = useCallback(
    async (data: VisitNotesFormData) => {
      if (submitInProgressRef.current) return;
      submitInProgressRef.current = true;

      const { noteDate, nextAppointment, clinicalNote, images } = data;

      try {
        if (isCanonicalVerificationBlocked) {
          showSnackbar({
            title: t("visitNoteSaveError", "Error saving visit note"),
            subtitle:
              canonicalVerificationStatus === "validating"
                ? t(
                    "visitNoteRevalidationInProgress",
                    "Wait while the active visit summary is verified.",
                  )
                : t(
                    "visitNoteRevalidationErrorDescription",
                    "The latest visit summary could not be verified. Reload before saving.",
                  ),
            kind: "error",
            isLowContrast: false,
          });
          return;
        }
        if (isPrimaryDiagnosisRequired && !selectedPrimaryDiagnoses.length)
          return;
        if (isOutpatientVisit && selectedPrimaryDiagnoses.length !== 1) {
          showSnackbar({
            title: t("visitNoteSaveError", "Error saving visit note"),
            subtitle: t(
              "outpatientPrimaryDiagnosisExactlyOne",
              "Consulta Externa requires exactly one primary diagnosis; record any others as secondary",
            ),
            kind: "error",
            isLowContrast: false,
          });
          return;
        }
        if (
          isOutpatientVisit &&
          combinedDiagnoses.some((diagnosis) => !getCie10MappedCode(diagnosis))
        ) {
          showSnackbar({
            title: t("visitNoteSaveError", "Error saving visit note"),
            subtitle: t(
              "diagnosisCie10MappingRequired",
              "Every diagnosis must have a CIE-10 catalog mapping",
            ),
            kind: "error",
            isLowContrast: false,
          });
          return;
        }
        if (!visitUuid) {
          showSnackbar({
            title: t("visitNoteSaveError", "Error saving visit note"),
            subtitle: t(
              "activeVisitRequired",
              "An active visit is required to save this visit note.",
            ),
            kind: "error",
            isLowContrast: false,
          });
          return;
        }
        if (isEditing && encounterVisitUuid !== visitUuid) {
          showSnackbar({
            title: t("visitNoteSaveError", "Error saving visit note"),
            subtitle: t(
              "visitNoteVisitMismatch",
              "This visit note belongs to a different visit and cannot be edited from the active visit.",
            ),
            kind: "error",
            isLowContrast: false,
          });
          return;
        }
        if (!locationUuid) {
          showSnackbar({
            title: t("visitNoteSaveError", "Error saving visit note"),
            subtitle: t(
              "activeVisitLocationRequired",
              "An active visit with an operational UPSS is required.",
            ),
            kind: "error",
            isLowContrast: false,
          });
          return;
        }
        if (!encounterProvidersPayload.length) {
          showSnackbar({
            title: t("visitNoteSaveError", "Error saving visit note"),
            subtitle: t(
              "activeProviderRequired",
              "An active clinical provider is required to save this visit note.",
            ),
            kind: "error",
            isLowContrast: false,
          });
          return;
        }

        const encounterDatetime = getSubmittedEncounterDatetime(
          noteDate,
          Boolean(dirtyFields.noteDate),
        );
        const visitNoteObsList: Array<ObsPayload> = [
          ...reconcileObservation(
            encounterObs,
            codigoPrestacionalConceptUuid,
            selectedCodigoPrestacional?.uuid,
            "codigo-prestacional",
            [
              {
                conceptUuid:
                  legacyStructuredVisitNoteConceptUuids.sharedTextWithFormFieldPath,
                formFieldPath: "codigo-prestacional",
              },
            ],
          ),
          ...reconcileObservation(
            encounterObs,
            nextAppointmentConceptUuid,
            toOpenmrsDateValue(nextAppointment),
            undefined,
            [{ conceptUuid: legacyNextAppointmentConceptUuid }],
          ),
        ];
        const tipoObsList = reconcileDiagnosisTypeObservations(
          combinedDiagnoses,
          encounterObs,
          diagnosisTipos,
          diagnosisTypeConceptUuid,
          diagnosisTypePresuntivoUuid,
        );
        const obsPayload: Array<ObsPayload> = [
          ...reconcileObservation(
            encounterObs,
            encounterNoteTextConceptUuid,
            clinicalNote,
          ),
          ...visitNoteObsList,
          ...tipoObsList,
        ];
        const diagnosesPayload = reconcileEncounterDiagnoses(
          combinedDiagnoses,
          (encounter?.diagnoses ?? []) as Array<ExistingEncounterDiagnosis>,
          diagnosisTipos,
          diagnosisTypePresuntivoUuid,
          diagnosisTypeDefinitivoUuid,
          patientUuid,
        );
        const visitNotePayload: VisitNotePayload = {
          ...(encounterDatetime ? { encounterDatetime } : {}),
          ...(!isEditing && {
            uuid: getCanonicalVisitNoteEncounterUuid(
              patientUuid,
              visitUuid,
              encounterTypeUuid,
              formConceptUuid,
            ),
            visit: visitUuid,
          }),
          form: formConceptUuid,
          patient: patientUuid,
          location: locationUuid,
          encounterProviders: encounterProvidersPayload,
          encounterType: encounterTypeUuid,
          obs: obsPayload,
          diagnoses: diagnosesPayload,
        };
        const abortController = new AbortController();

        if (!isEditing) {
          await assertCanonicalVisitNoteCanBeCreated(
            patientUuid,
            visitUuid,
            encounterTypeUuid,
            formConceptUuid,
          );
        }
        const response = isEditing
          ? await updateVisitNote(
              abortController,
              encounter.id,
              visitNotePayload,
            )
          : await saveCanonicalVisitNote(abortController, visitNotePayload);
        if (response.status !== 200 && response.status !== 201) {
          throw new Error("The visit note save was rejected.");
        }

        try {
          await onAfterSave?.();
        } catch (callbackError) {
          createErrorHandler()(callbackError);
        }

        let hasAttachmentFailures = false;
        if (images?.length) {
          const attachmentResults = await Promise.allSettled(
            images.map((image) => {
              const imageToUpload: UploadedFile = {
                base64Content: image.base64Content,
                file: image.file,
                fileName: image.fileName,
                fileType: image.fileType,
                fileDescription: image.fileDescription || "",
              };
              return createAttachment(patientUuid, imageToUpload);
            }),
          );
          hasAttachmentFailures = attachmentResults.some(
            (result) => result.status === "rejected",
          );
          attachmentResults.forEach((result) => {
            if (result.status === "rejected")
              createErrorHandler()(result.reason);
          });
        }

        invalidateVisitAndEncounterData(globalMutate, patientUuid);
        mutateVisitNotes();
        if (images?.length) mutateAttachments();
        closeWorkspace({ discardUnsavedChanges: true });
        showSnackbar(
          hasAttachmentFailures
            ? {
                isLowContrast: false,
                subtitle: t(
                  "visitNoteAttachmentSaveWarning",
                  "The visit note was saved, but one or more attachments could not be uploaded.",
                ),
                kind: "warning",
                title: t("visitNoteSaved", "Visit note saved"),
              }
            : {
                isLowContrast: true,
                subtitle: t(
                  "visitNoteNowVisible",
                  "It is now visible on the Visits page",
                ),
                kind: "success",
                title: t("visitNoteSaved", "Visit note saved"),
              },
        );
      } catch (caughtError) {
        createErrorHandler()(caughtError);
        showSnackbar({
          title: t("visitNoteSaveError", "Error saving visit note"),
          kind: "error",
          isLowContrast: false,
          subtitle:
            caughtError instanceof AmbiguousVisitNoteSaveError
              ? t(
                  "visitNoteSaveAmbiguous",
                  "The visit note may already have been saved. Reload before trying again.",
                )
              : t(
                  "visitNoteSaveRejected",
                  "The visit note could not be saved.",
                ),
        });
      } finally {
        submitInProgressRef.current = false;
      }
    },
    [
      closeWorkspace,
      combinedDiagnoses,
      codigoPrestacionalConceptUuid,
      canonicalVerificationStatus,
      diagnosisTipos,
      diagnosisTypeConceptUuid,
      diagnosisTypeDefinitivoUuid,
      diagnosisTypePresuntivoUuid,
      dirtyFields.noteDate,
      encounterProvidersPayload,
      encounterVisitUuid,
      encounterObs,
      encounter?.diagnoses,
      encounter?.id,
      encounterNoteTextConceptUuid,
      encounterTypeUuid,
      formConceptUuid,
      globalMutate,
      isCanonicalVerificationBlocked,
      isEditing,
      isPrimaryDiagnosisRequired,
      isOutpatientVisit,
      locationUuid,
      mutateAttachments,
      mutateVisitNotes,
      nextAppointmentConceptUuid,
      onAfterSave,
      patientUuid,
      selectedCodigoPrestacional?.uuid,
      selectedPrimaryDiagnoses.length,
      t,
      visitUuid,
    ],
  );

  const onError = () => undefined;

  const hasUserUnsavedChanges =
    Object.keys(dirtyFields).length > 0 || hasDiagnosisChanges;

  return (
    <Workspace2
      title={t("visitNoteWorkspaceTitle", "Visit note")}
      hasUnsavedChanges={hasUserUnsavedChanges}
    >
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit, onError)}>
        <ExtensionSlot
          name="visit-context-header-slot"
          state={{ patientUuid }}
        />

        {isTablet && (
          <Row className={styles.headerGridRow}>
            <ExtensionSlot
              name="visit-form-header-slot"
              className={styles.dataGridRow}
              state={memoizedState}
            />
          </Row>
        )}

        <div className={styles.formContainer}>
          <Stack gap={2}>
            {isTablet ? (
              <h2 className={styles.heading}>
                {t("addVisitNote", "Add a visit note")}
              </h2>
            ) : null}
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>{t("date", "Date")}</span>
              </Column>
              <Column sm={3}>
                <Controller
                  name="noteDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <ResponsiveWrapper>
                      <OpenmrsDatePicker
                        {...field}
                        data-testid="visitDateTimePicker"
                        id="visitDateTimePicker"
                        invalid={Boolean(fieldState?.error?.message)}
                        invalidText={fieldState?.error?.message}
                        isDisabled={isEditing}
                        labelText={t("visitDate", "Visit date")}
                        maxDate={new Date()}
                      />
                    </ResponsiveWrapper>
                  )}
                />
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>
                  {t("responsibleProvider", "Responsible provider")}
                </span>
              </Column>
              <Column sm={3}>
                <Tile>
                  <p>
                    <strong>
                      {registeredProviderName ??
                        t("providerNotConfigured", "Provider not configured")}
                    </strong>
                  </p>
                  <p>
                    {t("professionalRegistration", "Professional registration")}
                    :{" "}
                    {registeredProviderCode ??
                      t(
                        "professionalRegistrationMissing",
                        "Not registered in provider profile",
                      )}
                  </p>
                  <p>
                    {t(
                      "providerSignatureSource",
                      "Signature, seal and registration are resolved from the provider profile that records this encounter.",
                    )}
                  </p>
                </Tile>
              </Column>
            </Row>
            <div className={styles.diagnosesText}>
              {selectedPrimaryDiagnoses?.length > 0 &&
                selectedPrimaryDiagnoses.map((diagnosis, index) => (
                  <div key={index} className={styles.diagnosisRow}>
                    <SelectedDiagnosis
                      diagnosis={diagnosis}
                      kind="primary"
                      onRemove={() =>
                        handleRemoveDiagnosis(diagnosis, "primaryInputSearch")
                      }
                      t={t}
                    />
                    <div className={styles.tipoSelector}>
                      <RadioButtonGroup
                        legendText=""
                        name={`tipo-primary-${index}`}
                        valueSelected={
                          diagnosisTipos[diagnosis.diagnosis.coded] ??
                          diagnosisTypePresuntivoUuid
                        }
                        onChange={(value) =>
                          value != null &&
                          handleDiagnosisTypeChange(
                            diagnosis.diagnosis.coded,
                            String(value),
                          )
                        }
                        orientation="horizontal"
                      >
                        <RadioButton
                          id={`tipo-primary-${index}-p`}
                          labelText={t("presuntivo", "P - Presuntivo")}
                          value={diagnosisTypePresuntivoUuid}
                        />
                        <RadioButton
                          id={`tipo-primary-${index}-d`}
                          labelText={t("definitivo", "D - Definitivo")}
                          value={diagnosisTypeDefinitivoUuid}
                        />
                        <RadioButton
                          id={`tipo-primary-${index}-r`}
                          labelText={t("repetitivo", "R - Repetido")}
                          value={diagnosisTypeRepetitivoUuid}
                        />
                      </RadioButtonGroup>
                    </div>
                  </div>
                ))}
              {selectedSecondaryDiagnoses?.length > 0 &&
                selectedSecondaryDiagnoses.map((diagnosis, index) => (
                  <div key={index} className={styles.diagnosisRow}>
                    <SelectedDiagnosis
                      diagnosis={diagnosis}
                      kind="secondary"
                      onRemove={() =>
                        handleRemoveDiagnosis(diagnosis, "secondaryInputSearch")
                      }
                      t={t}
                    />
                    <div className={styles.tipoSelector}>
                      <RadioButtonGroup
                        legendText=""
                        name={`tipo-secondary-${index}`}
                        valueSelected={
                          diagnosisTipos[diagnosis.diagnosis.coded] ??
                          diagnosisTypePresuntivoUuid
                        }
                        onChange={(value) =>
                          value != null &&
                          handleDiagnosisTypeChange(
                            diagnosis.diagnosis.coded,
                            String(value),
                          )
                        }
                        orientation="horizontal"
                      >
                        <RadioButton
                          id={`tipo-secondary-${index}-p`}
                          labelText={t("presuntivo", "P - Presuntivo")}
                          value={diagnosisTypePresuntivoUuid}
                        />
                        <RadioButton
                          id={`tipo-secondary-${index}-d`}
                          labelText={t("definitivo", "D - Definitivo")}
                          value={diagnosisTypeDefinitivoUuid}
                        />
                        <RadioButton
                          id={`tipo-secondary-${index}-r`}
                          labelText={t("repetitivo", "R - Repetido")}
                          value={diagnosisTypeRepetitivoUuid}
                        />
                      </RadioButtonGroup>
                    </div>
                  </div>
                ))}
              {!selectedPrimaryDiagnoses?.length &&
                !selectedSecondaryDiagnoses?.length && (
                  <span>
                    {t(
                      "emptyDiagnosisText",
                      "No diagnosis selected — Enter a diagnosis below",
                    )}
                  </span>
                )}
            </div>
            <Row className={styles.row}>
              <Column sm={1}>
                <div className={styles.fieldLabelWithHelp}>
                  <span className={styles.columnLabel}>
                    <RequiredFieldLabel
                      label={t(
                        "primaryDiagnosisRequiredLabel",
                        "Primary diagnosis (Required)",
                      )}
                    />
                  </span>
                  <CatalogHelpLink
                    ariaLabel={t(
                      "cie10OfficialSource",
                      "Open the official MINSA CIE-10 catalog",
                    )}
                    href={config.cie10ReferenceUrl}
                    tooltipLabel={t(
                      "cie10OfficialSourceTooltip",
                      "Consult the official MINSA CIE-10 catalog, including its spreadsheet and current updates.",
                    )}
                  />
                </div>
              </Column>
              <Column sm={3}>
                <FormGroup
                  legendText={t(
                    "searchForPrimaryDiagnosis",
                    "Search for a primary diagnosis",
                  )}
                >
                  <DiagnosisSearch
                    name="primaryDiagnosisSearch"
                    control={control}
                    labelText={t(
                      "enterPrimaryDiagnoses",
                      "Enter Primary diagnoses",
                    )}
                    placeholder={t(
                      "primaryDiagnosisInputPlaceholder",
                      "Choose a primary diagnosis",
                    )}
                    handleSearch={handleSearch}
                    error={errors?.primaryDiagnosisSearch}
                    setIsSearching={setIsSearching}
                  />
                  {error ? (
                    <InlineNotification
                      className={styles.errorNotification}
                      lowContrast
                      title={t("error", "Error")}
                      subtitle={
                        t(
                          "errorFetchingConcepts",
                          "There was a problem fetching concepts",
                        ) + "."
                      }
                      onClose={() => setError(null)}
                    />
                  ) : null}
                  <DiagnosesDisplay
                    fieldName={"primaryDiagnosisSearch"}
                    isDiagnosisNotSelected={isDiagnosisNotSelected}
                    isLoading={isLoadingPrimaryDiagnoses}
                    isSearching={isSearching}
                    onAddDiagnosis={handleAddDiagnosis}
                    searchResults={searchPrimaryResults}
                    t={t}
                    value={watch("primaryDiagnosisSearch")}
                  />
                </FormGroup>
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>
                  {t("secondaryDiagnosis", "Secondary diagnosis")}
                </span>
              </Column>
              <Column sm={3}>
                <FormGroup
                  legendText={t(
                    "searchForSecondaryDiagnosis",
                    "Search for a secondary diagnosis",
                  )}
                >
                  <DiagnosisSearch
                    name="secondaryDiagnosisSearch"
                    control={control}
                    labelText={t(
                      "enterSecondaryDiagnoses",
                      "Enter Secondary diagnoses",
                    )}
                    placeholder={t(
                      "secondaryDiagnosisInputPlaceholder",
                      "Choose a secondary diagnosis",
                    )}
                    handleSearch={handleSearch}
                    error={errors?.secondaryDiagnosisSearch}
                    setIsSearching={setIsSearching}
                  />
                  {error ? (
                    <InlineNotification
                      className={styles.errorNotification}
                      lowContrast
                      title={t("error", "Error")}
                      subtitle={
                        t(
                          "errorFetchingConcepts",
                          "There was a problem fetching concepts",
                        ) + "."
                      }
                      onClose={() => setError(null)}
                    />
                  ) : null}
                  <DiagnosesDisplay
                    fieldName={"secondaryDiagnosisSearch"}
                    isDiagnosisNotSelected={isDiagnosisNotSelected}
                    isLoading={isLoadingSecondaryDiagnoses}
                    isSearching={isSearching}
                    onAddDiagnosis={handleAddDiagnosis}
                    searchResults={searchSecondaryResults}
                    t={t}
                    value={watch("secondaryDiagnosisSearch")}
                  />
                </FormGroup>
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column sm={1}>
                <div className={styles.fieldLabelWithHelp}>
                  <span className={styles.columnLabel}>
                    <RequiredFieldLabel
                      label={t(
                        "codigoPrestacionalRequiredLabel",
                        "Prestational code (Required)",
                      )}
                    />
                  </span>
                  <CatalogHelpLink
                    ariaLabel={t(
                      "prestacionalOfficialSource",
                      "Open the official SIS prestational-code reference",
                    )}
                    href={config.prestacionalReferenceUrl}
                    tooltipLabel={t(
                      "prestacionalOfficialSourceTooltip",
                      "Consult the official SIS reference for FUA prestational codes.",
                    )}
                  />
                </div>
              </Column>
              <Column sm={3}>
                <PrestacionalSearch
                  error={error}
                  requiredError={
                    errors?.codigoPrestacional?.message as string | undefined
                  }
                  isLoading={isLoadingPrestacionales}
                  onAddPrestacional={handleAddPrestacional}
                  onSearch={handlePrestacionalSearch}
                  searchResults={searchPrestacionalResults}
                  selectedConcept={selectedCodigoPrestacional}
                  t={t}
                  value={codigoPrestacionalSearchValue}
                />
                {selectedCodigoPrestacional ? (
                  <div className={styles.prestacionalTagContainer}>
                    <DismissibleTag
                      className={styles.tag}
                      dismissTooltipLabel={t("clearFilter", "Clear filter")}
                      onClose={handleRemovePrestacional}
                      tagTitle={formatPrestacionalDisplay(
                        selectedCodigoPrestacional,
                      )}
                      text={formatPrestacionalDisplay(
                        selectedCodigoPrestacional,
                      )}
                      title={t("clearFilter", "Clear filter")}
                      type="cyan"
                    />
                  </div>
                ) : watch("codigoPrestacional") &&
                  !codigoPrestacionalSearchValue ? (
                  <div className={styles.prestacionalTagContainer}>
                    <DismissibleTag
                      className={styles.tag}
                      dismissTooltipLabel={t("clearFilter", "Clear filter")}
                      onClose={handleRemovePrestacional}
                      tagTitle={watch("codigoPrestacional")}
                      text={watch("codigoPrestacional")}
                      title={t("clearFilter", "Clear filter")}
                      type="gray"
                    />
                  </div>
                ) : null}
              </Column>
            </Row>
            <ReadOnlyClinicalSummary
              clinicalContext={clinicalContext}
              error={clinicalContextError}
              isLoading={isClinicalContextLoading}
              isValidating={isClinicalContextValidating}
            />
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>
                  {t("nextAppointment", "Next appointment")}
                </span>
              </Column>
              <Column sm={3}>
                <Controller
                  name="nextAppointment"
                  control={control}
                  render={({ field, fieldState }) => (
                    <ResponsiveWrapper>
                      <OpenmrsDatePicker
                        {...field}
                        id="nextAppointment"
                        labelText={t("nextAppointment", "Next appointment")}
                        minDate={new Date()}
                        invalid={Boolean(fieldState.error?.message)}
                        invalidText={fieldState.error?.message}
                      />
                    </ResponsiveWrapper>
                  )}
                />
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>{t("note", "Note")}</span>
              </Column>
              <Column sm={3}>
                <Controller
                  name="clinicalNote"
                  control={control}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <ResponsiveWrapper>
                      <TextArea
                        id="additionalNote"
                        rows={rows}
                        labelText={t("clinicalNoteLabel", "Additional notes")}
                        placeholder={t(
                          "clinicalNotePlaceholder",
                          "Add observations that do not fit the fields above",
                        )}
                        value={value ?? ""}
                        onBlur={onBlur}
                        onChange={(event) => {
                          onChange(event);
                          const textareaLineHeight = 24; // This is the default line height for Carbon's TextArea component
                          const newRows = Math.ceil(
                            event.target.scrollHeight / textareaLineHeight,
                          );
                          setRows(newRows);
                        }}
                      />
                    </ResponsiveWrapper>
                  )}
                />
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>
                  {t("image", "Image")}
                </span>
              </Column>
              <Column sm={3}>
                <FormGroup legendText="">
                  <p className={styles.imgUploadHelperText}>
                    {t(
                      "imageUploadHelperText",
                      "Upload images or use this device's camera to capture images",
                    )}
                  </p>
                  <Button
                    className={styles.uploadButton}
                    kind={isTablet ? "ghost" : "tertiary"}
                    onClick={showImageCaptureModal}
                    renderIcon={(props) => <Add size={16} {...props} />}
                  >
                    {t("addImage", "Add image")}
                  </Button>
                  <div className={styles.imgThumbnailGrid}>
                    {currentImages?.map((image, index) => (
                      <div key={index} className={styles.imgThumbnailItem}>
                        <div className={styles.imgThumbnailContainer}>
                          <img
                            className={styles.imgThumbnail}
                            src={image.base64Content}
                            alt={image.fileDescription ?? image.fileName}
                          />
                        </div>
                        <Button
                          kind="ghost"
                          className={styles.removeButton}
                          onClick={() => handleRemoveImage(index)}
                        >
                          <CloseFilled size={16} className={styles.closeIcon} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </FormGroup>
              </Column>
            </Row>
          </Stack>
        </div>
        {canonicalVerificationStatus === "error" && (
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            title={t(
              "visitNoteRevalidationError",
              "The visit summary could not be refreshed",
            )}
            subtitle={t(
              "visitNoteRevalidationErrorDescription",
              "The latest visit summary could not be verified. Reload before saving.",
            )}
          />
        )}
        {canonicalVerificationStatus === "validating" && (
          <InlineNotification
            hideCloseButton
            kind="info"
            lowContrast
            title={t(
              "visitNoteRevalidationInProgressTitle",
              "Verifying the visit summary",
            )}
            subtitle={t(
              "visitNoteRevalidationInProgress",
              "Wait while the active visit summary is verified.",
            )}
          />
        )}
        <ButtonSet
          className={classnames({
            [styles.tablet]: isTablet,
            [styles.desktop]: !isTablet,
          })}
        >
          <Button
            className={styles.button}
            kind="secondary"
            onClick={() => closeWorkspace()}
          >
            {t("discard", "Discard")}
          </Button>
          <Button
            className={styles.button}
            kind="primary"
            onClick={() => handleSubmit}
            disabled={
              !hasUserUnsavedChanges ||
              isSubmitting ||
              isCanonicalVerificationBlocked
            }
            type="submit"
          >
            {isSubmitting ? (
              <InlineLoading description={t("saving", "Saving") + "..."} />
            ) : (
              <span>{t("saveAndClose", "Save and close")}</span>
            )}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

function ReadOnlyClinicalSummary({
  clinicalContext,
  error,
  isLoading,
  isValidating,
}: {
  clinicalContext: VisitNoteClinicalContext;
  error?: Error;
  isLoading: boolean;
  isValidating: boolean;
}) {
  const { t } = useTranslation();
  const sections = [
    {
      id: "clinical-summary",
      title: t("clinicalSummary", "Clinical summary"),
      fields: [
        {
          id: "chief-complaint",
          label: t("chiefComplaint", "Chief complaint"),
          value: clinicalContext.chiefComplaint,
        },
        {
          id: "illness-duration",
          label: t("illnessDuration", "Illness duration"),
          value: clinicalContext.illnessDuration,
        },
        {
          id: "biological-functions",
          label: t("biologicalFunctions", "Biological functions"),
          value: clinicalContext.biologicalFunctions,
        },
      ],
    },
    {
      id: "soap-assessment",
      title: t("soapSection", "SOAP assessment"),
      fields: [
        {
          id: "subjective",
          label: t("subjective", "Subjective"),
          value: clinicalContext.subjective,
        },
        {
          id: "objective",
          label: t("objective", "Objective / physical exam"),
          value: clinicalContext.objective,
        },
        {
          id: "assessment",
          label: t("assessment", "Assessment"),
          value: clinicalContext.assessment,
        },
        {
          id: "plan",
          label: t("plan", "Treatment plan"),
          value: clinicalContext.plan,
        },
      ],
    },
    {
      id: "orders-and-continuity",
      title: t("workPlan", "Orders and continuity of care"),
      fields: [
        {
          id: "auxiliary-exams",
          label: t("auxiliaryExams", "Auxiliary exams"),
          value: clinicalContext.auxiliaryExams,
        },
        {
          id: "procedures",
          label: t("procedures", "Procedures"),
          value: clinicalContext.procedures,
        },
        {
          id: "prescriptions",
          label: t("prescriptions", "Prescriptions"),
          value: clinicalContext.prescriptions,
        },
        {
          id: "referral",
          label: t("referral", "Referral / counter-referral"),
          value: clinicalContext.referral,
        },
      ],
    },
  ];

  return (
    <>
      <Row className={styles.summaryIntroduction}>
        <Column sm={4}>
          <div className={styles.summaryHeading}>
            <h3>{sections[0].title}</h3>
            <span className={styles.readOnlyBadge}>
              {t("readOnly", "Read-only")}
            </span>
          </div>
          <p className={styles.summaryDescription}>
            {t(
              "clinicalSummaryReadOnlyDescription",
              "This section summarizes records from outpatient care and cannot be edited here.",
            )}
          </p>
          {isLoading || isValidating ? (
            <InlineLoading
              description={t(
                "clinicalSummaryLoading",
                "Loading the outpatient clinical summary...",
              )}
              status="active"
            />
          ) : null}
          {error ? (
            <InlineNotification
              hideCloseButton
              kind="error"
              lowContrast
              title={t(
                "clinicalSummaryLoadErrorTitle",
                "The clinical summary could not be loaded",
              )}
              subtitle={t(
                "clinicalSummaryLoadErrorDescription",
                "Reload before relying on this outpatient summary.",
              )}
            />
          ) : null}
        </Column>
      </Row>
      {sections.map((section, sectionIndex) => (
        <React.Fragment key={section.id}>
          {sectionIndex > 0 ? (
            <Row className={styles.summarySectionHeading}>
              <Column sm={4}>
                <h3>{section.title}</h3>
              </Column>
            </Row>
          ) : null}
          {section.fields.map((field) => (
            <ReadOnlyClinicalField
              id={field.id}
              isLoading={isLoading}
              key={field.id}
              label={field.label}
              value={field.value}
            />
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

function ReadOnlyClinicalField({
  id,
  isLoading,
  label,
  value,
}: {
  id: string;
  isLoading: boolean;
  label: string;
  value?: string;
}) {
  const { t } = useTranslation();
  const labelId = `${id}-summary-label`;
  const normalizedValue = value?.trim();

  return (
    <Row className={styles.row}>
      <Column sm={1}>
        <span className={styles.columnLabel} id={labelId}>
          {label}
        </span>
      </Column>
      <Column sm={3}>
        <div
          aria-labelledby={labelId}
          className={styles.readOnlyValue}
          role="group"
        >
          {isLoading ? (
            <SkeletonText />
          ) : normalizedValue ? (
            normalizedValue
          ) : (
            <span className={styles.emptySummaryValue}>
              {t("notRecorded", "Not recorded")}
            </span>
          )}
        </div>
      </Column>
    </Row>
  );
}

function SelectedDiagnosis({
  diagnosis,
  kind,
  onRemove,
  t,
}: SelectedDiagnosisProps) {
  const formattedDiagnosis = formatDiagnosisDisplay(diagnosis);

  return (
    <div
      className={classnames(styles.selectedDiagnosis, {
        [styles.selectedPrimaryDiagnosis]: kind === "primary",
        [styles.selectedSecondaryDiagnosis]: kind === "secondary",
      })}
      title={formattedDiagnosis}
    >
      <span className={styles.selectedDiagnosisText}>{formattedDiagnosis}</span>
      <button
        type="button"
        className={styles.removeDiagnosisButton}
        onClick={onRemove}
        aria-label={t("clearFilter", "Clear filter")}
        title={t("clearFilter", "Clear filter")}
      >
        <CloseFilled size={16} />
      </button>
    </div>
  );
}

function DiagnosisSearch({
  name,
  control,
  labelText,
  placeholder,
  handleSearch,
  error,
  setIsSearching,
}: DiagnosisSearchProps) {
  const isTablet = useLayoutType() === "tablet";
  const inputRef = useRef(null);

  const searchInputFocus = useCallback(() => {
    inputRef.current.focus();
  }, []);

  useEffect(() => {
    if (error) {
      searchInputFocus();
    }
  }, [error, searchInputFocus]);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange, onBlur }, fieldState }) => (
        <>
          <ResponsiveWrapper>
            <Search
              ref={inputRef}
              size={isTablet ? "lg" : "md"}
              id={name}
              labelText={labelText}
              className={error && styles.diagnoserrorOutline}
              placeholder={placeholder}
              renderIcon={
                error && ((props) => <WarningFilled fill="red" {...props} />)
              }
              onChange={(e) => {
                setIsSearching(true);
                onChange(e);
                handleSearch(name);
              }}
              value={value ?? ""}
              onBlur={onBlur}
            />
          </ResponsiveWrapper>
          {fieldState?.error?.message && (
            <p className={styles.errorMessage}>{fieldState?.error?.message}</p>
          )}
        </>
      )}
    />
  );
}

function PrestacionalSearch({
  error,
  requiredError,
  isLoading,
  onAddPrestacional,
  onSearch,
  searchResults,
  selectedConcept,
  t,
  value,
}: PrestacionalSearchProps) {
  const isTablet = useLayoutType() === "tablet";

  return (
    <>
      <ResponsiveWrapper>
        <Search
          size={isTablet ? "lg" : "md"}
          id="codigoPrestacionalSearch"
          labelText={t(
            "codigoPrestacionalInputLabel",
            "Indique el Código Prestacional",
          )}
          placeholder={t(
            "codigoPrestacionalPlaceholder",
            "Buscar Código Prestacional",
          )}
          disabled={Boolean(selectedConcept)}
          renderIcon={
            error && ((props) => <WarningFilled fill="red" {...props} />)
          }
          onChange={(event) => onSearch(event.target.value)}
          value={value}
        />
      </ResponsiveWrapper>
      {requiredError ? (
        <div className={styles.errorMessage} role="alert">
          {requiredError}
        </div>
      ) : null}
      {isLoading ? <Loader /> : null}
      {!isLoading && value && searchResults?.length > 0 ? (
        <ul className={styles.diagnosisList}>
          {searchResults.map((prestacional) => {
            const { code, name } = getPrestacionalDisplayParts(prestacional);

            return (
              <li className={styles.diagnosis} key={prestacional.uuid}>
                <button
                  type="button"
                  className={classnames(styles.diagnosisButton, {
                    [styles.diagnosisButtonSingle]: !code,
                  })}
                  onClick={() => onAddPrestacional(prestacional)}
                >
                  {code ? (
                    <>
                      <span className={styles.diagnosisCode}>{code}</span>
                      <span className={styles.diagnosisSeparator}>-</span>
                    </>
                  ) : null}
                  <span className={styles.diagnosisName}>{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {!isLoading && value && searchResults?.length === 0 ? (
        <ResponsiveWrapper>
          <Tile className={styles.emptyResults}>
            <span>
              {t(
                "noMatchingPrestacionales",
                "No se encontraron códigos prestacionales coincidentes",
              )}{" "}
              <strong>"{value}"</strong>
            </span>
          </Tile>
        </ResponsiveWrapper>
      ) : null}
      {error ? (
        <InlineNotification
          className={styles.errorNotification}
          lowContrast
          title={t("error", "Error")}
          subtitle={
            t(
              "errorFetchingConcepts",
              "There was a problem fetching concepts",
            ) + "."
          }
        />
      ) : null}
    </>
  );
}

function CatalogHelpLink({
  ariaLabel,
  href,
  tooltipLabel,
}: CatalogHelpLinkProps) {
  const safeHref = href?.trim();
  if (!safeHref?.startsWith("https://")) {
    return null;
  }

  return (
    <Tooltip align="right" label={tooltipLabel}>
      <a
        aria-label={ariaLabel}
        className={styles.catalogHelpLink}
        href={safeHref}
        rel="noopener noreferrer"
        target="_blank"
        title={tooltipLabel}
      >
        <Information aria-hidden size={16} />
      </a>
    </Tooltip>
  );
}

function RequiredFieldLabel({ label }: { label: string }) {
  const { t } = useTranslation();

  return (
    <>
      {label}
      <span title={t("required", "Required")} className={styles.required}>
        *
      </span>
    </>
  );
}

function DiagnosesDisplay({
  fieldName,
  isDiagnosisNotSelected,
  isLoading,
  isSearching,
  onAddDiagnosis,
  searchResults,
  t,
  value,
}: DiagnosesDisplayProps) {
  if (!value) {
    return null;
  }

  if (isSearching || isLoading) {
    return <Loader />;
  }

  if (searchResults?.length > 0) {
    return (
      <ul className={styles.diagnosisList}>
        {searchResults.map((diagnosis) => {
          if (isDiagnosisNotSelected(diagnosis)) {
            const { code, name } = getCie10DisplayParts(diagnosis);
            const diagnosisName = toReadableDiagnosisName(name);

            return (
              <li className={styles.diagnosis} key={diagnosis.uuid}>
                <button
                  type="button"
                  className={styles.diagnosisButton}
                  onClick={() => onAddDiagnosis(diagnosis, fieldName)}
                >
                  {code ? (
                    <>
                      <span className={styles.diagnosisCode}>{code}</span>
                      <span className={styles.diagnosisSeparator}>-</span>
                      <span className={styles.diagnosisName}>
                        {diagnosisName}
                      </span>
                    </>
                  ) : (
                    <span className={styles.diagnosisName}>
                      {diagnosisName}
                    </span>
                  )}
                </button>
              </li>
            );
          }

          return null;
        })}
      </ul>
    );
  }

  if (searchResults?.length === 0) {
    return (
      <ResponsiveWrapper>
        <Tile className={styles.emptyResults}>
          <span>
            {t("noMatchingDiagnoses", "No diagnoses found matching")}{" "}
            <strong>"{value}"</strong>
          </span>
        </Tile>
      </ResponsiveWrapper>
    );
  }
}

function Loader() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <SkeletonText key={index} className={styles.skeleton} />
      ))}
    </>
  );
}

const VisitNotesForm: React.FC<
  PatientWorkspace2DefinitionProps<VisitNotesFormProps, {}>
> = (props) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEditVisitNotes = userHasAccess(
    visitNotesEditPrivilege,
    session?.user,
  );
  const config = useConfig<ConfigObject>();
  const visitNoteConfig = {
    ...defaultVisitNoteClinicalConceptUuids,
    ...config.visitNoteConfig,
  };
  const currentVisitContext = props.groupProps.visitContext as
    | VisitContextWithUuid
    | null
    | undefined;
  const visitUuid =
    currentVisitContext?.visit?.uuid ?? currentVisitContext?.uuid;
  const resolution = useCanonicalVisitNoteEncounter(
    canEditVisitNotes ? props.groupProps.patientUuid : null,
    canEditVisitNotes ? visitUuid : null,
    canEditVisitNotes ? visitNoteConfig.encounterTypeUuid : null,
    canEditVisitNotes ? visitNoteConfig.formConceptUuid : null,
  );
  const requestedOnAfterSave = props.workspaceProps?.onAfterSave;
  const handleAfterSave = useCallback(async () => {
    await Promise.allSettled([
      Promise.resolve().then(() => resolution.mutate()),
      Promise.resolve().then(() => requestedOnAfterSave?.()),
    ]);
  }, [requestedOnAfterSave, resolution]);

  useEffect(() => {
    if (!canEditVisitNotes) {
      void props.closeWorkspace({
        closeWindow: true,
        discardUnsavedChanges: true,
      });
    }
  }, [canEditVisitNotes, props.closeWorkspace]);

  if (!canEditVisitNotes) {
    return null;
  }

  if (resolution.status === "loading") {
    return (
      <Workspace2 title={t("visitNoteWorkspaceTitle", "Visit note")}>
        <InlineLoading
          description={t(
            "resolvingVisitNote",
            "Checking the active visit summary...",
          )}
          status="active"
        />
      </Workspace2>
    );
  }

  if (resolution.status !== "ready") {
    return (
      <Workspace2 title={t("visitNoteWorkspaceTitle", "Visit note")}>
        <InlineNotification
          hideCloseButton
          kind="error"
          lowContrast
          title={t(
            "visitNoteResolutionError",
            "The visit summary cannot be opened",
          )}
          subtitle={
            resolution.status === "ambiguous"
              ? t(
                  "visitNoteDuplicateEncounterError",
                  "More than one summary exists for the active visit. Resolve the duplicate before editing.",
                )
              : t(
                  "visitNoteVerificationError",
                  "The active visit summary could not be verified. Reload and try again.",
                )
          }
        />
      </Workspace2>
    );
  }

  const encounter = resolution.encounter
    ? ({
        ...resolution.encounter,
        id: resolution.encounter.uuid,
        rawDatetime: resolution.encounter.encounterDatetime,
      } as EditableVisitNoteEncounter)
    : undefined;

  return (
    <VisitNotesFormContent
      {...props}
      workspaceProps={{
        ...props.workspaceProps,
        canonicalVerificationStatus: resolution.revalidationError
          ? "error"
          : resolution.isValidating
            ? "validating"
            : "verified",
        encounter,
        formContext: encounter ? "editing" : "creating",
        onAfterSave: handleAfterSave,
      }}
    />
  );
};

export default VisitNotesForm;
