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
} from '@carbon/react';
import { Add, CloseFilled, WarningFilled } from '@carbon/react/icons';
import { zodResolver } from '@hookform/resolvers/zod';
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
  useSession,
  Workspace2,
} from '@openmrs/esm-framework';
import {
  invalidateVisitAndEncounterData,
  type PatientWorkspace2DefinitionProps,
  useAllowedFileExtensions,
} from '@openmrs/esm-patient-common-lib';
import classnames from 'classnames';
import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import { debounce } from 'lodash-es';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Control, Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { z } from 'zod';
import type { ConfigObject } from '../config-schema';
import type { Concept, Diagnosis, DiagnosisPayload, VisitNotePayload } from '../types';
import { defaultVisitNoteClinicalConceptUuids } from './visit-note-config-schema';
import {
  buildTipoDxObs,
  deletePatientDiagnosis,
  fetchDiagnosisConceptsByName,
  fetchPrestacionalConceptsByName,
  getCertaintyForTipo,
  legacyProceduresConceptUuids,
  legacyStructuredVisitNoteConceptUuids,
  parseTipoDxObs,
  savePatientDiagnosis,
  saveVisitNote,
  updateVisitNote,
  useProviderSignatureDetails,
  useVisitNoteClinicalContext,
  useVisitNotes,
} from './visit-notes.resource';
import styles from './visit-notes-form.scss';

type VisitNotesFormData = Omit<z.infer<ReturnType<typeof createSchema>>, 'images'> & {
  images?: UploadedFile[];
};

type VisitNoteTextFieldName =
  | 'codigoPrestacional'
  | 'chiefComplaint'
  | 'illnessDuration'
  | 'biologicalFunctions'
  | 'subjective'
  | 'objective'
  | 'assessment'
  | 'plan'
  | 'auxiliaryExams'
  | 'procedures'
  | 'prescriptions'
  | 'referral'
  | 'nextAppointment'
  | 'clinicalNote';

interface VisitContextWithUuid {
  uuid?: string;
  visit?: {
    uuid?: string;
  };
}

type EncounterObsValue = string | number | boolean | { uuid?: string; display?: string };

interface EncounterFormObs {
  concept?: {
    uuid?: string;
  };
  formFieldNamespace?: string;
  formFieldPath?: string;
  uuid?: string;
  value?: EncounterObsValue;
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
  handleSearch: (fieldName: 'primaryDiagnosisSearch' | 'secondaryDiagnosisSearch') => void;
  labelText: string;
  name: 'primaryDiagnosisSearch' | 'secondaryDiagnosisSearch';
  placeholder: string;
  setIsSearching: (isSearching: boolean) => void;
}

interface VisitNoteTextAreaRowProps {
  control: Control<VisitNotesFormData>;
  inputLabelText?: string;
  labelText: string;
  name: VisitNoteTextFieldName;
  placeholder: string;
  rows?: number;
}

interface PrestacionalSearchProps {
  error?: Error;
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
  kind: 'primary' | 'secondary';
  onRemove: () => void;
  t: TFunction;
}

const cie10DisplayPattern = /^(?<name>.+?)\s*\((?<code>[A-Z][0-9][A-Z0-9.]{1,5})\)\s*$/i;

function isMostlyUpperCase(value: string) {
  const letters: Array<string> = value.match(/\p{L}/gu) ?? [];
  if (!letters.length) {
    return false;
  }

  const upperCaseLetters = letters.filter((letter) => letter === letter.toLocaleUpperCase('es-PE'));
  return upperCaseLetters.length / letters.length > 0.8;
}

function toReadableDiagnosisName(value: string) {
  const normalizedValue = value.trim().replace(/\s+/g, ' ');

  if (!isMostlyUpperCase(normalizedValue)) {
    return normalizedValue.replace(/\b[ivxlcdm]+\b/gi, (romanNumber) => romanNumber.toLocaleUpperCase('es-PE'));
  }

  return normalizedValue
    .toLocaleLowerCase('es-PE')
    .split(' ')
    .map((word, index) => {
      const normalizedWord = word.replace(/[^\p{L}]/gu, '');

      if (/^[ivxlcdm]+$/i.test(normalizedWord)) {
        return word.toLocaleUpperCase('es-PE');
      }

      return index === 0 ? word.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('es-PE')) : word;
    })
    .join(' ');
}

function getConceptMappingCode(concept: Concept) {
  const mappings = concept.conceptMappings ?? concept.mappings ?? [];
  const cie10Mapping = mappings.find((mapping) => {
    const sourceName =
      mapping.conceptReferenceTerm?.conceptSource?.name ?? mapping.conceptReferenceTerm?.conceptSource?.display ?? '';
    return /icd[-\s]?10|cie[-\s]?10/i.test(sourceName);
  });

  return cie10Mapping?.conceptReferenceTerm?.code;
}

function formatDiagnosisDisplay(conceptOrDiagnosis: Concept | Diagnosis) {
  const display = conceptOrDiagnosis.display?.trim() ?? '';
  const codeFromMapping = 'uuid' in conceptOrDiagnosis ? getConceptMappingCode(conceptOrDiagnosis) : undefined;
  const match = display.match(cie10DisplayPattern);
  const code = codeFromMapping ?? match?.groups?.code;
  const rawName = match?.groups?.name ?? display;
  const readableName = toReadableDiagnosisName(rawName);

  return code ? `${code.toLocaleUpperCase('es-PE')} - ${readableName}` : readableName;
}

const createSchema = (_t: TFunction) => {
  return z.object({
    noteDate: z.date(),
    primaryDiagnosisSearch: z.string(),
    secondaryDiagnosisSearch: z.string().optional(),
    codigoPrestacional: z.string().optional(),
    chiefComplaint: z.string().optional(),
    illnessDuration: z.string().optional(),
    biologicalFunctions: z.string().optional(),
    subjective: z.string().optional(),
    objective: z.string().optional(),
    assessment: z.string().optional(),
    plan: z.string().optional(),
    auxiliaryExams: z.string().optional(),
    procedures: z.string().optional(),
    prescriptions: z.string().optional(),
    referral: z.string().optional(),
    nextAppointment: z.string().optional(),
    clinicalNote: z.string().optional(),
    images: z.array(z.any()).optional(),
  });
};

export type EditableVisitNoteEncounter = Encounter & {
  id: string;
  rawDatetime: string;
};

export interface VisitNotesFormProps {
  encounter?: EditableVisitNoteEncounter;
  formContext: 'creating' | 'editing';
}

const VisitNotesForm: React.FC<PatientWorkspace2DefinitionProps<VisitNotesFormProps, {}>> = ({
  closeWorkspace,
  workspaceProps: { formContext, encounter },
  groupProps: { patientUuid, patient, visitContext },
}) => {
  const isEditing: boolean = Boolean(formContext === 'editing' && encounter?.id);
  const searchTimeoutInMs = 500;
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const { isPrimaryDiagnosisRequired, ...config } = useConfig<ConfigObject>();
  const visitNoteConfig = {
    ...defaultVisitNoteClinicalConceptUuids,
    ...config.visitNoteConfig,
  };
  const memoizedState = useMemo(() => ({ patientUuid, patient }), [patientUuid, patient]);
  const {
    clinicianEncounterRole,
    encounterNoteTextConceptUuid,
    codigoPrestacionalConceptUuid,
    chiefComplaintConceptUuid,
    illnessDurationConceptUuid,
    anamnesisConceptUuid,
    biologicalFunctionsConceptUuid,
    soapSubjectiveConceptUuid,
    soapObjectiveConceptUuid,
    soapAssessmentConceptUuid,
    soapPlanConceptUuid,
    labOrdersConceptUuid,
    proceduresConceptUuid,
    prescriptionsConceptUuid,
    referralConceptUuid,
    nextAppointmentConceptUuid,
    encounterTypeUuid,
    formConceptUuid,
    diagnosisTypeConceptUuid,
    diagnosisTypePresuntivoUuid,
    diagnosisTypeDefinitivoUuid,
    diagnosisTypeRepetitivoUuid,
  } = visitNoteConfig;
  const currentVisitContext = visitContext as VisitContextWithUuid | null | undefined;
  const visitUuid = currentVisitContext?.visit?.uuid ?? currentVisitContext?.uuid;
  const { clinicalContext } = useVisitNoteClinicalContext(patientUuid, visitUuid);
  const [isLoadingPrimaryDiagnoses, setIsLoadingPrimaryDiagnoses] = useState(false);
  const [isLoadingSecondaryDiagnoses, setIsLoadingSecondaryDiagnoses] = useState(false);
  const [isLoadingPrestacionales, setIsLoadingPrestacionales] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPrimaryDiagnoses, setSelectedPrimaryDiagnoses] = useState<Array<Diagnosis>>([]);
  const [selectedSecondaryDiagnoses, setSelectedSecondaryDiagnoses] = useState<Array<Diagnosis>>([]);
  const [searchPrimaryResults, setSearchPrimaryResults] = useState<Array<Concept>>(null);
  const [searchSecondaryResults, setSearchSecondaryResults] = useState<Array<Concept>>(null);
  const [searchPrestacionalResults, setSearchPrestacionalResults] = useState<Array<Concept>>([]);
  const [selectedCodigoPrestacional, setSelectedCodigoPrestacional] = useState<Concept | null>(null);
  const [codigoPrestacionalSearchValue, setCodigoPrestacionalSearchValue] = useState('');
  const [combinedDiagnoses, setCombinedDiagnoses] = useState<Array<Diagnosis>>([]);
  const [rows, setRows] = useState<number>();
  const [error, setError] = useState<Error>(null);
  const { allowedFileExtensions } = useAllowedFileExtensions();

  // MINSA/NTS-139 records each diagnosis as Presuntivo, Definitivo or
  // Repetitivo. OpenMRS patientdiagnoses only stores certainty, so SIH.SALUS
  // keeps the exact MINSA type as an obs keyed by the diagnosis concept UUID.
  const [diagnosisTipos, setDiagnosisTipos] = useState<Record<string, string>>({});

  const visitNoteFormSchema = useMemo(() => createSchema(t), [t]);
  const encounterObs = (encounter?.obs ?? []) as Array<EncounterFormObs>;
  const getEncounterObs = useCallback(
    (conceptUuid: string, formFieldPath?: string) =>
      encounterObs.find(
        (obs) => obs.concept?.uuid === conceptUuid && (!formFieldPath || obs.formFieldPath === formFieldPath),
      ),
    [encounterObs],
  );
  const getEncounterObsValue = useCallback(
    (conceptUuid: string, formFieldPath?: string) => {
      const obs = getEncounterObs(conceptUuid, formFieldPath);
      if (obs?.value == null) {
        return '';
      }
      if (typeof obs.value === 'object') {
        return String(obs.value.display ?? obs.value.uuid ?? '');
      }
      return String(obs.value);
    },
    [getEncounterObs],
  );
  const getEncounterObsConceptValue = useCallback(
    (conceptUuid: string, formFieldPath?: string): Concept | null => {
      const obs = getEncounterObs(conceptUuid, formFieldPath);
      if (!obs?.value || typeof obs.value !== 'object') {
        return null;
      }

      const value = obs.value as { display?: string; uuid?: string };
      return value.uuid ? { uuid: value.uuid, display: value.display ?? value.uuid } : null;
    },
    [getEncounterObs],
  );
  const getEncounterProceduresValue = useCallback(
    () =>
      getEncounterObsValue(proceduresConceptUuid, 'procedures') ||
      getEncounterObsValue(legacyProceduresConceptUuids.textWithProceduresPath, 'procedures') ||
      getEncounterObsValue(legacyProceduresConceptUuids.procedure, 'procedures') ||
      getEncounterObsValue(proceduresConceptUuid) ||
      getEncounterObsValue(legacyProceduresConceptUuids.procedure),
    [getEncounterObsValue, proceduresConceptUuid],
  );
  const getEncounterCodigoPrestacionalValue = useCallback(
    () =>
      getEncounterObsConceptValue(codigoPrestacionalConceptUuid, 'codigo-prestacional')?.display ||
      getEncounterObsValue(codigoPrestacionalConceptUuid, 'codigo-prestacional') ||
      getEncounterObsValue(legacyStructuredVisitNoteConceptUuids.sharedTextWithFormFieldPath, 'codigo-prestacional'),
    [codigoPrestacionalConceptUuid, getEncounterObsConceptValue, getEncounterObsValue],
  );
  const getEncounterBiologicalFunctionsValue = useCallback(
    () =>
      getEncounterObsValue(biologicalFunctionsConceptUuid, 'biological-functions') ||
      getEncounterObsValue(legacyStructuredVisitNoteConceptUuids.anamnesisText, 'biological-functions'),
    [biologicalFunctionsConceptUuid, getEncounterObsValue],
  );
  const getEncounterSubjectiveValue = useCallback(
    () => getEncounterObsValue(soapSubjectiveConceptUuid) || getEncounterObsValue(anamnesisConceptUuid),
    [anamnesisConceptUuid, getEncounterObsValue, soapSubjectiveConceptUuid],
  );
  const getEncounterPlanValue = useCallback(
    () =>
      getEncounterObsValue(soapPlanConceptUuid, 'soap-plan') ||
      getEncounterObsValue(legacyStructuredVisitNoteConceptUuids.sharedTextWithFormFieldPath, 'soap-plan'),
    [getEncounterObsValue, soapPlanConceptUuid],
  );

  const customResolver = useCallback(
    async (data, context, options) => {
      const zodResult = await zodResolver(visitNoteFormSchema)(data, context, options);

      if (isPrimaryDiagnosisRequired && selectedPrimaryDiagnoses.length === 0) {
        return {
          ...zodResult,
          errors: {
            ...zodResult.errors,
            primaryDiagnosisSearch: {
              type: 'custom',
              message: t('primaryDiagnosisRequired', 'Choose at least one primary diagnosis'),
            },
          },
        };
      }

      return zodResult;
    },
    [visitNoteFormSchema, isPrimaryDiagnosisRequired, selectedPrimaryDiagnoses, t],
  );

  const {
    clearErrors,
    control,
    formState: { errors, dirtyFields, isSubmitting },
    handleSubmit,
    setValue,
    watch,
  } = useForm<VisitNotesFormData>({
    mode: 'onSubmit',
    resolver: customResolver,
    defaultValues: {
      primaryDiagnosisSearch: '',
      noteDate: isEditing ? new Date(encounter.rawDatetime) : new Date(),
      codigoPrestacional: isEditing ? getEncounterCodigoPrestacionalValue() : '',
      chiefComplaint: isEditing ? getEncounterObsValue(chiefComplaintConceptUuid) : '',
      illnessDuration: isEditing ? getEncounterObsValue(illnessDurationConceptUuid) : '',
      biologicalFunctions: isEditing ? getEncounterBiologicalFunctionsValue() : '',
      subjective: isEditing ? getEncounterSubjectiveValue() : '',
      objective: isEditing ? getEncounterObsValue(soapObjectiveConceptUuid) : '',
      assessment: isEditing ? getEncounterObsValue(soapAssessmentConceptUuid) : '',
      plan: isEditing ? getEncounterPlanValue() : '',
      auxiliaryExams: isEditing ? getEncounterObsValue(labOrdersConceptUuid) : '',
      procedures: isEditing ? getEncounterProceduresValue() : '',
      prescriptions: isEditing ? getEncounterObsValue(prescriptionsConceptUuid) : '',
      referral: isEditing ? getEncounterObsValue(referralConceptUuid) : '',
      nextAppointment: isEditing ? getEncounterObsValue(nextAppointmentConceptUuid) : '',
      clinicalNote: isEditing
        ? String(encounter?.obs?.find((obs) => obs.concept.uuid === encounterNoteTextConceptUuid)?.value || '')
        : '',
    },
  });

  const prefillTextField = useCallback(
    (fieldName: VisitNoteTextFieldName, value?: string) => {
      if (isEditing || !value?.trim() || dirtyFields[fieldName] || watch(fieldName)) {
        return;
      }
      setValue(fieldName, value, { shouldDirty: true });
    },
    [dirtyFields, isEditing, setValue, watch],
  );

  useEffect(() => {
    const existingCodigoPrestacional = getEncounterObsConceptValue(
      codigoPrestacionalConceptUuid,
      'codigo-prestacional',
    );
    if (isEditing && existingCodigoPrestacional) {
      setSelectedCodigoPrestacional(existingCodigoPrestacional);
    }
  }, [codigoPrestacionalConceptUuid, getEncounterObsConceptValue, isEditing]);

  useEffect(() => {
    prefillTextField('codigoPrestacional', clinicalContext?.codigoPrestacional);
    prefillTextField('chiefComplaint', clinicalContext?.chiefComplaint);
    prefillTextField('illnessDuration', clinicalContext?.illnessDuration);
    prefillTextField('biologicalFunctions', clinicalContext?.biologicalFunctions);
    prefillTextField('subjective', clinicalContext?.subjective);
    prefillTextField('objective', clinicalContext?.objective);
    prefillTextField('assessment', clinicalContext?.assessment);
    prefillTextField('plan', clinicalContext?.plan);
    prefillTextField('auxiliaryExams', clinicalContext?.auxiliaryExams);
    prefillTextField('procedures', clinicalContext?.procedures);
    prefillTextField('prescriptions', clinicalContext?.prescriptions);
    prefillTextField('referral', clinicalContext?.referral);
    prefillTextField('nextAppointment', clinicalContext?.nextAppointment);
  }, [clinicalContext, prefillTextField]);

  useEffect(() => {
    if (encounter?.diagnoses?.length) {
      try {
        const transformedDiagnoses = encounter.diagnoses.map((d) => ({
          patient: patientUuid,
          diagnosis: { coded: d.diagnosis.coded?.uuid },
          certainty: d.certainty,
          rank: d.rank,
          display: d.display,
        }));

        const primaryDiagnoses = transformedDiagnoses.filter((d) => d.rank === 1);
        const secondaryDiagnoses = transformedDiagnoses.filter((d) => d.rank === 2);

        setSelectedPrimaryDiagnoses(primaryDiagnoses);
        setSelectedSecondaryDiagnoses(secondaryDiagnoses);
        setCombinedDiagnoses([...primaryDiagnoses, ...secondaryDiagnoses]);

        // Restore the exact MINSA diagnosis type (P/D/R) saved alongside the
        // encounter, keyed back to its coded diagnosis via the formFieldPath.
        const restored = parseTipoDxObs((encounter.obs ?? []) as Array<EncounterFormObs>);
        if (Object.keys(restored).length) {
          setDiagnosisTipos(restored);
        }
      } catch {
        setError(new Error(t('errorTransformingDiagnoses', 'Error transforming diagnoses')));
        createErrorHandler();
      }
    }
  }, [encounter, patientUuid, t]);

  const currentImages = watch('images');

  const { mutateVisitNotes } = useVisitNotes(patientUuid);
  const { mutate: globalMutate } = useSWRConfig();

  const mutateAttachments = useCallback(
    () => globalMutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/attachment`)),
    [globalMutate],
  );

  const locationUuid = session?.sessionLocation?.uuid;
  const providerUuid = session?.currentProvider?.uuid;
  const encounterProvider = encounter?.encounterProviders?.[0]?.provider;
  const registeredProviderUuid = isEditing ? encounterProvider?.uuid : providerUuid;
  const { providerSignatureDetails } = useProviderSignatureDetails(registeredProviderUuid);
  const registeredProviderName =
    providerSignatureDetails.name ??
    encounterProvider?.person?.display ??
    encounterProvider?.display ??
    session?.currentProvider?.identifier;
  const registeredProviderCode =
    providerSignatureDetails.professionalRegistration ?? providerSignatureDetails.identifier;

  const debouncedSearch = useMemo(
    () =>
      debounce((fieldQuery, fieldName) => {
        clearErrors('primaryDiagnosisSearch');
        if (fieldQuery) {
          if (fieldName === 'primaryDiagnosisSearch') {
            setIsLoadingPrimaryDiagnoses(true);
          } else if (fieldName === 'secondaryDiagnosisSearch') {
            setIsLoadingSecondaryDiagnoses(true);
          }

          fetchDiagnosisConceptsByName(fieldQuery, config.diagnosisConceptClass)
            .then((matchingConceptDiagnoses: Array<Concept>) => {
              if (fieldName === 'primaryDiagnosisSearch') {
                setSearchPrimaryResults(matchingConceptDiagnoses);
                setIsLoadingPrimaryDiagnoses(false);
              } else if (fieldName === 'secondaryDiagnosisSearch') {
                setSearchSecondaryResults(matchingConceptDiagnoses);
                setIsLoadingSecondaryDiagnoses(false);
              }
            })
            .catch((e) => {
              setError(e);
              createErrorHandler();
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
        fetchPrestacionalConceptsByName(trimmedQuery, config.prestacionalConceptSourceName)
          .then((matchingPrestacionales) => {
            setSearchPrestacionalResults(matchingPrestacionales);
            setIsLoadingPrestacionales(false);
          })
          .catch((e) => {
            setError(e);
            setIsLoadingPrestacionales(false);
            createErrorHandler();
          });
      }, searchTimeoutInMs),
    [config.prestacionalConceptSourceName],
  );

  const handleSearch = useCallback(
    (fieldName: 'primaryDiagnosisSearch' | 'secondaryDiagnosisSearch') => {
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
      setValue('codigoPrestacional', '');
      debouncedPrestacionalSearch(value);
    },
    [debouncedPrestacionalSearch, setValue],
  );

  const handleAddPrestacional = useCallback(
    (concept: Concept) => {
      setSelectedCodigoPrestacional(concept);
      setCodigoPrestacionalSearchValue('');
      setSearchPrestacionalResults([]);
      setValue('codigoPrestacional', concept.display, { shouldDirty: true });
    },
    [setValue],
  );

  const handleRemovePrestacional = useCallback(() => {
    setSelectedCodigoPrestacional(null);
    setValue('codigoPrestacional', '', { shouldDirty: true });
  }, [setValue]);

  const createDiagnosis = useCallback(
    (concept: Concept) => ({
      certainty: 'PROVISIONAL',
      display: concept.display,
      diagnosis: {
        coded: concept.uuid,
      },
      patient: patientUuid,
      rank: 2,
    }),
    [patientUuid],
  );

  const handleAddDiagnosis = useCallback(
    (conceptDiagnosisToAdd: Concept, searchInputField: string) => {
      const newDiagnosis = createDiagnosis(conceptDiagnosisToAdd);
      if (searchInputField === 'primaryDiagnosisSearch') {
        newDiagnosis.rank = 1;
        setValue('primaryDiagnosisSearch', '');
        setSearchPrimaryResults([]);
        setSelectedPrimaryDiagnoses((selectedDiagnoses) => [...selectedDiagnoses, newDiagnosis]);
        clearErrors('primaryDiagnosisSearch');
      } else if (searchInputField === 'secondaryDiagnosisSearch') {
        setValue('secondaryDiagnosisSearch', '');
        setSearchSecondaryResults([]);
        setSelectedSecondaryDiagnoses((selectedDiagnoses) => [...selectedDiagnoses, newDiagnosis]);
      }
      setCombinedDiagnoses((combinedDiagnoses) => [...combinedDiagnoses, newDiagnosis]);
      // Default tipo = Presuntivo for every newly added diagnosis
      setDiagnosisTipos((prev) => ({ ...prev, [conceptDiagnosisToAdd.uuid]: diagnosisTypePresuntivoUuid }));
    },
    [createDiagnosis, setValue, clearErrors, diagnosisTypePresuntivoUuid],
  );

  const handleRemoveDiagnosis = useCallback(
    (diagnosisToRemove: Diagnosis, searchInputField: string) => {
      if (searchInputField === 'primaryInputSearch') {
        setSelectedPrimaryDiagnoses(
          selectedPrimaryDiagnoses.filter(
            (diagnosis) => diagnosis.diagnosis.coded !== diagnosisToRemove.diagnosis.coded,
          ),
        );
      } else if (searchInputField === 'secondaryInputSearch') {
        setSelectedSecondaryDiagnoses(
          selectedSecondaryDiagnoses.filter(
            (diagnosis) => diagnosis.diagnosis.coded !== diagnosisToRemove.diagnosis.coded,
          ),
        );
      }
      setCombinedDiagnoses(
        combinedDiagnoses.filter((diagnosis) => diagnosis.diagnosis.coded !== diagnosisToRemove.diagnosis.coded),
      );
      setDiagnosisTipos((prev) => {
        const next = { ...prev };
        delete next[diagnosisToRemove.diagnosis.coded];
        return next;
      });
    },
    [combinedDiagnoses, selectedPrimaryDiagnoses, selectedSecondaryDiagnoses],
  );

  const isDiagnosisNotSelected = (diagnosis: Concept) => {
    const isPrimaryDiagnosisSelected = selectedPrimaryDiagnoses.some(
      (selectedDiagnosis) => diagnosis.uuid === selectedDiagnosis.diagnosis.coded,
    );
    const isSecondaryDiagnosisSelected = selectedSecondaryDiagnoses.some(
      (selectedDiagnosis) => diagnosis.uuid === selectedDiagnosis.diagnosis.coded,
    );

    return !isPrimaryDiagnosisSelected && !isSecondaryDiagnosisSelected;
  };

  const showImageCaptureModal = useCallback(() => {
    const close = showModal('capture-photo-modal', {
      saveFile: (file: UploadedFile) => {
        if (file.capturedFromWebcam && !file.fileName.includes('.')) {
          file.fileName = `${file.fileName}.png`;
        }

        setValue('images', currentImages ? [...currentImages, file] : [file]);
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
    setValue('images', updatedImages);

    showSnackbar({
      title: t('imageRemoved', 'Image removed'),
      kind: 'success',
      isLowContrast: true,
    });
  };

  const onSubmit = useCallback(
    (data: VisitNotesFormData) => {
      const {
        noteDate,
        codigoPrestacional,
        chiefComplaint,
        illnessDuration,
        biologicalFunctions,
        subjective,
        objective,
        assessment,
        plan,
        auxiliaryExams,
        procedures,
        prescriptions,
        referral,
        nextAppointment,
        clinicalNote,
        images,
      } = data;

      if (isPrimaryDiagnosisRequired && !selectedPrimaryDiagnoses.length) {
        return;
      }

      let finalNoteDate = dayjs(noteDate);
      const now = new Date();
      if (finalNoteDate.diff(now, 'minute') <= 30) {
        finalNoteDate = null;
      }

      const buildTextObs = (conceptUuid: string, value?: string, formFieldPath?: string) => {
        const trimmedValue = value?.trim();
        if (!trimmedValue) {
          return null;
        }
        const existingObs = getEncounterObs(conceptUuid, formFieldPath);
        return {
          concept: { uuid: conceptUuid, display: '' },
          value: trimmedValue,
          ...(formFieldPath && { formFieldNamespace: 'visit-notes', formFieldPath }),
          ...(existingObs && { uuid: existingObs.uuid }),
        };
      };

      const structuredObsList = [
        buildTextObs(codigoPrestacionalConceptUuid, codigoPrestacional, 'codigo-prestacional'),
        buildTextObs(chiefComplaintConceptUuid, chiefComplaint),
        buildTextObs(illnessDurationConceptUuid, illnessDuration),
        buildTextObs(biologicalFunctionsConceptUuid, biologicalFunctions, 'biological-functions'),
        buildTextObs(soapSubjectiveConceptUuid, subjective),
        buildTextObs(soapObjectiveConceptUuid, objective),
        buildTextObs(soapAssessmentConceptUuid, assessment),
        buildTextObs(soapPlanConceptUuid, plan, 'soap-plan'),
        buildTextObs(labOrdersConceptUuid, auxiliaryExams),
        buildTextObs(proceduresConceptUuid, procedures, 'procedures'),
        buildTextObs(prescriptionsConceptUuid, prescriptions),
        buildTextObs(referralConceptUuid, referral),
        buildTextObs(nextAppointmentConceptUuid, nextAppointment),
      ].filter((obs): obs is NonNullable<ReturnType<typeof buildTextObs>> => Boolean(obs));

      // Persist the exact MINSA diagnosis type for each CIE-10 diagnosis.
      // This complements patientdiagnoses.certainty, which cannot represent
      // "Repetitivo" without losing information.
      const tipoObsList = combinedDiagnoses.map((dx) =>
        buildTipoDxObs(
          diagnosisTypeConceptUuid,
          dx.diagnosis.coded,
          diagnosisTipos[dx.diagnosis.coded] ?? diagnosisTypePresuntivoUuid,
        ),
      );

      const obsPayload = [
        ...(clinicalNote?.trim()
          ? [
              {
                concept: { uuid: encounterNoteTextConceptUuid, display: '' },
                value: clinicalNote.trim(),
                ...(getEncounterObs(encounterNoteTextConceptUuid) && {
                  uuid: getEncounterObs(encounterNoteTextConceptUuid).uuid,
                }),
              },
            ]
          : []),
        ...structuredObsList,
        ...tipoObsList,
      ];

      const visitNotePayload: VisitNotePayload = {
        encounterDatetime: finalNoteDate?.format(),
        form: formConceptUuid,
        patient: patientUuid,
        location: locationUuid,
        encounterProviders: [
          {
            encounterRole: clinicianEncounterRole,
            provider: providerUuid,
          },
        ],
        encounterType: encounterTypeUuid,
        obs: obsPayload,
        // Only attach the visit when creating a note. On edit, omitting `visit`
        // leaves the encounter's existing visit untouched.
        ...(!isEditing && visitUuid && { visit: visitUuid }),
      };

      const abortController = new AbortController();

      const savePromise = isEditing
        ? updateVisitNote(abortController, encounter.id, visitNotePayload)
        : saveVisitNote(abortController, visitNotePayload);

      savePromise
        .then((response) => {
          if (response.status === 201 || response.status === 200) {
            const encounterUuid = encounter?.id || response.data.uuid;

            // If editing, first delete existing diagnoses
            if (isEditing && encounter?.diagnoses?.length) {
              return Promise.all(
                encounter.diagnoses.map((diagnosis) => deletePatientDiagnosis(abortController, diagnosis.uuid)),
              ).then(() => encounterUuid);
            }

            return encounterUuid;
          }
        })
        .then((encounterUuid) => {
          return Promise.all(
            combinedDiagnoses.map((diagnosis) => {
              const tipoUuid = diagnosisTipos[diagnosis.diagnosis.coded] ?? diagnosisTypePresuntivoUuid;
              const diagnosesPayload: DiagnosisPayload = {
                encounter: encounterUuid,
                patient: patientUuid,
                condition: null,
                diagnosis: {
                  coded: diagnosis.diagnosis.coded,
                },
                certainty: getCertaintyForTipo(tipoUuid, diagnosisTypeDefinitivoUuid),
                rank: diagnosis.rank,
              };
              return savePatientDiagnosis(abortController, diagnosesPayload);
            }),
          );
        })
        .then(() => {
          if (images?.length) {
            return Promise.all(
              images.map((image) => {
                const imageToUpload: UploadedFile = {
                  base64Content: image.base64Content,
                  file: image.file,
                  fileName: image.fileName,
                  fileType: image.fileType,
                  fileDescription: image.fileDescription || '',
                };
                return createAttachment(patientUuid, imageToUpload);
              }),
            );
          } else {
            return [];
          }
        })
        .then(() => {
          // Invalidate encounter and notes data since we created a new encounter with notes
          // Also invalidate visit history table since the visit now has new encounters
          invalidateVisitAndEncounterData(globalMutate, patientUuid);
          mutateVisitNotes();

          if (images?.length) {
            mutateAttachments();
          }

          closeWorkspace({ discardUnsavedChanges: true });

          showSnackbar({
            isLowContrast: true,
            subtitle: t('visitNoteNowVisible', 'It is now visible on the Visits page'),
            kind: 'success',
            title: t('visitNoteSaved', 'Visit note saved'),
          });
        })
        .catch((err) => {
          createErrorHandler();

          showSnackbar({
            title: t('visitNoteSaveError', 'Error saving visit note'),
            kind: 'error',
            isLowContrast: false,
            subtitle: err?.responseBody?.error?.message ?? err.message,
          });
        });
    },
    [
      clinicianEncounterRole,
      chiefComplaintConceptUuid,
      closeWorkspace,
      combinedDiagnoses,
      biologicalFunctionsConceptUuid,
      codigoPrestacionalConceptUuid,
      diagnosisTipos,
      diagnosisTypeConceptUuid,
      diagnosisTypeDefinitivoUuid,
      diagnosisTypePresuntivoUuid,
      encounter?.diagnoses,
      encounter?.id,
      encounterNoteTextConceptUuid,
      encounterTypeUuid,
      formConceptUuid,
      getEncounterObs,
      globalMutate,
      illnessDurationConceptUuid,
      isEditing,
      isPrimaryDiagnosisRequired,
      labOrdersConceptUuid,
      locationUuid,
      mutateAttachments,
      mutateVisitNotes,
      nextAppointmentConceptUuid,
      patientUuid,
      prescriptionsConceptUuid,
      proceduresConceptUuid,
      providerUuid,
      referralConceptUuid,
      selectedPrimaryDiagnoses.length,
      soapAssessmentConceptUuid,
      soapObjectiveConceptUuid,
      soapPlanConceptUuid,
      soapSubjectiveConceptUuid,
      t,
      visitUuid,
    ],
  );

  const onError = () => undefined;

  const hasUserUnsavedChanges = Object.keys(dirtyFields).length > 0;

  return (
    <Workspace2 title={t('visitNoteWorkspaceTitle', 'Visit note')} hasUnsavedChanges={hasUserUnsavedChanges}>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit, onError)}>
        <ExtensionSlot name="visit-context-header-slot" state={{ patientUuid }} />

        {isTablet && (
          <Row className={styles.headerGridRow}>
            <ExtensionSlot name="visit-form-header-slot" className={styles.dataGridRow} state={memoizedState} />
          </Row>
        )}

        <div className={styles.formContainer}>
          <Stack gap={2}>
            {isTablet ? <h2 className={styles.heading}>{t('addVisitNote', 'Add a visit note')}</h2> : null}
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>{t('date', 'Date')}</span>
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
                        labelText={t('visitDate', 'Visit date')}
                        maxDate={new Date()}
                      />
                    </ResponsiveWrapper>
                  )}
                />
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>{t('responsibleProvider', 'Responsible provider')}</span>
              </Column>
              <Column sm={3}>
                <Tile>
                  <p>
                    <strong>{registeredProviderName ?? t('providerNotConfigured', 'Provider not configured')}</strong>
                  </p>
                  <p>
                    {t('professionalRegistration', 'Professional registration')}:{' '}
                    {registeredProviderCode ??
                      t('professionalRegistrationMissing', 'Not registered in provider profile')}
                  </p>
                  <p>
                    {t(
                      'providerSignatureSource',
                      'Signature, seal and registration are resolved from the provider profile that records this encounter.',
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
                      onRemove={() => handleRemoveDiagnosis(diagnosis, 'primaryInputSearch')}
                      t={t}
                    />
                    <div className={styles.tipoSelector}>
                      <RadioButtonGroup
                        legendText=""
                        name={`tipo-primary-${index}`}
                        valueSelected={diagnosisTipos[diagnosis.diagnosis.coded] ?? diagnosisTypePresuntivoUuid}
                        onChange={(value) =>
                          value != null &&
                          setDiagnosisTipos((prev) => ({ ...prev, [diagnosis.diagnosis.coded]: String(value) }))
                        }
                        orientation="horizontal"
                      >
                        <RadioButton
                          id={`tipo-primary-${index}-p`}
                          labelText={t('presuntivo', 'P - Presuntivo')}
                          value={diagnosisTypePresuntivoUuid}
                        />
                        <RadioButton
                          id={`tipo-primary-${index}-d`}
                          labelText={t('definitivo', 'D - Definitivo')}
                          value={diagnosisTypeDefinitivoUuid}
                        />
                        <RadioButton
                          id={`tipo-primary-${index}-r`}
                          labelText={t('repetitivo', 'R - Repetido')}
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
                      onRemove={() => handleRemoveDiagnosis(diagnosis, 'secondaryInputSearch')}
                      t={t}
                    />
                    <div className={styles.tipoSelector}>
                      <RadioButtonGroup
                        legendText=""
                        name={`tipo-secondary-${index}`}
                        valueSelected={diagnosisTipos[diagnosis.diagnosis.coded] ?? diagnosisTypePresuntivoUuid}
                        onChange={(value) =>
                          value != null &&
                          setDiagnosisTipos((prev) => ({ ...prev, [diagnosis.diagnosis.coded]: String(value) }))
                        }
                        orientation="horizontal"
                      >
                        <RadioButton
                          id={`tipo-secondary-${index}-p`}
                          labelText={t('presuntivo', 'P - Presuntivo')}
                          value={diagnosisTypePresuntivoUuid}
                        />
                        <RadioButton
                          id={`tipo-secondary-${index}-d`}
                          labelText={t('definitivo', 'D - Definitivo')}
                          value={diagnosisTypeDefinitivoUuid}
                        />
                        <RadioButton
                          id={`tipo-secondary-${index}-r`}
                          labelText={t('repetitivo', 'R - Repetido')}
                          value={diagnosisTypeRepetitivoUuid}
                        />
                      </RadioButtonGroup>
                    </div>
                  </div>
                ))}
              {!selectedPrimaryDiagnoses?.length && !selectedSecondaryDiagnoses?.length && (
                <span>{t('emptyDiagnosisText', 'No diagnosis selected — Enter a diagnosis below')}</span>
              )}
            </div>
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>
                  <RequiredFieldLabel
                    label={t('primaryDiagnosisRequiredLabel', 'Diagnóstico principal (Obligatorio)')}
                  />
                </span>
              </Column>
              <Column sm={3}>
                <FormGroup legendText={t('searchForPrimaryDiagnosis', 'Search for a primary diagnosis')}>
                  <DiagnosisSearch
                    name="primaryDiagnosisSearch"
                    control={control}
                    labelText={t('enterPrimaryDiagnoses', 'Enter Primary diagnoses')}
                    placeholder={t('primaryDiagnosisInputPlaceholder', 'Choose a primary diagnosis')}
                    handleSearch={handleSearch}
                    error={errors?.primaryDiagnosisSearch}
                    setIsSearching={setIsSearching}
                  />
                  {error ? (
                    <InlineNotification
                      className={styles.errorNotification}
                      lowContrast
                      title={t('error', 'Error')}
                      subtitle={t('errorFetchingConcepts', 'There was a problem fetching concepts') + '.'}
                      onClose={() => setError(null)}
                    />
                  ) : null}
                  <DiagnosesDisplay
                    fieldName={'primaryDiagnosisSearch'}
                    isDiagnosisNotSelected={isDiagnosisNotSelected}
                    isLoading={isLoadingPrimaryDiagnoses}
                    isSearching={isSearching}
                    onAddDiagnosis={handleAddDiagnosis}
                    searchResults={searchPrimaryResults}
                    t={t}
                    value={watch('primaryDiagnosisSearch')}
                  />
                </FormGroup>
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>{t('secondaryDiagnosis', 'Secondary diagnosis')}</span>
              </Column>
              <Column sm={3}>
                <FormGroup legendText={t('searchForSecondaryDiagnosis', 'Search for a secondary diagnosis')}>
                  <DiagnosisSearch
                    name="secondaryDiagnosisSearch"
                    control={control}
                    labelText={t('enterSecondaryDiagnoses', 'Enter Secondary diagnoses')}
                    placeholder={t('secondaryDiagnosisInputPlaceholder', 'Choose a secondary diagnosis')}
                    handleSearch={handleSearch}
                    setIsSearching={setIsSearching}
                  />
                  {error ? (
                    <InlineNotification
                      className={styles.errorNotification}
                      lowContrast
                      title={t('error', 'Error')}
                      subtitle={t('errorFetchingConcepts', 'There was a problem fetching concepts') + '.'}
                      onClose={() => setError(null)}
                    />
                  ) : null}
                  <DiagnosesDisplay
                    fieldName={'secondaryDiagnosisSearch'}
                    isDiagnosisNotSelected={isDiagnosisNotSelected}
                    isLoading={isLoadingSecondaryDiagnoses}
                    isSearching={isSearching}
                    onAddDiagnosis={handleAddDiagnosis}
                    searchResults={searchSecondaryResults}
                    t={t}
                    value={watch('secondaryDiagnosisSearch')}
                  />
                </FormGroup>
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>
                  <RequiredFieldLabel
                    label={t('codigoPrestacionalRequiredLabel', 'Código Prestacional (Obligatorio)')}
                  />
                </span>
              </Column>
              <Column sm={3}>
                <PrestacionalSearch
                  error={error}
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
                      dismissTooltipLabel={t('clearFilter', 'Clear filter')}
                      onClose={handleRemovePrestacional}
                      tagTitle={selectedCodigoPrestacional.display}
                      text={selectedCodigoPrestacional.display}
                      title={t('clearFilter', 'Clear filter')}
                      type="cyan"
                    />
                  </div>
                ) : watch('codigoPrestacional') && !codigoPrestacionalSearchValue ? (
                  <div className={styles.prestacionalTagContainer}>
                    <DismissibleTag
                      className={styles.tag}
                      dismissTooltipLabel={t('clearFilter', 'Clear filter')}
                      onClose={handleRemovePrestacional}
                      tagTitle={watch('codigoPrestacional')}
                      text={watch('codigoPrestacional')}
                      title={t('clearFilter', 'Clear filter')}
                      type="gray"
                    />
                  </div>
                ) : null}
              </Column>
            </Row>
            <Row className={styles.row}>
              <Column sm={4}>
                <h3>{t('clinicalSummary', 'Clinical summary')}</h3>
              </Column>
            </Row>
            <VisitNoteTextAreaRow
              control={control}
              name="chiefComplaint"
              labelText={t('chiefComplaint', 'Chief complaint')}
              placeholder={t('chiefComplaintPlaceholder', 'Main reason for the consultation')}
            />
            <VisitNoteTextAreaRow
              control={control}
              name="illnessDuration"
              labelText={t('illnessDuration', 'Illness duration')}
              placeholder={t('illnessDurationPlaceholder', 'For example: 3 days, 2 weeks')}
              rows={2}
            />
            <VisitNoteTextAreaRow
              control={control}
              name="biologicalFunctions"
              labelText={t('biologicalFunctions', 'Biological functions')}
              placeholder={t('biologicalFunctionsPlaceholder', 'Appetite, thirst, sleep, mood, urine, bowel movements')}
            />
            <Row className={styles.row}>
              <Column sm={4}>
                <h3>{t('soapSection', 'SOAP assessment')}</h3>
              </Column>
            </Row>
            <VisitNoteTextAreaRow
              control={control}
              name="subjective"
              labelText={t('subjective', 'Subjective')}
              placeholder={t('subjectivePlaceholder', 'Symptoms and relevant illness story')}
            />
            <VisitNoteTextAreaRow
              control={control}
              name="objective"
              labelText={t('objective', 'Objective / physical exam')}
              placeholder={t('objectivePlaceholder', 'Physical exam, vital findings and objective data')}
            />
            <VisitNoteTextAreaRow
              control={control}
              name="assessment"
              labelText={t('assessment', 'Assessment')}
              placeholder={t('assessmentPlaceholder', 'Clinical impression and interpretation of findings')}
            />
            <VisitNoteTextAreaRow
              control={control}
              name="plan"
              labelText={t('plan', 'Treatment plan')}
              placeholder={t('planPlaceholder', 'Therapeutic plan, indications and follow-up')}
            />
            <Row className={styles.row}>
              <Column sm={4}>
                <h3>{t('workPlan', 'Orders and continuity of care')}</h3>
              </Column>
            </Row>
            <VisitNoteTextAreaRow
              control={control}
              name="auxiliaryExams"
              labelText={t('auxiliaryExams', 'Auxiliary exams')}
              placeholder={t('auxiliaryExamsPlaceholder', 'Requested or reviewed lab and imaging exams')}
            />
            <VisitNoteTextAreaRow
              control={control}
              name="procedures"
              labelText={t('procedures', 'Procedures')}
              placeholder={t('proceduresPlaceholder', 'Procedures performed or requested')}
            />
            <VisitNoteTextAreaRow
              control={control}
              name="prescriptions"
              labelText={t('prescriptions', 'Prescriptions')}
              placeholder={t('prescriptionsPlaceholder', 'Medication and dosage indications')}
            />
            <VisitNoteTextAreaRow
              control={control}
              name="referral"
              labelText={t('referral', 'Referral / interconsultation')}
              placeholder={t('referralPlaceholder', 'Destination service, reason and priority')}
            />
            <VisitNoteTextAreaRow
              control={control}
              name="nextAppointment"
              labelText={t('nextAppointment', 'Next appointment')}
              placeholder={t('nextAppointmentPlaceholder', 'Date or follow-up instruction')}
              rows={2}
            />
            <Row className={styles.row}>
              <Column sm={1}>
                <span className={styles.columnLabel}>{t('note', 'Note')}</span>
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
                        labelText={t('clinicalNoteLabel', 'Additional notes')}
                        placeholder={t('clinicalNotePlaceholder', 'Add observations that do not fit the fields above')}
                        value={value ?? ''}
                        onBlur={onBlur}
                        onChange={(event) => {
                          onChange(event);
                          const textareaLineHeight = 24; // This is the default line height for Carbon's TextArea component
                          const newRows = Math.ceil(event.target.scrollHeight / textareaLineHeight);
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
                <span className={styles.columnLabel}>{t('image', 'Image')}</span>
              </Column>
              <Column sm={3}>
                <FormGroup legendText="">
                  <p className={styles.imgUploadHelperText}>
                    {t('imageUploadHelperText', "Upload images or use this device's camera to capture images")}
                  </p>
                  <Button
                    className={styles.uploadButton}
                    kind={isTablet ? 'ghost' : 'tertiary'}
                    onClick={showImageCaptureModal}
                    renderIcon={(props) => <Add size={16} {...props} />}
                  >
                    {t('addImage', 'Add image')}
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
                        <Button kind="ghost" className={styles.removeButton} onClick={() => handleRemoveImage(index)}>
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
        <ButtonSet className={classnames({ [styles.tablet]: isTablet, [styles.desktop]: !isTablet })}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('discard', 'Discard')}
          </Button>
          <Button
            className={styles.button}
            kind="primary"
            onClick={() => handleSubmit}
            disabled={!hasUserUnsavedChanges || isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <InlineLoading description={t('saving', 'Saving') + '...'} />
            ) : (
              <span>{t('saveAndClose', 'Save and close')}</span>
            )}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

function VisitNoteTextAreaRow({
  control,
  inputLabelText,
  labelText,
  name,
  placeholder,
  rows = 3,
}: VisitNoteTextAreaRowProps) {
  return (
    <Row className={styles.row}>
      <Column sm={1}>
        <span className={styles.columnLabel}>{labelText}</span>
      </Column>
      <Column sm={3}>
        <Controller
          name={name}
          control={control}
          render={({ field: { onChange, onBlur, value } }) => (
            <ResponsiveWrapper>
              <TextArea
                id={name}
                rows={rows}
                labelText={inputLabelText ?? labelText}
                placeholder={placeholder}
                value={value ?? ''}
                onBlur={onBlur}
                onChange={onChange}
              />
            </ResponsiveWrapper>
          )}
        />
      </Column>
    </Row>
  );
}

function SelectedDiagnosis({ diagnosis, kind, onRemove, t }: SelectedDiagnosisProps) {
  const formattedDiagnosis = formatDiagnosisDisplay(diagnosis);

  return (
    <div
      className={classnames(styles.selectedDiagnosis, {
        [styles.selectedPrimaryDiagnosis]: kind === 'primary',
        [styles.selectedSecondaryDiagnosis]: kind === 'secondary',
      })}
      title={formattedDiagnosis}
    >
      <span className={styles.selectedDiagnosisText}>{formattedDiagnosis}</span>
      <button
        type="button"
        className={styles.removeDiagnosisButton}
        onClick={onRemove}
        aria-label={t('clearFilter', 'Clear filter')}
        title={t('clearFilter', 'Clear filter')}
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
  const isTablet = useLayoutType() === 'tablet';
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
              size={isTablet ? 'lg' : 'md'}
              id={name}
              labelText={labelText}
              className={error && styles.diagnoserrorOutline}
              placeholder={placeholder}
              renderIcon={error && ((props) => <WarningFilled fill="red" {...props} />)}
              onChange={(e) => {
                setIsSearching(true);
                onChange(e);
                handleSearch(name);
              }}
              value={value ?? ''}
              onBlur={onBlur}
            />
          </ResponsiveWrapper>
          {fieldState?.error?.message && <p className={styles.errorMessage}>{fieldState?.error?.message}</p>}
        </>
      )}
    />
  );
}

function PrestacionalSearch({
  error,
  isLoading,
  onAddPrestacional,
  onSearch,
  searchResults,
  selectedConcept,
  t,
  value,
}: PrestacionalSearchProps) {
  const isTablet = useLayoutType() === 'tablet';

  return (
    <>
      <ResponsiveWrapper>
        <Search
          size={isTablet ? 'lg' : 'md'}
          id="codigoPrestacionalSearch"
          labelText={t('codigoPrestacionalInputLabel', 'Indique el Código Prestacional')}
          placeholder={t('codigoPrestacionalPlaceholder', 'Buscar Código Prestacional')}
          disabled={Boolean(selectedConcept)}
          renderIcon={error && ((props) => <WarningFilled fill="red" {...props} />)}
          onChange={(event) => onSearch(event.target.value)}
          value={value}
        />
      </ResponsiveWrapper>
      {isLoading ? <Loader /> : null}
      {!isLoading && value && searchResults?.length > 0 ? (
        <ul className={styles.diagnosisList}>
          {searchResults.map((prestacional) => (
            <li className={styles.diagnosis} key={prestacional.uuid}>
              <button
                type="button"
                className={classnames(styles.diagnosisButton, styles.diagnosisButtonSingle)}
                onClick={() => onAddPrestacional(prestacional)}
              >
                <span className={styles.diagnosisName}>{prestacional.display}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!isLoading && value && searchResults?.length === 0 ? (
        <ResponsiveWrapper>
          <Tile className={styles.emptyResults}>
            <span>
              {t('noMatchingPrestacionales', 'No se encontraron códigos prestacionales coincidentes')}{' '}
              <strong>"{value}"</strong>
            </span>
          </Tile>
        </ResponsiveWrapper>
      ) : null}
      {error ? (
        <InlineNotification
          className={styles.errorNotification}
          lowContrast
          title={t('error', 'Error')}
          subtitle={t('errorFetchingConcepts', 'There was a problem fetching concepts') + '.'}
        />
      ) : null}
    </>
  );
}

function RequiredFieldLabel({ label }: { label: string }) {
  const { t } = useTranslation();

  return (
    <>
      {label}
      <span title={t('required', 'Required')} className={styles.required}>
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
        {searchResults.map((diagnosis, index) => {
          if (isDiagnosisNotSelected(diagnosis)) {
            const formattedDiagnosis = formatDiagnosisDisplay(diagnosis);
            const [code, ...nameParts] = formattedDiagnosis.split(' - ');
            const diagnosisName = nameParts.join(' - ');

            return (
              <li className={styles.diagnosis} key={index}>
                <button
                  type="button"
                  className={styles.diagnosisButton}
                  onClick={() => onAddDiagnosis(diagnosis, fieldName)}
                >
                  {diagnosisName ? (
                    <>
                      <span className={styles.diagnosisCode}>{code}</span>
                      <span className={styles.diagnosisSeparator}>-</span>
                      <span className={styles.diagnosisName}>{diagnosisName}</span>
                    </>
                  ) : (
                    <span className={styles.diagnosisName}>{formattedDiagnosis}</span>
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
            {t('noMatchingDiagnoses', 'No diagnoses found matching')} <strong>"{value}"</strong>
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

export default VisitNotesForm;
