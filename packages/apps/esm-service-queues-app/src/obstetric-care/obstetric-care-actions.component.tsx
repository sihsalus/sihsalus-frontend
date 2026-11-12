import { Button } from '@carbon/react';
import {
  getSessionStore,
  getUserFacingErrorMessage,
  type LoggedInUser,
  navigate,
  restBaseUrl,
  showModal,
  showSnackbar,
  useConnectivity,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import type { ConfigObject } from '../config-schema';
import { serviceQueuesPrivilege } from '../constants';
import { useMutateQueueEntries } from '../hooks/useQueueEntries';
import { canEditServiceQueues, canStartQueueVisit } from '../permissions';
import type { QueueEntry } from '../types';
import { type ObstetricCareMode, ObstetricVisitClosedError, startObstetricCare } from './obstetric-care.resource';

// These paths and privileges belong to the existing maternal chart dashboards.
const careDashboards = {
  outpatient: [
    { path: 'prenatal-care-dashboard', privilege: 'app:hoja.clinica.controlPrenatal' },
    { path: 'family-planning-dashboard', privilege: 'app:hoja.clinica.planificacionFamiliar' },
    { path: 'cancer-prevention-dashboard', privilege: 'app:hoja.clinica.prevencionCancer' },
  ],
  inpatient: [
    { path: 'labour-and-delivery-dashboard', privilege: 'app:hoja.clinica.partoPuerperio' },
    { path: 'postnatal-care-dashboard', privilege: 'app:hoja.clinica.atencionPostnatal' },
  ],
} as const;

function canAttendDashboard(
  user: LoggedInUser | undefined,
  mode: ObstetricCareMode,
  dashboard?: { privilege: string },
) {
  return Boolean(
    user &&
      dashboard &&
      canEditServiceQueues(user) &&
      (mode === 'inpatient' || userHasAccess('View Appointments', user)) &&
      [
        serviceQueuesPrivilege,
        'app:hoja.clinica',
        'Get Visits',
        'Get Patients',
        dashboard.privilege,
        `${dashboard.privilege}.editar`,
      ].every((privilege) => userHasAccess(privilege, user)),
  );
}

interface ObstetricCareActionsProps {
  queueEntry: QueueEntry;
  mode: ObstetricCareMode;
  config: ConfigObject;
}

export default function ObstetricCareActions({ queueEntry, mode, config }: ObstetricCareActionsProps) {
  const { t } = useTranslation();
  const session = useSession();
  const isOnline = useConnectivity();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const context = `${queueEntry.uuid}:${queueEntry.patient?.uuid}:${queueEntry.visit?.uuid}:${queueEntry.queue?.uuid}:${mode}`;
  const currentContext = useRef(context);
  currentContext.current = context;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { mutate } = useSWRConfig();
  const { mutateQueueEntries } = useMutateQueueEntries();
  const dashboard = careDashboards[mode].find(
    ({ privilege }) => userHasAccess(privilege, session?.user) && userHasAccess(`${privilege}.editar`, session?.user),
  );
  const canAttend = session?.authenticated && canAttendDashboard(session.user, mode, dashboard);
  const isInService =
    Boolean(config.concepts.defaultTransitionStatus) &&
    queueEntry.status?.uuid === config.concepts.defaultTransitionStatus;
  const isReady =
    isOnline &&
    Boolean(queueEntry.visit?.uuid && config.concepts.defaultTransitionStatus?.trim()) &&
    (mode === 'inpatient' || queueEntry.workflow?.triageState === 'completed');

  if (!canAttend || !dashboard || !session?.user || queueEntry.endedAt) {
    return null;
  }

  const attend = async () => {
    if (submitting.current || !isReady) {
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    const isCurrent = () => {
      const { loaded, session: currentSession } = getSessionStore().getState();
      return (
        mounted.current &&
        currentContext.current === context &&
        loaded &&
        currentSession?.authenticated &&
        currentSession.user?.uuid === session.user.uuid &&
        canAttendDashboard(currentSession.user, mode, dashboard)
      );
    };
    try {
      if (!isCurrent()) {
        return;
      }
      const attendingEntry = await startObstetricCare(queueEntry, mode, config);
      if (!isCurrent()) {
        return;
      }
      // The chart selects the active visit on mount. Discard its earlier cache
      // so it loads the single active visit verified by the queue action.
      await mutate(
        (key) =>
          typeof key === 'string' && key.startsWith(`${restBaseUrl}/visit?patient=${attendingEntry.patient.uuid}&`),
        undefined,
        { revalidate: false },
      );
      if (!isCurrent()) {
        return;
      }
      navigate({
        to: `${globalThis.getOpenmrsSpaBase()}patient/${attendingEntry.patient.uuid}/chart/${dashboard.path}`,
      });
      void mutateQueueEntries();
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      void mutateQueueEntries();
      if (
        error instanceof ObstetricVisitClosedError &&
        canStartQueueVisit(getSessionStore().getState().session?.user)
      ) {
        await mutate(
          (key) =>
            typeof key === 'string' && key.startsWith(`${restBaseUrl}/visit?patient=${queueEntry.patient.uuid}&`),
          undefined,
          { revalidate: false },
        );
        if (!isCurrent() || !canStartQueueVisit(getSessionStore().getState().session?.user)) {
          return;
        }
        const dispose = showModal('start-visit-dialog', {
          patientUuid: queueEntry.patient.uuid,
          visitType: 'new',
          launchPatientChart: true,
          newVisitOnly: true,
          dashboardName: dashboard.path,
          closeModal: () => dispose(),
        });
        return;
      }
      showSnackbar({
        kind: 'error',
        title: t('obstetricCareUnavailable', 'No se pudo iniciar la atención obstétrica'),
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'obstetricCareRetry',
            'Actualice la cola y verifique que la consulta sigue activa y que el triaje ambulatorio está guardado.',
          ),
          {
            codeMessages: {
              OBSTETRIC_VISIT_CLOSED: t(
                'obstetricVisitClosed',
                'La consulta anterior está cerrada. Para continuar, un usuario autorizado debe iniciar una nueva consulta. La consulta anterior y la interconsulta se conservan.',
              ),
            },
            logContext: 'Start obstetric queue care',
          },
        ),
      });
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <Button
        kind="primary"
        size="sm"
        disabled={isSubmitting || !isReady}
        onClick={() => void attend()}
        title={
          !isOnline
            ? t('obstetricCareRequiresConnection', 'Conéctese para actualizar la atención en cola.')
            : !isReady
              ? t('obstetricCareNotReady', 'Se requiere una consulta activa y el triaje ambulatorio guardado.')
              : undefined
        }
      >
        {isInService
          ? t('continueObstetricCare', 'Continuar atención obstétrica')
          : t('startObstetricCare', 'Atender Obstetricia')}
      </Button>
      {isInService && (
        <Button
          kind="ghost"
          size="sm"
          disabled={isSubmitting || !isOnline}
          onClick={() => {
            const dispose = showModal('remove-queue-entry-modal', {
              queueEntry,
              completeCare: true,
              closeModal: () => dispose(),
            });
          }}
        >
          {t('completeQueueCare', 'Finalizar en cola')}
        </Button>
      )}
    </>
  );
}
