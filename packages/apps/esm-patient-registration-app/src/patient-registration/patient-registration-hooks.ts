import {
  type FetchResponse,
  getSynchronizationItems,
  type OpenmrsResource,
  openmrsFetch,
  restBaseUrl,
  useConfig,
  usePatient,
} from '@openmrs/esm-framework';
import { calculatePatientAgeInMonths, isValidCalendarDate, MAX_PATIENT_AGE_YEARS } from '@openmrs/esm-utils';
import dayjs from 'dayjs';
import camelCase from 'lodash-es/camelCase';
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { v4 } from 'uuid';

import { type RegistrationConfig } from '../config-schema';
import { patientRegistration } from '../constants';
import {
  type Encounter,
  type FormValues,
  type PatientIdentifierResponse,
  type PatientRegistration,
  type PatientUuidMapType,
  type PersonAttributeResponse,
} from './patient-registration.types';
import {
  getAddressFieldValuesFromFhirPatient,
  getFormValuesFromFhirPatient,
  getPatientUuidMapFromFhirPatient,
  getPhonePersonAttributeValueFromFhirPatient,
  latestFirstEncounter,
} from './patient-registration-utils';
import { useInitialPatientRelationships } from './section/patient-relationships/relationships.resource';

interface DeathInfoResults {
  uuid: string;
  display: string;
  causeOfDeath: OpenmrsResource | null;
  dead: boolean;
  deathDate: string;
  causeOfDeathNonCoded: string | null;
}

export interface InitialPatientDataState {
  error?: Error;
  hydratedPatientUuid?: string;
  isLoading: boolean;
  isNewPatient?: boolean;
  queuedRegistration?: PatientRegistration;
}

function parsePartialFhirBirthdate(birthdate: string) {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(birthdate);
  if (!match) {
    return null;
  }

  const parsedBirthdate = {
    year: Number(match[1]),
    month: match[2] ? Number(match[2]) : 1,
    day: match[3] ? Number(match[3]) : 1,
  };
  return isValidCalendarDate(parsedBirthdate) ? parsedBirthdate : null;
}

const emptyRecord: Record<string, unknown> = {};
const emptyPatientUuidMap: PatientUuidMapType = {};

interface QueuedPatientRegistrationLookup {
  error?: Error;
  isLoading: boolean;
  patientUuid: string;
  registration?: PatientRegistration;
}

function useQueuedPatientRegistration(patientUuid: string): QueuedPatientRegistrationLookup {
  const [lookup, setLookup] = useState<QueuedPatientRegistrationLookup>(() => ({
    isLoading: !!patientUuid,
    patientUuid,
  }));

  useEffect(() => {
    let cancelled = false;

    if (!patientUuid) {
      setLookup({ isLoading: false, patientUuid });
      return;
    }

    setLookup({ isLoading: true, patientUuid });
    getPatientRegistration(patientUuid)
      .then((registration) => {
        if (!cancelled) {
          setLookup({ isLoading: false, patientUuid, registration });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLookup({
            error: error instanceof Error ? error : new Error(String(error)),
            isLoading: false,
            patientUuid,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientUuid]);

  return lookup.patientUuid === patientUuid ? lookup : { isLoading: !!patientUuid, patientUuid };
}

export function createInitialFormValues(): FormValues {
  return {
    patientUuid: v4(),
    givenName: '',
    middleName: '',
    familyName: '',
    familyName2: '',
    additionalGivenName: '',
    additionalMiddleName: '',
    additionalFamilyName: '',
    additionalFamilyName2: '',
    addNameInLocalLanguage: false,
    gender: '',
    birthdate: null,
    yearsEstimated: 0,
    monthsEstimated: 0,
    birthdateEstimated: false,
    telephoneNumber: '',
    isDead: false,
    deathDate: undefined,
    deathTime: undefined,
    deathTimeFormat: 'AM',
    deathCause: '',
    nonCodedCauseOfDeath: '',
    relationships: [],
    identifiers: {},
    address: {},
    birthAddress: {},
    attributes: {},
    obs: {},
  };
}

export function mapEncounterObservations(obs: Encounter['obs'] | null | undefined): Record<string, string> {
  return (Array.isArray(obs) ? obs : []).reduce<Record<string, string>>((observations, { concept, value }) => {
    const conceptUuid = typeof concept === 'string' ? concept : concept?.uuid;
    const observationValue = typeof value === 'object' ? value?.uuid : value;

    if (conceptUuid && observationValue != null) {
      observations[conceptUuid] = String(observationValue);
    }

    return observations;
  }, {});
}

export function useInitialFormValues(
  patientUuid: string,
): [FormValues, Dispatch<SetStateAction<FormValues>>, InitialPatientDataState] {
  const { freeTextFieldConceptUuid } = useConfig<RegistrationConfig>();
  const { error: patientError, isLoading: isLoadingPatientToEdit, patient: patientToEdit } = usePatient(patientUuid);
  const {
    error: queuedRegistrationError,
    isLoading: isLoadingQueuedRegistration,
    registration: queuedPatientRegistration,
  } = useQueuedPatientRegistration(patientUuid);
  const shouldLoadServerSupplementaryData =
    !!patientUuid && !isLoadingQueuedRegistration && !queuedPatientRegistration && patientToEdit?.id === patientUuid;
  const serverPatientUuid = shouldLoadServerSupplementaryData ? patientUuid : '';
  const {
    data: deathInfo,
    error: deathInfoError,
    isLoading: isLoadingDeathInfo,
  } = useInitialPersonDeathInfo(serverPatientUuid);
  const {
    data: attributes,
    error: attributesError,
    isLoading: isLoadingAttributes,
  } = useInitialPersonAttributes(serverPatientUuid);
  const {
    data: identifiers,
    error: identifiersError,
    isLoading: isLoadingIdentifiers,
  } = useInitialPatientIdentifiers(serverPatientUuid);
  const {
    data: relationships,
    error: relationshipsError,
    isLoading: isLoadingRelationships,
  } = useInitialPatientRelationships(serverPatientUuid);
  const {
    data: encounters,
    error: encountersError,
    isLoading: isLoadingEncounters,
  } = useInitialEncounters(serverPatientUuid, shouldLoadServerSupplementaryData ? patientToEdit : undefined);

  const [initialFormValues, setInitialFormValues] = useState<FormValues>(createInitialFormValues);
  const [hydrationError, setHydrationError] = useState<Error>();
  const [isHydrated, setIsHydrated] = useState(!patientUuid);
  const [isNewPatient, setIsNewPatient] = useState<boolean | undefined>(patientUuid ? undefined : true);
  const [queuedRegistration, setQueuedRegistration] = useState<PatientRegistration>();
  const hydratedPatientUuid = useRef<string>();
  const activePatientUuid = useRef(patientUuid);

  const supplementaryError =
    deathInfoError ?? attributesError ?? identifiersError ?? relationshipsError ?? encountersError;
  const isLoadingSupplementaryData =
    isLoadingDeathInfo || isLoadingAttributes || isLoadingIdentifiers || isLoadingRelationships || isLoadingEncounters;

  useEffect(() => {
    if (activePatientUuid.current === patientUuid) {
      return;
    }

    activePatientUuid.current = patientUuid;
    hydratedPatientUuid.current = undefined;
    setInitialFormValues(createInitialFormValues());
    setHydrationError(undefined);
    setIsHydrated(!patientUuid);
    setIsNewPatient(patientUuid ? undefined : true);
    setQueuedRegistration(undefined);
  }, [patientUuid]);

  useEffect(() => {
    if (
      !patientUuid ||
      hydratedPatientUuid.current === patientUuid ||
      isLoadingQueuedRegistration ||
      queuedPatientRegistration ||
      !patientToEdit ||
      patientToEdit.id !== patientUuid
    ) {
      return;
    }

    if (isLoadingPatientToEdit || isLoadingSupplementaryData) {
      return;
    }

    if (supplementaryError) {
      setHydrationError(supplementaryError);
      return;
    }

    const personAttributes = Object.fromEntries(
      attributes.map((attribute) => [
        attribute.attributeType.uuid,
        attribute.attributeType.format === 'org.openmrs.Concept' && typeof attribute.value === 'object'
          ? (attribute.value?.uuid ?? '')
          : String(attribute.value ?? ''),
      ]),
    );
    const birthDateValue = patientToEdit.birthDate;
    const hasBirthdate = typeof birthDateValue === 'string' && birthDateValue.length > 0;
    const birthdateEstimated = hasBirthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDateValue);
    const estimatedMonthsAvailable = hasBirthdate && birthDateValue.split('-').length > 1;
    const estimatedBirthdate = birthdateEstimated ? parsePartialFhirBirthdate(birthDateValue) : null;
    const calculatedAgeInMonths = estimatedBirthdate ? calculatePatientAgeInMonths(estimatedBirthdate) : null;
    const estimatedAgeInMonths =
      calculatedAgeInMonths != null ? Math.min(calculatedAgeInMonths, MAX_PATIENT_AGE_YEARS * 12) : null;
    const yearsEstimated = estimatedAgeInMonths != null ? Math.floor(estimatedAgeInMonths / 12) : 0;
    const monthsEstimated =
      estimatedMonthsAvailable && estimatedAgeInMonths != null ? estimatedAgeInMonths % 12 : 0;
    const deathDatetime = deathInfo?.dead && deathInfo.deathDate ? new Date(deathInfo.deathDate) : undefined;

    setInitialFormValues({
      ...createInitialFormValues(),
      ...getFormValuesFromFhirPatient(patientToEdit),
      address: getAddressFieldValuesFromFhirPatient(patientToEdit),
      birthAddress: getAddressFieldValuesFromFhirPatient(patientToEdit, 'birth'),
      ...getPhonePersonAttributeValueFromFhirPatient(patientToEdit),
      birthdateEstimated,
      yearsEstimated,
      monthsEstimated,
      isDead: !!deathInfo?.dead,
      deathDate: deathDatetime,
      deathTime: deathDatetime ? dayjs(deathDatetime).format('hh:mm') : undefined,
      deathTimeFormat: deathDatetime && dayjs(deathDatetime).hour() >= 12 ? 'PM' : 'AM',
      deathCause: deathInfo?.causeOfDeathNonCoded ? freeTextFieldConceptUuid : (deathInfo?.causeOfDeath?.uuid ?? ''),
      nonCodedCauseOfDeath: deathInfo?.causeOfDeathNonCoded ?? '',
      relationships,
      identifiers,
      attributes: personAttributes,
      obs: encounters,
    });
    hydratedPatientUuid.current = patientUuid;
    setHydrationError(undefined);
    setIsNewPatient(false);
    setQueuedRegistration(undefined);
    setIsHydrated(true);
  }, [
    attributes,
    deathInfo,
    encounters,
    freeTextFieldConceptUuid,
    identifiers,
    isLoadingPatientToEdit,
    isLoadingSupplementaryData,
    isLoadingQueuedRegistration,
    patientToEdit,
    patientUuid,
    queuedPatientRegistration,
    relationships,
    supplementaryError,
  ]);

  useEffect(() => {
    if (!patientUuid || !queuedPatientRegistration || hydratedPatientUuid.current === patientUuid) {
      return;
    }

    const queuedValues = queuedPatientRegistration._patientRegistrationData?.formValues;
    if (!queuedValues) {
      setHydrationError(new Error(`No se encontraron datos del paciente ${patientUuid} para editar.`));
      return;
    }

    setInitialFormValues(queuedValues);
    hydratedPatientUuid.current = patientUuid;
    setHydrationError(undefined);
    setIsNewPatient(queuedPatientRegistration._patientRegistrationData.isNewPatient);
    setQueuedRegistration(queuedPatientRegistration);
    setIsHydrated(true);
  }, [patientUuid, queuedPatientRegistration]);

  useEffect(() => {
    if (
      !patientUuid ||
      isLoadingPatientToEdit ||
      isLoadingQueuedRegistration ||
      patientToEdit ||
      queuedPatientRegistration ||
      hydratedPatientUuid.current === patientUuid
    ) {
      return;
    }

    setHydrationError(
      patientError ??
        queuedRegistrationError ??
        new Error(`No se encontraron datos del paciente ${patientUuid} para editar.`),
    );
  }, [
    isLoadingPatientToEdit,
    isLoadingQueuedRegistration,
    patientError,
    patientToEdit,
    patientUuid,
    queuedPatientRegistration,
    queuedRegistrationError,
  ]);

  return [
    initialFormValues,
    setInitialFormValues,
    {
      error: hydrationError,
      hydratedPatientUuid: hydratedPatientUuid.current,
      isLoading: !!patientUuid && !isHydrated && !hydrationError,
      isNewPatient,
      queuedRegistration,
    },
  ];
}

export function useInitialAddressFieldValues(
  patientUuid: string,
  fallback: Record<string, unknown> = emptyRecord,
): [Record<string, unknown>, Dispatch<SetStateAction<Record<string, unknown>>>, InitialPatientDataState] {
  const { error: patientError, isLoading: isLoadingPatient, patient } = usePatient(patientUuid);
  const {
    error: queuedRegistrationError,
    isLoading: isLoadingQueuedRegistration,
    registration: queuedPatientRegistration,
  } = useQueuedPatientRegistration(patientUuid);
  const [initialAddressFieldValues, setInitialAddressFieldValues] = useState<Record<string, unknown>>(fallback);
  const [hydrationError, setHydrationError] = useState<Error>();
  const [isHydrated, setIsHydrated] = useState(!patientUuid);
  const hydratedPatientUuid = useRef<string>();
  const activePatientUuid = useRef(patientUuid);

  useEffect(() => {
    if (activePatientUuid.current === patientUuid) {
      return;
    }

    activePatientUuid.current = patientUuid;
    hydratedPatientUuid.current = undefined;
    setInitialAddressFieldValues(fallback);
    setHydrationError(undefined);
    setIsHydrated(!patientUuid);
  }, [fallback, patientUuid]);

  useEffect(() => {
    if (!patientUuid || hydratedPatientUuid.current === patientUuid || isLoadingQueuedRegistration) {
      return;
    }

    if (queuedPatientRegistration) {
      setInitialAddressFieldValues(
        queuedPatientRegistration._patientRegistrationData?.initialAddressFieldValues ?? fallback,
      );
      hydratedPatientUuid.current = patientUuid;
      setHydrationError(undefined);
      setIsHydrated(true);
      return;
    }

    if (isLoadingPatient) {
      return;
    }

    if (patient && patient.id === patientUuid) {
      setInitialAddressFieldValues({
        ...fallback,
        address: getAddressFieldValuesFromFhirPatient(patient),
        birthAddress: getAddressFieldValuesFromFhirPatient(patient, 'birth'),
      });
      hydratedPatientUuid.current = patientUuid;
      setHydrationError(undefined);
      setIsHydrated(true);
      return;
    }

    if (patient) {
      return;
    }

    setHydrationError(
      patientError ??
        queuedRegistrationError ??
        new Error(`No se encontraron datos del paciente ${patientUuid} para editar.`),
    );
  }, [
    fallback,
    isLoadingPatient,
    isLoadingQueuedRegistration,
    patient,
    patientError,
    patientUuid,
    queuedPatientRegistration,
    queuedRegistrationError,
  ]);

  return [
    initialAddressFieldValues,
    setInitialAddressFieldValues,
    {
      error: hydrationError,
      hydratedPatientUuid: hydratedPatientUuid.current,
      isLoading: !!patientUuid && !isHydrated && !hydrationError,
    },
  ];
}

export function usePatientUuidMap(
  patientUuid: string,
  fallback: PatientUuidMapType = emptyPatientUuidMap,
): [PatientUuidMapType, Dispatch<SetStateAction<PatientUuidMapType>>, InitialPatientDataState] {
  const { error: patientError, isLoading: isLoadingPatientToEdit, patient: patientToEdit } = usePatient(patientUuid);
  const {
    error: queuedRegistrationError,
    isLoading: isLoadingQueuedRegistration,
    registration: queuedPatientRegistration,
  } = useQueuedPatientRegistration(patientUuid);
  const shouldLoadServerAttributes =
    !!patientUuid && !isLoadingQueuedRegistration && !queuedPatientRegistration && patientToEdit?.id === patientUuid;
  const {
    data: attributes,
    error: attributesError,
    isLoading: isLoadingAttributes,
  } = useInitialPersonAttributes(shouldLoadServerAttributes ? patientUuid : '');
  const [patientUuidMap, setPatientUuidMap] = useState(fallback);
  const [hydrationError, setHydrationError] = useState<Error>();
  const [isHydrated, setIsHydrated] = useState(!patientUuid);
  const hydratedPatientUuid = useRef<string>();
  const activePatientUuid = useRef(patientUuid);

  useEffect(() => {
    if (activePatientUuid.current === patientUuid) {
      return;
    }

    activePatientUuid.current = patientUuid;
    hydratedPatientUuid.current = undefined;
    setPatientUuidMap(fallback);
    setHydrationError(undefined);
    setIsHydrated(!patientUuid);
  }, [fallback, patientUuid]);

  useEffect(() => {
    if (!patientUuid || hydratedPatientUuid.current === patientUuid || isLoadingQueuedRegistration) {
      return;
    }

    if (queuedPatientRegistration) {
      setPatientUuidMap(queuedPatientRegistration._patientRegistrationData?.patientUuidMap ?? fallback);
      hydratedPatientUuid.current = patientUuid;
      setHydrationError(undefined);
      setIsHydrated(true);
      return;
    }

    if (isLoadingPatientToEdit) {
      return;
    }

    if (patientToEdit?.id === patientUuid && isLoadingAttributes) {
      return;
    }

    if (patientToEdit?.id === patientUuid && attributesError) {
      setHydrationError(attributesError);
      return;
    }

    if (patientToEdit?.id === patientUuid) {
      setPatientUuidMap({
        ...fallback,
        ...getPatientUuidMapFromFhirPatient(patientToEdit),
        ...getPatientAttributeUuidMapForPatient(attributes),
      });
      hydratedPatientUuid.current = patientUuid;
      setHydrationError(undefined);
      setIsHydrated(true);
      return;
    }

    if (patientToEdit) {
      return;
    }

    setHydrationError(
      patientError ??
        queuedRegistrationError ??
        new Error(`No se encontraron datos del paciente ${patientUuid} para editar.`),
    );
  }, [
    attributes,
    attributesError,
    fallback,
    isLoadingAttributes,
    isLoadingPatientToEdit,
    isLoadingQueuedRegistration,
    patientError,
    patientToEdit,
    patientUuid,
    queuedPatientRegistration,
    queuedRegistrationError,
  ]);

  return [
    patientUuidMap,
    setPatientUuidMap,
    {
      error: hydrationError,
      hydratedPatientUuid: hydratedPatientUuid.current,
      isLoading: !!patientUuid && !isHydrated && !hydrationError,
    },
  ];
}

async function getPatientRegistration(patientUuid: string) {
  const items = await getSynchronizationItems<PatientRegistration>(patientRegistration);
  return items.find((item) => item?._patientRegistrationData?.formValues?.patientUuid === patientUuid);
}

export function useInitialPatientIdentifiers(patientUuid: string): {
  data: FormValues['identifiers'];
  error?: Error;
  isLoading: boolean;
} {
  const shouldFetch = !!patientUuid;

  const { data, error, isLoading } = useSWR<FetchResponse<{ results: Array<PatientIdentifierResponse> }>, Error>(
    shouldFetch
      ? `${restBaseUrl}/patient/${patientUuid}/identifier?v=custom:(uuid,identifier,identifierType:(uuid,required,name),preferred)`
      : null,
    openmrsFetch,
  );
  const result: {
    data: FormValues['identifiers'];
    error?: Error;
    isLoading: boolean;
  } = useMemo(() => {
    const identifiers: FormValues['identifiers'] = {};
    const identifierResults = Array.isArray(data?.data?.results) ? data.data.results : [];

    identifierResults.forEach((patientIdentifier) => {
      identifiers[camelCase(patientIdentifier.identifierType.name)] = {
        identifierUuid: patientIdentifier.uuid,
        preferred: patientIdentifier.preferred,
        initialValue: patientIdentifier.identifier,
        identifierValue: patientIdentifier.identifier,
        identifierTypeUuid: patientIdentifier.identifierType.uuid,
        identifierName: patientIdentifier.identifierType.name,
        required: patientIdentifier.identifierType.required,
        selectedSource: null,
        autoGeneration: false,
      };
    });
    return {
      data: identifiers,
      error,
      isLoading,
    };
  }, [data?.data?.results, error, isLoading]);

  return result;
}

function useInitialEncounters(patientUuid: string, patientToEdit?: fhir.Patient) {
  const { registrationObs } = useConfig() as RegistrationConfig;
  const { data, error, isLoading } = useSWR<FetchResponse<{ results: Array<Encounter> }>>(
    patientToEdit && registrationObs?.encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&v=custom:(encounterDatetime,obs:(concept:ref,value:ref))&encounterType=${registrationObs.encounterTypeUuid}`
      : null,
    openmrsFetch,
  );
  const patientEncounters = useMemo(() => {
    const encounterResults = Array.isArray(data?.data?.results) ? [...data.data.results] : [];
    return mapEncounterObservations(encounterResults.sort(latestFirstEncounter)?.at(0)?.obs);
  }, [data?.data?.results]);

  return { data: patientEncounters, isLoading, error };
}

function useInitialPersonAttributes(personUuid: string) {
  const shouldFetch = !!personUuid;
  const { data, error, isLoading } = useSWR<FetchResponse<{ results: Array<PersonAttributeResponse> }>, Error>(
    shouldFetch
      ? `${restBaseUrl}/person/${personUuid}/attribute?v=custom:(uuid,display,attributeType:(uuid,display,format),value)`
      : null,
    openmrsFetch,
  );
  const result = useMemo(() => {
    return {
      data: Array.isArray(data?.data?.results) ? data.data.results : [],
      error,
      isLoading,
    };
  }, [data?.data?.results, error, isLoading]);
  return result;
}

function useInitialPersonDeathInfo(personUuid: string) {
  const { data, error, isLoading } = useSWR<FetchResponse<DeathInfoResults>, Error>(
    personUuid
      ? `${restBaseUrl}/person/${personUuid}?v=custom:(uuid,display,causeOfDeath,dead,deathDate,causeOfDeathNonCoded)`
      : null,
    openmrsFetch,
  );

  const result = useMemo(() => {
    return {
      data: data?.data,
      error,
      isLoading,
    };
  }, [data?.data, error, isLoading]);
  return result;
}

function getPatientAttributeUuidMapForPatient(attributes: Array<PersonAttributeResponse>) {
  const attributeUuidMap = {};
  attributes.forEach((attribute) => {
    attributeUuidMap[`attribute.${attribute?.attributeType?.uuid}`] = attribute?.uuid;
  });
  return attributeUuidMap;
}
