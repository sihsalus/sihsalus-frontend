import { openmrsFetch, restBaseUrl, showModal, showSnackbar } from '@openmrs/esm-framework';
import omit from 'lodash-es/omit';
import { mutate } from 'swr';
import { z } from 'zod';

import type { ConfigObject } from '../config-schema';

interface PatientSearchApiResult {
  uuid: string;
  identifiers?: PersonSearchResult['identifiers'];
  person?: {
    uuid?: string;
    display?: string;
    gender?: string;
    age?: number;
    birthdate?: string;
  };
}

interface PersonSearchApiResult {
  uuid: string;
  display?: string;
  gender?: string;
  age?: number;
  birthdate?: string;
}

export interface PersonSearchResult {
  uuid: string;
  display: string;
  gender?: string;
  age?: number;
  birthdate?: string;
  isPatient: boolean;
  identifiers: Array<{
    identifier: string;
    preferred?: boolean;
    identifierType: {
      display: string;
    };
  }>;
}

type RelationshipSaveOperation = 'create-person' | 'select-person' | 'create-relationship';

export class RelationshipSaveError extends Error {
  readonly operation: RelationshipSaveOperation;
  readonly personUuid?: string;
  readonly originalError: unknown;

  constructor(operation: RelationshipSaveOperation, originalError: unknown, personUuid?: string) {
    super(`Unable to complete relationship operation: ${operation}`);
    this.name = 'RelationshipSaveError';
    this.operation = operation;
    this.originalError = originalError;
    this.personUuid = personUuid;
  }
}

export function getRelationshipRetryPersonUuid(error: unknown) {
  return error instanceof RelationshipSaveError && error.operation === 'create-relationship'
    ? error.personUuid
    : undefined;
}

const t = (key: string, defaultValue: string) => {
  const i18next = (
    globalThis as typeof globalThis & {
      i18next?: { t?: (key: string, options: { defaultValue: string }) => string };
    }
  ).i18next;

  return typeof i18next?.t === 'function' ? i18next.t(key, { defaultValue }) : defaultValue;
};

export const relationshipUpdateFormSchema = z
  .object({
    startDate: z.date({ coerce: true }).max(new Date(), 'Can not be a future date'),
    endDate: z.date({ coerce: true }).optional(),
    relationshipType: z.string().uuid(),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate && data.endDate < data.startDate) {
        return false;
      }
      return true;
    },
    { message: 'End date must be after start date', path: ['endDate'] },
  );

export const updateRelationship = (relationshipUuid: string, payload: z.infer<typeof relationshipUpdateFormSchema>) => {
  const url = `${restBaseUrl}/relationship/${relationshipUuid}`;
  return openmrsFetch(url, {
    body: JSON.stringify(payload),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const deleteRelationship = async (relationshipUuid: string) => {
  const dispose = showModal('relationship-delete-confirm-dialog', {
    onClose: () => dispose(),
    onDelete: async () => {
      try {
        const url = `${restBaseUrl}/relationship/${relationshipUuid}`;
        await openmrsFetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        mutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/relationship`));
        dispose();
        showSnackbar({
          title: t('success', 'Éxito'),
          kind: 'success',
          subtitle: t('relationshipDeletedSuccessfully', 'Relación eliminada exitosamente'),
        });
      } catch {
        showSnackbar({
          title: t('error', 'Error'),
          kind: 'error',
          subtitle: t('failedDeletingRelationship', 'Error al eliminar la relación'),
        });
      }
    },
  });
};

export async function fetchPerson(query: string, abortController: AbortController) {
  const encodedQuery = encodeURIComponent(query);
  const patientRepresentation =
    'custom:(uuid,identifiers:(identifier,preferred,identifierType:(display)),person:(uuid,display,gender,age,birthdate))';
  const personRepresentation = 'custom:(uuid,display,gender,age,birthdate)';
  const [patientsResponse, personsResponse] = await Promise.all([
    openmrsFetch<{ results: Array<PatientSearchApiResult> }>(
      `${restBaseUrl}/patient?q=${encodedQuery}&v=${patientRepresentation}`,
      { signal: abortController.signal },
    ),
    openmrsFetch<{ results: Array<PersonSearchApiResult> }>(
      `${restBaseUrl}/person?q=${encodedQuery}&v=${personRepresentation}`,
      { signal: abortController.signal },
    ),
  ]);

  const results: Array<PersonSearchResult> = (patientsResponse.data?.results ?? []).map((patient) => ({
    uuid: patient.person?.uuid ?? patient.uuid,
    display: patient.person?.display ?? '',
    gender: patient.person?.gender,
    age: patient.person?.age,
    birthdate: patient.person?.birthdate,
    isPatient: true,
    identifiers: patient.identifiers ?? [],
  }));
  const knownPersonUuids = new Set(results.map((person) => person.uuid));

  for (const person of personsResponse.data?.results ?? []) {
    if (!knownPersonUuids.has(person.uuid)) {
      results.push({
        ...person,
        display: person.display ?? '',
        isPatient: false,
        identifiers: [],
      });
    }
  }

  return results;
}

export const relationshipFormSchema = z.object({
  personA: z.string().uuid('Invalid person'),
  personB: z.string().uuid('Invalid person').optional(),
  relationshipType: z.string().uuid(),
  relationshipDirection: z.enum(['aIsToB', 'bIsToA']).optional(),
  startDate: z.date({ coerce: true }).optional().default(new Date()),
  endDate: z.date({ coerce: true }).optional(),
  mode: z.enum(['create', 'search']).default('search'),
  personBInfo: z
    .object({
      givenName: z.string().min(1, 'Given name required'),
      middleName: z.string().optional(),
      familyName: z.string().min(1, 'Family name required'),
      familyName2: z.string().min(1, 'Family name required'),
      gender: z.enum(['M', 'F']),
      birthdate: z.date({ coerce: true }).max(new Date(), 'Must not be a future date'),
      birthdateEstimated: z.boolean().optional(),
      maritalStatus: z.string().optional(),
      address: z.string().optional(),
      phoneNumber: z.string().optional(),
    })
    .optional(),
});

export const saveRelationship = async (
  data: z.infer<typeof relationshipFormSchema>,
  config: ConfigObject,
  extraAttributes: Array<{ attributeType: string; value: string }> = [],
) => {
  let relativePersonUuid = data.personB;
  let personCreated = false;

  // A relative is a Person until an explicit patient-registration workflow promotes them.
  // Reuse personB after a partial failure so retrying cannot create a duplicate Person.
  if (data.mode === 'create' && !relativePersonUuid) {
    try {
      const {
        address,
        birthdate,
        birthdateEstimated,
        familyName,
        familyName2,
        gender,
        givenName,
        maritalStatus,
        middleName,
        phoneNumber,
      } = data.personBInfo;

      const response = await openmrsFetch<{ uuid: string }>(`${restBaseUrl}/person`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          names: [
            {
              givenName,
              middleName,
              familyName,
              familyName2,
              preferred: true,
            },
          ],
          gender,
          birthdate,
          birthdateEstimated: birthdateEstimated ?? false,
          addresses: address ? [{ preferred: true, address1: address }] : undefined,
          dead: false,
          attributes: [
            ...(phoneNumber
              ? [
                  {
                    attributeType: config.contactPersonAttributesUuid.telephone,
                    value: phoneNumber,
                  },
                ]
              : []),
            ...(maritalStatus
              ? [
                  {
                    attributeType: config.maritalStatusPersonAttributeTypeUuid,
                    value: maritalStatus,
                  },
                ]
              : []),
            ...extraAttributes,
          ],
        }),
      });

      if (!response.data?.uuid) {
        throw new Error('The backend did not return the new person UUID');
      }

      relativePersonUuid = response.data.uuid;
      personCreated = true;
    } catch (error) {
      showSnackbar({
        title: t('errorCreatingPerson', 'Error al crear la persona'),
        kind: 'error',
        subtitle: t(
          'errorCreatingPersonMessage',
          'No se pudo crear el familiar. Revise los datos e intente nuevamente.',
        ),
      });
      throw new RelationshipSaveError('create-person', error);
    }
  }

  if (!relativePersonUuid) {
    throw new RelationshipSaveError('select-person', new Error('A related person is required'));
  }

  // Add attributes to a Person selected through search mode.
  if (data.mode === 'search' && extraAttributes.length > 0) {
    const results = await Promise.allSettled(
      extraAttributes.map((attr) =>
        openmrsFetch(`${restBaseUrl}/person/${relativePersonUuid}/attribute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(attr),
        }),
      ),
    );
    results.forEach((res) => {
      if (res.status === 'rejected') {
        showSnackbar({
          title: t('error', 'Error'),
          kind: 'error',
          subtitle: t('errorCreatingPersonAttribute', 'Error al crear el atributo de la persona'),
        });
      }
    });
  }

  try {
    const relationshipPayload =
      data.relationshipDirection === 'aIsToB'
        ? {
            ...omit(data, ['personBInfo', 'mode', 'relationshipDirection', 'personA', 'personB']),
            personA: relativePersonUuid,
            personB: data.personA,
          }
        : {
            ...omit(data, ['personBInfo', 'mode', 'relationshipDirection']),
            personB: relativePersonUuid,
          };

    await openmrsFetch(`${restBaseUrl}/relationship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(relationshipPayload),
    });
    showSnackbar({
      title: t('success', 'Éxito'),
      kind: 'success',
      subtitle:
        data.mode === 'create'
          ? t('personAndRelationshipSaved', 'Persona creada y relación familiar guardada exitosamente')
          : t('relationshipSavedSuccessfully', 'La relación familiar se guardó exitosamente'),
    });
    mutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/relationship`));

    return { personUuid: relativePersonUuid, personCreated };
  } catch (error) {
    showSnackbar({
      title: t('errorSavingRelationship', 'Error al guardar la relación'),
      kind: 'error',
      subtitle:
        data.mode === 'create'
          ? t(
              'relationshipFailedPersonCreated',
              'La persona fue creada, pero la relación no se pudo guardar. Intente guardar nuevamente; no se creará otra persona.',
            )
          : t('relationshipSaveFailedMessage', 'No se pudo guardar la relación. Intente nuevamente.'),
    });
    throw new RelationshipSaveError(
      'create-relationship',
      error,
      data.mode === 'create' ? relativePersonUuid : undefined,
    );
  }
};
