import { Button, InlineLoading } from '@carbon/react';
import { navigate, openmrsFetch, showSnackbar, useConfig, Workspace2 } from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  type PatientWorkspace2DefinitionProps,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import FuaHtmlViewer from '../components/fua-html-viewer.component';
import type { Config } from '../config-schema';
import { fuaReadPrivilege } from '../constant';

interface LegacyFuaEncounterWorkspaceProps extends DefaultPatientWorkspaceProps {
  encounterUuid?: string;
  visitUuid?: string;
}

type Workspace2FuaEncounterWorkspaceProps = PatientWorkspace2DefinitionProps<
  {
    encounterUuid?: string;
    visitUuid?: string;
  },
  object
>;

type FuaEncounterWorkspaceProps = LegacyFuaEncounterWorkspaceProps | Workspace2FuaEncounterWorkspaceProps;

function isWorkspace2Props(props: FuaEncounterWorkspaceProps): props is Workspace2FuaEncounterWorkspaceProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

interface FuaPatientOrder {
  uuid: string;
  visitUuid?: string | null;
}

function normalizeFuaPatientOrders(payload: unknown): Array<FuaPatientOrder> {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object' && 'results' in payload) {
    const results = (payload as { results?: unknown }).results;
    return Array.isArray(results) ? results : [];
  }

  return [];
}

const FuaEncounterWorkspaceContent: React.FC<FuaEncounterWorkspaceProps> = (props) => {
  const { t } = useTranslation();
  const config = useConfig<Config>();
  const patientUuid = isWorkspace2Props(props) ? props.groupProps.patientUuid : props.patientUuid;
  const encounterUuid = isWorkspace2Props(props) ? props.workspaceProps?.encounterUuid : props.encounterUuid;
  const visitUuid = isWorkspace2Props(props) ? props.workspaceProps?.visitUuid : props.visitUuid;
  const { currentVisit, activeVisit, isLoading: isLoadingVisit } = useVisitOrOfflineVisit(patientUuid);
  const [isInitializing, setIsInitializing] = useState(true);
  const [fuaId, setFuaId] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [_retrySeed, setRetrySeed] = useState(0);

  useEffect(() => {
    if (isLoadingVisit) {
      return;
    }

    const effectiveVisitUuid = visitUuid ?? currentVisit?.uuid ?? activeVisit?.uuid;

    if (!effectiveVisitUuid) {
      const message = t('noActiveVisitForFua', 'No hay una visita activa para crear FUA');
      setErrorMessage(message);
      setIsInitializing(false);
      return;
    }

    const loadExistingFua = async () => {
      try {
        setIsInitializing(true);
        setErrorMessage(null);

        const fuaResponse = await openmrsFetch<Array<FuaPatientOrder>>(
          `${config.fuaApiBasePath}/patient/${patientUuid}`,
        );
        const fuaOrders = normalizeFuaPatientOrders(fuaResponse?.data);
        const matchingFua =
          fuaOrders.find((fua) => fua.visitUuid === effectiveVisitUuid) ??
          fuaOrders.find((fua) => fua.uuid === encounterUuid);

        if (!matchingFua?.uuid) {
          setErrorMessage(
            t(
              'noFuaForCurrentVisit',
              'No hay un FUA registrado para la visita actual. Abra la gestión FUA para revisar o generar el documento en el backend.',
            ),
          );
          setFuaId(undefined);
          return;
        }

        setFuaId(matchingFua.uuid);
      } catch (error) {
        const message = error instanceof Error ? error.message : t('errorLoadingFua', 'Error al cargar FUA');
        setErrorMessage(message);
        showSnackbar({
          title: t('errorLoadingFua', 'Error al cargar FUA'),
          subtitle: message,
          kind: 'error',
        });
      } finally {
        setIsInitializing(false);
      }
    };

    void loadExistingFua();
  }, [
    config.fuaApiBasePath,
    encounterUuid,
    activeVisit?.uuid,
    currentVisit?.uuid,
    isLoadingVisit,
    patientUuid,
    t,
    visitUuid,
  ]);

  const content = isInitializing ? (
    <div style={{ padding: '1rem' }}>
      <InlineLoading description={t('creatingFua', 'Creando FUA...')} />
    </div>
  ) : errorMessage ? (
    <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <p>{errorMessage}</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Button kind="primary" onClick={() => setRetrySeed((seed) => seed + 1)}>
          {t('retry', 'Reintentar')}
        </Button>
        <Button kind="secondary" onClick={() => navigate({ to: `${globalThis.spaBase}/fua-request` })}>
          {t('openFuaManagement', 'Abrir gestión FUA')}
        </Button>
      </div>
    </div>
  ) : !fuaId ? (
    <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <p>
        {t(
          'noFuaForCurrentVisit',
          'No hay un FUA registrado para la visita actual. Abra la gestión FUA para revisar o generar el documento en el backend.',
        )}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Button kind="secondary" onClick={() => navigate({ to: `${globalThis.spaBase}/fua-request` })}>
          {t('openFuaManagement', 'Abrir gestión FUA')}
        </Button>
        <Button kind="primary" onClick={() => setRetrySeed((seed) => seed + 1)}>
          {t('retry', 'Reintentar')}
        </Button>
      </div>
    </div>
  ) : (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FuaHtmlViewer fuaId={fuaId} />
    </div>
  );

  if (isWorkspace2Props(props)) {
    return <Workspace2 title={t('createFuaWorkspaceTitle', 'Crear FUA')}>{content}</Workspace2>;
  }

  return content;
};

const FuaEncounterWorkspace: React.FC<FuaEncounterWorkspaceProps> = (props) => (
  <RequirePrivilege privilege={fuaReadPrivilege}>
    <FuaEncounterWorkspaceContent {...props} />
  </RequirePrivilege>
);

export default FuaEncounterWorkspace;
