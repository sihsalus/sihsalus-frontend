/**
 * useEmergencyVisit Hook
 *
 * Manages emergency visit creation and retrieval for patients.
 *
 * Features:
 * - Check for active emergency visits
 * - Create new emergency visits
 * - Get or create visits (smart creation)
 * - Proper error handling and user feedback
 */

import {
  getUserFacingErrorMessage,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  useConfig,
} from '@openmrs/esm-framework';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Config } from '../../config-schema';

interface VisitResponse {
  uuid: string;
  voided: boolean;
  patient: {
    uuid: string;
  };
  visitType: {
    uuid: string;
    display: string;
  };
  startDatetime: string;
  stopDatetime?: string | null;
  location: {
    uuid: string;
    display?: string;
  };
}

interface VisitSearchResponse {
  results?: VisitResponse[];
}

interface EmergencyVisitIdentity {
  uuid?: string;
  voided?: boolean;
  stopDatetime?: string | null;
  patient?: { uuid?: string };
  visitType?: { uuid?: string };
  location?: { uuid?: string };
}

export class EmergencyVisitSearchVerificationError extends Error {
  constructor() {
    super('The active emergency visit search returned an invalid response.');
    this.name = 'EmergencyVisitSearchVerificationError';
  }
}

export class EmergencyVisitCreationVerificationError extends Error {
  constructor() {
    super('The emergency visit creation response did not include a visit UUID.');
    this.name = 'EmergencyVisitCreationVerificationError';
  }
}

export class IncompatibleActiveVisitError extends Error {
  constructor() {
    super('The patient has an active visit that is not an emergency visit.');
    this.name = 'IncompatibleActiveVisitError';
  }
}

export class EmergencyVisitLocationConflictError extends Error {
  constructor() {
    super('The active emergency visit belongs to a different location.');
    this.name = 'EmergencyVisitLocationConflictError';
  }
}

export class MultipleActiveEmergencyVisitsError extends Error {
  constructor() {
    super('The patient has more than one active emergency visit.');
    this.name = 'MultipleActiveEmergencyVisitsError';
  }
}

export class EmergencyVisitConfigurationError extends Error {
  constructor() {
    super('Emergency visit type, patient and location must be configured before creating a visit.');
    this.name = 'EmergencyVisitConfigurationError';
  }
}

async function verifyEmergencyVisitIdentity(
  visitUuid: string,
  expected: { patientUuid: string; visitTypeUuid: string; locationUuid: string },
) {
  const representation = encodeURIComponent(
    'custom:(uuid,voided,stopDatetime,patient:(uuid),visitType:(uuid),location:(uuid))',
  );
  const response = await openmrsFetch<EmergencyVisitIdentity>(`${restBaseUrl}/visit/${visitUuid}?v=${representation}`);
  const visit = response.data;

  if (
    visit?.uuid !== visitUuid ||
    visit.voided === true ||
    Boolean(visit.stopDatetime) ||
    visit.patient?.uuid !== expected.patientUuid ||
    visit.visitType?.uuid !== expected.visitTypeUuid ||
    visit.location?.uuid !== expected.locationUuid
  ) {
    throw new EmergencyVisitCreationVerificationError();
  }

  return response;
}

export function useEmergencyVisit() {
  const { t } = useTranslation();
  const [isCreatingVisit, setIsCreatingVisit] = useState(false);
  const config = useConfig<Config>();

  /**
   * Verifica si el paciente tiene una visita activa de emergencia
   */
  const checkActiveEmergencyVisit = useCallback(
    async (patientUuid: string): Promise<VisitResponse | null> => {
      const patient = patientUuid?.trim();
      const visitTypeUuid = config.emergencyVisitTypeUuid?.trim();
      const locationUuid = config.emergencyLocationUuid?.trim();
      if (!patient || !visitTypeUuid || !locationUuid) {
        throw new EmergencyVisitConfigurationError();
      }

      const representation = encodeURIComponent(
        'custom:(uuid,voided,startDatetime,stopDatetime,patient:(uuid),visitType:(uuid,display),location:(uuid,display))',
      );
      const response = await openmrsFetch<VisitSearchResponse>(
        `${restBaseUrl}/visit?patient=${encodeURIComponent(patient)}&includeInactive=false&v=${representation}`,
      );
      if (!Array.isArray(response.data?.results)) {
        throw new EmergencyVisitSearchVerificationError();
      }

      const activeVisits = response.data.results;
      if (
        activeVisits.some(
          (visit) =>
            !visit?.uuid?.trim() ||
            visit.voided !== false ||
            Boolean(visit.stopDatetime) ||
            visit.patient?.uuid !== patient ||
            !visit.visitType?.uuid?.trim() ||
            !visit.location?.uuid?.trim(),
        )
      ) {
        throw new EmergencyVisitSearchVerificationError();
      }

      const activeEmergencyVisits = activeVisits.filter((visit) => visit.visitType.uuid === visitTypeUuid);
      if (activeEmergencyVisits.length > 1) {
        throw new MultipleActiveEmergencyVisitsError();
      }
      if (activeEmergencyVisits.length === 1) {
        const activeEmergencyVisit = activeEmergencyVisits[0];
        if (activeEmergencyVisit.location.uuid !== locationUuid) {
          throw new EmergencyVisitLocationConflictError();
        }
        await verifyEmergencyVisitIdentity(activeEmergencyVisit.uuid, {
          patientUuid: patient,
          visitTypeUuid,
          locationUuid,
        });
        return activeEmergencyVisit;
      }
      if (activeVisits.length) {
        throw new IncompatibleActiveVisitError();
      }

      return null;
    },
    [config.emergencyLocationUuid, config.emergencyVisitTypeUuid],
  );

  /**
   * Crea una nueva visita de emergencia
   */
  const createEmergencyVisit = useCallback(
    async (patientUuid: string, startDatetime?: string, administrativeNotes?: string): Promise<string | null> => {
      setIsCreatingVisit(true);

      try {
        const patient = patientUuid?.trim();
        const visitTypeUuid = config.emergencyVisitTypeUuid?.trim();
        const locationUuid = config.emergencyLocationUuid?.trim();
        if (!locationUuid) {
          showSnackbar({
            title: t('errorCreatingVisit', 'Error al crear visita'),
            subtitle: t('emergencyLocationNotConfigured', 'No se configuró la ubicación operativa de emergencia.'),
            kind: 'error',
          });
          return null;
        }
        if (!patient || !visitTypeUuid) {
          throw new EmergencyVisitConfigurationError();
        }

        const visitPayload = {
          patient,
          visitType: visitTypeUuid,
          location: locationUuid,
          startDatetime: startDatetime ? new Date(startDatetime).toISOString() : new Date().toISOString(),
        };

        const response = await openmrsFetch<{ uuid?: string }>('/ws/rest/v1/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: visitPayload,
        });

        const visitUuid = response.data?.uuid?.trim();
        if (!visitUuid) {
          throw new EmergencyVisitCreationVerificationError();
        }
        await verifyEmergencyVisitIdentity(visitUuid, {
          patientUuid: patient,
          visitTypeUuid,
          locationUuid,
        });
        const trimmedAdministrativeNotes = administrativeNotes?.trim();
        const administrativeNotesAttributeTypeUuid =
          config.patientRegistration?.administrativeNotesVisitAttributeTypeUuid;

        if (trimmedAdministrativeNotes && administrativeNotesAttributeTypeUuid) {
          try {
            await openmrsFetch(`/ws/rest/v1/visit/${visitUuid}/attribute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: {
                attributeType: administrativeNotesAttributeTypeUuid,
                value: trimmedAdministrativeNotes,
              },
            });
          } catch (error: unknown) {
            showSnackbar({
              title: t('visitCreatedAdministrativeNotesPending', 'Visita creada, observación pendiente'),
              subtitle: getUserFacingErrorMessage(
                error,
                t('couldNotSaveAdministrativeNotes', 'No se pudo guardar la observación administrativa de emergencia'),
                { logContext: 'Save emergency visit administrative notes' },
              ),
              kind: 'warning',
            });
          }
        }

        showSnackbar({
          title: t('visitCreated', 'Visita creada'),
          subtitle: t('emergencyVisitCreatedSuccessfully', 'Visita de emergencia creada exitosamente'),
          kind: 'success',
          timeoutInMs: 3000,
        });

        return visitUuid;
      } catch (error: unknown) {
        showSnackbar({
          title: t('errorCreatingVisit', 'Error al crear visita'),
          subtitle: getUserFacingErrorMessage(
            error,
            t(
              'couldNotCreateVisitSafely',
              'No se pudo confirmar la creación de la visita de emergencia. Verifique las visitas activas antes de reintentar.',
            ),
            { logContext: 'Create emergency visit' },
          ),
          kind: 'error',
        });
        return null;
      } finally {
        setIsCreatingVisit(false);
      }
    },
    [config, t],
  );

  /**
   * Obtiene o crea una visita de emergencia
   * (Lógica principal para el flujo automático)
   */
  const getOrCreateEmergencyVisit = useCallback(
    async (patientUuid: string, startDatetime?: string, administrativeNotes?: string): Promise<string | null> => {
      // 1. Verificar si ya existe una visita activa
      let existingVisit: VisitResponse | null;
      try {
        existingVisit = await checkActiveEmergencyVisit(patientUuid);
      } catch (error: unknown) {
        const isIncompatibleActiveVisit = error instanceof IncompatibleActiveVisitError;
        const hasMultipleEmergencyVisits = error instanceof MultipleActiveEmergencyVisitsError;
        const hasLocationConflict = error instanceof EmergencyVisitLocationConflictError;
        showSnackbar({
          title:
            isIncompatibleActiveVisit || hasMultipleEmergencyVisits || hasLocationConflict
              ? t('activeVisitConflictTitle', 'La visita activa requiere revisión')
              : t('errorCheckingActiveVisit', 'No se pudo verificar la visita activa'),
          subtitle: getUserFacingErrorMessage(
            error,
            hasLocationConflict
              ? t(
                  'emergencyVisitLocationConflictSafe',
                  'La visita de emergencia activa pertenece a otra sede. No se reutilizó ni se creó otra visita; revise el episodio y la sede antes de continuar.',
                )
              : isIncompatibleActiveVisit
                ? t(
                    'incompatibleActiveVisitSafe',
                    'El paciente tiene una visita activa de otro tipo. No se reutilizó ni se creó otra visita; revise el episodio antes de continuar.',
                  )
                : hasMultipleEmergencyVisits
                  ? t(
                      'multipleActiveEmergencyVisitsSafe',
                      'Se encontraron varias visitas de emergencia activas. No se creó otra; concilie los episodios antes de continuar.',
                    )
                  : t(
                      'activeVisitCheckFailedSafe',
                      'No se creó una visita nueva porque no se pudo comprobar si el paciente ya tiene una visita activa. Actualice e intente nuevamente.',
                    ),
            { logContext: 'Check active emergency visit' },
          ),
          kind: 'error',
        });
        return null;
      }

      if (existingVisit) {
        showSnackbar({
          title: t('activeVisitFound', 'Visita activa encontrada'),
          subtitle: t('patientHasActiveVisit', 'El paciente ya tiene una visita de emergencia activa'),
          kind: 'info',
          timeoutInMs: 3000,
        });
        return existingVisit.uuid;
      }

      // 2. Si no existe, crear nueva visita
      return await createEmergencyVisit(patientUuid, startDatetime, administrativeNotes);
    },
    [checkActiveEmergencyVisit, createEmergencyVisit, t],
  );

  return {
    isCreatingVisit,
    checkActiveEmergencyVisit,
    createEmergencyVisit,
    getOrCreateEmergencyVisit,
  };
}
