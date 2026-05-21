import type { Session } from '@openmrs/esm-framework';
import { openmrsFetch, restBaseUrl, showModal, showSnackbar } from '@openmrs/esm-framework';
import omit from 'lodash-es/omit';
import { mutate } from 'swr';
import { z } from 'zod';

import type { ConfigObject } from '../config-schema';
import type { Patient } from '../types';

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
  const customREp = 'custom:(uuid,identifiers,person:(uuid,display,gender,age,birthdate,attributes))';
  const patientsRes = await openmrsFetch<{ results: Array<Patient> }>(
    `${restBaseUrl}/patient?q=${query}&v=${customREp}`,
    {
      signal: abortController.signal,
    },
  );
  return patientsRes?.data?.results ?? [];
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
      maritalStatus: z.string().optional(),
      address: z.string().optional(),
      phoneNumber: z.string().optional(),
    })
    .optional(),
});

export function generateOpenmrsIdentifier(source: string) {
  const abortController = new AbortController();
  return openmrsFetch(`${restBaseUrl}/idgen/identifiersource/${source}/identifier`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: {},
    signal: abortController.signal,
  });
}

export const saveRelationship = async (
  data: z.infer<typeof relationshipFormSchema>,
  config: ConfigObject,
  session: Session,
  extraAttributes: Array<{ attributeType: string; value: string }> = [],
) => {
  // Handle patient creation
  let patient: string = data.personB;
  if (data.mode === 'create') {
    try {
      const identifier = await generateOpenmrsIdentifier(config.defaultIdentifierSourceUuid);

      const {
        address,
        birthdate,
        familyName,
        familyName2, // ← Agregado aquí
        gender,
        givenName,
        middleName,
        phoneNumber,
      } = data.personBInfo;

      const response = await openmrsFetch<Patient>(`/ws/rest/v1/patient`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifiers: [
            {
              identifier: identifier.data.identifier,
              identifierType: config.defaultIDUuid,
              location: session.sessionLocation.uuid,
            },
          ],
          person: {
            names: [
              {
                givenName,
                middleName,
                familyName,
                familyName2,
              },
            ],
            gender,
            birthdate,
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
              ...extraAttributes,
            ],
          },
        }),
      });
      patient = response.data?.uuid;
      showSnackbar({
        title: t('success', 'Éxito'),
        kind: 'success',
        subtitle: t('patientCreatedSuccessfully', 'Paciente creado exitosamente'),
      });
    } catch (error) {
      showSnackbar({
        title: t('errorCreatingPatient', 'Error al crear el paciente'),
        kind: 'error',
        subtitle: error?.message,
      });
      throw error; // Don't contunue if an erro ocuures
    }
  }

  // Hanldle add personB attributes if search mode
  if (data.mode === 'search' && extraAttributes.length > 0) {
    const results = await Promise.allSettled(
      extraAttributes.map((attr) =>
        openmrsFetch(`${restBaseUrl}/person/${patient}/attribute`, {
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
          subtitle: t('errorCreatingPatientAttribute', 'Error al crear el atributo del paciente'),
        });
      }
    });
  }

  // Handle storage of patient demographics in obs
  if (data.mode === 'create' && data.personBInfo?.maritalStatus) {
    try {
      await openmrsFetch(`/ws/rest/v1/encounter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: session.sessionLocation.uuid,
          encounterProviders: [
            {
              provider: session.currentProvider.uuid,
              encounterRole: config.registrationObs.encounterProviderRoleUuid,
            },
          ],
          form: config.registrationObs.registrationFormUuid,
          encounterType: config.registrationEncounterUuid,
          patient: patient,
          obs: [{ concept: config.maritalStatusUuid, value: data.personBInfo.maritalStatus }],
        }),
      });
      showSnackbar({
        title: t('success', 'Éxito'),
        kind: 'success',
        subtitle: t('patientDemographicsSavedSuccessfully', 'Datos demográficos guardados exitosamente'),
      });
    } catch (error) {
      showSnackbar({
        title: t('errorSavingPatientDemographics', 'Error al guardar los datos demográficos'),
        kind: 'error',
        subtitle: error?.message,
      });
    }
  }

  // Handle Relationship Creation
  try {
    const relationshipPayload =
      data.relationshipDirection === 'aIsToB'
        ? {
            ...omit(data, ['personBInfo', 'mode', 'relationshipDirection', 'personA', 'personB']),
            personA: patient,
            personB: data.personA,
          }
        : {
            ...omit(data, ['personBInfo', 'mode', 'relationshipDirection']),
            personB: patient,
          };

    await openmrsFetch(`/ws/rest/v1/relationship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(relationshipPayload),
    });
    showSnackbar({
      title: t('success', 'Éxito'),
      kind: 'success',
      subtitle: t('relationshipSavedSuccessfully', 'La relación familiar se guardó exitosamente'),
    });
    mutate((key) => typeof key === 'string' && key.startsWith('/ws/rest/v1/relationship'));
  } catch (error) {
    showSnackbar({
      title: t('errorSavingRelationship', 'Error al guardar la relación'),
      kind: 'error',
      subtitle: error?.message,
    });
    throw error;
  }
};
