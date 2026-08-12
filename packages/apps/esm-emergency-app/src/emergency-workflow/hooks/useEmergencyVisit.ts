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

import { getUserFacingErrorMessage, openmrsFetch, showSnackbar, useConfig } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
} from '@openmrs/esm-patient-common-lib';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Config } from '../../config-schema';

interface VisitResponse {
  uuid: string;
  visitType: {
    uuid: string;
    display: string;
  };
  startDatetime: string;
  stopDatetime?: string;
  attributes?: Array<{
    uuid: string;
    value?: unknown;
    attributeType?: { uuid?: string };
  }>;
}

interface VisitSearchResponse {
  data: {
    results: VisitResponse[];
  };
}

export const EMERGENCY_ADMINISTRATIVE_NOTES_PENDING = 'EMERGENCY_ADMINISTRATIVE_NOTES_PENDING';
export const EMERGENCY_VISIT_UUID_UNAVAILABLE = 'EMERGENCY_VISIT_UUID_UNAVAILABLE';

function administrativeNotesPending(cause?: unknown) {
  return Object.assign(new Error('The emergency administrative notes could not be verified.', { cause }), {
    code: EMERGENCY_ADMINISTRATIVE_NOTES_PENDING,
  });
}

export function useEmergencyVisit() {
  const { t } = useTranslation();
  const [isCreatingVisit, setIsCreatingVisit] = useState(false);
  const config = useConfig<Config>();

  const showAdministrativeNotesWarning = useCallback(() => {
    showSnackbar({
      title: t('visitCreatedAdministrativeNotesPending', 'Visita creada, observación pendiente'),
      subtitle: t(
        'couldNotSaveAdministrativeNotes',
        'No se pudo guardar la observación administrativa de emergencia',
      ),
      kind: 'warning',
    });
  }, [t]);

  const ensureAdministrativeNotes = useCallback(
    async (patientUuid: string, visit: Pick<VisitResponse, 'uuid' | 'attributes'>, administrativeNotes?: string) => {
      const value = administrativeNotes?.trim();
      const attributeTypeUuid = config.patientRegistration?.administrativeNotesVisitAttributeTypeUuid;
      if (!value || !attributeTypeUuid) {
        return;
      }

      const matches = (attributes: VisitResponse['attributes']) =>
        attributes?.some(
          (attribute) =>
            attribute.attributeType?.uuid === attributeTypeUuid && String(attribute.value ?? '').trim() === value,
        ) ?? false;
      if (matches(visit.attributes)) {
        return;
      }

      const existing = visit.attributes?.find((attribute) => attribute.attributeType?.uuid === attributeTypeUuid);
      // The active-visit guard may precede this helper. Repeat it adjacent to
      // the attribute write because an update also mutates the visit record.
      await assertFreshPatientIsAlive(patientUuid);
      const url = existing
        ? `/ws/rest/v1/visit/${visit.uuid}/attribute/${existing.uuid}`
        : `/ws/rest/v1/visit/${visit.uuid}/attribute`;
      const body = existing ? { value } : { attributeType: attributeTypeUuid, value };
      let writeError: unknown;
      try {
        await openmrsFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      } catch (error) {
        writeError = error;
      }

      let latestAttributes: VisitResponse['attributes'];
      try {
        const latest = await openmrsFetch<Pick<VisitResponse, 'attributes'>>(
          `/ws/rest/v1/visit/${visit.uuid}?v=custom:(attributes:(uuid,value,attributeType:(uuid)))`,
        );
        latestAttributes = latest.data?.attributes;
      } catch {
        if (writeError) {
          throw administrativeNotesPending(writeError);
        }
        throw administrativeNotesPending();
      }

      if (!matches(latestAttributes)) {
        throw administrativeNotesPending(writeError);
      }
    },
    [config.patientRegistration?.administrativeNotesVisitAttributeTypeUuid],
  );

  /**
   * Verifica si el paciente tiene una visita activa de emergencia
   */
  const checkActiveEmergencyVisit = useCallback(
    async (patientUuid: string): Promise<VisitResponse | null> => {
      const response: VisitSearchResponse = await openmrsFetch(
        `/ws/rest/v1/visit?patient=${patientUuid}&includeInactive=false&v=custom:(uuid,visitType:(uuid,display),startDatetime,stopDatetime,attributes:(uuid,value,attributeType:(uuid)))`,
      );

      const visits = response.data.results;

      const activeVisits = visits.filter((visit: VisitResponse) => !visit.stopDatetime);

      // Prefer an active emergency visit, but reuse any active visit to avoid overlapping visits.
      const activeEmergencyVisit = activeVisits.find(
        (visit: VisitResponse) => visit.visitType?.uuid === config.emergencyVisitTypeUuid,
      );

      return activeEmergencyVisit || activeVisits[0] || null;
    },
    [config.emergencyVisitTypeUuid],
  );

  /**
   * Crea una nueva visita de emergencia
   */
  const createEmergencyVisit = useCallback(
    async (patientUuid: string, startDatetime?: string, administrativeNotes?: string): Promise<string | null> => {
      setIsCreatingVisit(true);

      try {
        const emergencyLocationUuid = config.emergencyLocationUuid;
        if (!emergencyLocationUuid) {
          showSnackbar({
            title: t('errorCreatingVisit', 'Error al crear visita'),
            subtitle: t('emergencyLocationNotConfigured', 'No se configuró la UPSS operativa de emergencia.'),
            kind: 'error',
          });
          return null;
        }

        const visitPayload = {
          patient: patientUuid,
          visitType: config.emergencyVisitTypeUuid,
          location: emergencyLocationUuid,
          startDatetime: startDatetime ? new Date(startDatetime).toISOString() : new Date().toISOString(),
        };

        // Keep the authoritative check adjacent to the visit write so a death
        // concurrent with the earlier active-visit lookup cannot create care.
        await assertFreshPatientIsAlive(patientUuid);
        const response = await openmrsFetch<{ uuid?: string }>('/ws/rest/v1/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: visitPayload,
        });

        const visitUuid = response.data?.uuid;
        if (!visitUuid) {
          throw Object.assign(new Error('The emergency visit response did not include a UUID.'), {
            code: EMERGENCY_VISIT_UUID_UNAVAILABLE,
          });
        }
        try {
          await ensureAdministrativeNotes(patientUuid, { uuid: visitUuid, attributes: [] }, administrativeNotes);
        } catch (error) {
          if ((error as { code?: string })?.code !== EMERGENCY_ADMINISTRATIVE_NOTES_PENDING) {
            throw error;
          }
          showAdministrativeNotesWarning();
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
            t('couldNotCreateVisit', 'No se pudo crear la visita de emergencia. Intente nuevamente.'),
            { logContext: 'Create emergency visit' },
          ),
          kind: 'error',
        });
        const errorCode = (error as { code?: string })?.code;
        if (
          errorCode === EMERGENCY_VISIT_UUID_UNAVAILABLE ||
          errorCode === DECEASED_PATIENT_OPERATION_BLOCKED ||
          errorCode === PATIENT_VITAL_STATUS_UNAVAILABLE ||
          error instanceof TypeError
        ) {
          throw error;
        }
        return null;
      } finally {
        setIsCreatingVisit(false);
      }
    },
    [config, ensureAdministrativeNotes, showAdministrativeNotesWarning, t],
  );

  /**
   * Obtiene o crea una visita de emergencia
   * (Lógica principal para el flujo automático)
   */
  const getOrCreateEmergencyVisit = useCallback(
    async (patientUuid: string, startDatetime?: string, administrativeNotes?: string): Promise<string | null> => {
      // 1. Verificar si ya existe una visita activa
      const existingVisit = await checkActiveEmergencyVisit(patientUuid);

      if (existingVisit) {
        // Reusing a visit continues care just like creating one. Do not trust
        // the patient state embedded in a previously rendered workflow.
        await assertFreshPatientIsAlive(patientUuid);
        try {
          await ensureAdministrativeNotes(patientUuid, existingVisit, administrativeNotes);
        } catch (error) {
          if ((error as { code?: string })?.code !== EMERGENCY_ADMINISTRATIVE_NOTES_PENDING) {
            throw error;
          }
          showAdministrativeNotesWarning();
        }
        const isEmergencyVisit = existingVisit.visitType?.uuid === config.emergencyVisitTypeUuid;
        if (isEmergencyVisit) {
          showSnackbar({
            title: t('activeVisitFound', 'Visita activa encontrada'),
            subtitle: t('patientHasActiveVisit', 'El paciente ya tiene una visita de emergencia activa'),
            kind: 'info',
            timeoutInMs: 3000,
          });
        } else {
          // OpenMRS no permite visitas paralelas por defecto: se reutiliza la visita
          // abierta, pero informando su tipo real en lugar de llamarla "de emergencia".
          showSnackbar({
            title: t('activeNonEmergencyVisitFound', 'Visita activa de otro tipo'),
            subtitle: t(
              'emergencyUnderExistingVisit',
              'El paciente tiene una visita activa de tipo "{{visitType}}"; la atención de emergencia se registrará bajo esa visita.',
              { visitType: existingVisit.visitType?.display ?? t('unknownVisitType', 'desconocido') },
            ),
            kind: 'warning',
            timeoutInMs: 5000,
          });
        }
        return existingVisit.uuid;
      }

      // 2. Si no existe, crear nueva visita
      return await createEmergencyVisit(patientUuid, startDatetime, administrativeNotes);
    },
    [
      checkActiveEmergencyVisit,
      createEmergencyVisit,
      config.emergencyVisitTypeUuid,
      ensureAdministrativeNotes,
      showAdministrativeNotesWarning,
      t,
    ],
  );

  return {
    isCreatingVisit,
    checkActiveEmergencyVisit,
    createEmergencyVisit,
    getOrCreateEmergencyVisit,
  };
}
