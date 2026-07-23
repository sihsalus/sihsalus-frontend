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

import { openmrsFetch, showSnackbar, useConfig } from '@openmrs/esm-framework';
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
}

interface VisitSearchResponse {
  data: {
    results: VisitResponse[];
  };
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
      try {
        const response: VisitSearchResponse = await openmrsFetch(
          `/ws/rest/v1/visit?patient=${patientUuid}&includeInactive=false&v=default`,
        );

        const visits = response.data.results;

        const activeVisits = visits.filter((visit: VisitResponse) => !visit.stopDatetime);

        // Prefer an active emergency visit, but reuse any active visit to avoid overlapping visits.
        const activeEmergencyVisit = activeVisits.find(
          (visit: VisitResponse) => visit.visitType?.uuid === config.emergencyVisitTypeUuid,
        );

        return activeEmergencyVisit || activeVisits[0] || null;
      } catch {
        return null;
      }
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

        const response = await openmrsFetch('/ws/rest/v1/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: visitPayload,
        });

        const visitUuid = response.data.uuid;
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
          } catch {
            showSnackbar({
              title: t('visitCreatedAdministrativeNotesPending', 'Visita creada, observación pendiente'),
              subtitle: t(
                'couldNotSaveAdministrativeNotes',
                'No se pudo guardar la observación administrativa de emergencia',
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
        const errorMessage = (error as { responseBody?: { error?: { message?: string } } })?.responseBody?.error
          ?.message;
        showSnackbar({
          title: t('errorCreatingVisit', 'Error al crear visita'),
          subtitle: errorMessage || t('couldNotCreateVisit', 'No se pudo crear la visita de emergencia'),
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
      const existingVisit = await checkActiveEmergencyVisit(patientUuid);

      if (existingVisit) {
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
    [checkActiveEmergencyVisit, createEmergencyVisit, config.emergencyVisitTypeUuid, t],
  );

  return {
    isCreatingVisit,
    checkActiveEmergencyVisit,
    createEmergencyVisit,
    getOrCreateEmergencyVisit,
  };
}
