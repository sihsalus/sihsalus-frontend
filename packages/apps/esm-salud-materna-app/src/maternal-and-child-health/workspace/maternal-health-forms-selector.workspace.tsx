import {
  getSessionStore,
  launchWorkspace2,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  type Session,
  useConfig,
  useOpenmrsFetchAll,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import type { CompletedFormInfo, Form } from '@openmrs/esm-patient-common-lib';
import { ErrorState, FormsSelectorWorkspace } from '@openmrs/esm-patient-common-lib';
import { UnauthorizedState } from '@sihsalus/esm-rbac';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../config-schema';
import { maternalHealthPrivileges, maternalPatientChartPrivilege } from '../../constants';
import { useCurrentPregnancy } from '../../hooks/useCurrentPregnancy';
import { maternalFormKeys, formLabels, formEditPrivileges, type MaternalFormKey } from '../maternal-forms';
import { resolveMaternalForm } from '../../hooks/useMaternalFormLauncher';
import { type DefaultPatientWorkspaceProps, formEntryWorkspace } from '../../types';
import {
  encounterMatchesForm,
  isWithinPregnancyEpisode,
  type MaternalEncounter,
} from '../../utils/pregnancy-episode-utils';

function canEditMaternalForm(session: Session | null | undefined, editPrivilege: string) {
  const user = session?.user;
  return Boolean(
    session?.authenticated &&
      user?.uuid &&
      userHasAccess(maternalPatientChartPrivilege, user) &&
      maternalHealthPrivileges.some(
        ({ view, edit }) => edit === editPrivilege && userHasAccess(view, user) && userHasAccess(edit, user),
      ),
  );
}

const MaternalHealthFormsSelector: React.FC<DefaultPatientWorkspaceProps> = (props) => {
  const { t } = useTranslation('@sihsalus/esm-salud-materna-app');
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const workspaceProps = props.workspaceProps ?? {};
  const patientUuid = (props.patientUuid ?? workspaceProps.patientUuid ?? '') as string;
  const pendingLaunch = useRef<object | null>(null);
  useEffect(
    () => () => {
      pendingLaunch.current = null;
    },
    [],
  );
  const { pregnancyStartDate, isLoading: isPregnancyLoading, error: pregnancyError } = useCurrentPregnancy(patientUuid);
  const encounterUrl = patientUuid
    ? `${restBaseUrl}/encounter?patient=${patientUuid}&v=custom:(uuid,encounterDatetime,form:(uuid,name,display))`
    : null;
  const {
    data: encounterData,
    error: encounterError,
    isLoading: isEncounterLoading,
    mutate: mutateMaternalEncounters,
  } = useOpenmrsFetchAll<MaternalEncounter>(encounterUrl, { fetcher: openmrsFetch });
  const closeWorkspace = (options?: { onWorkspaceClose?: () => void }) => {
    void props.closeWorkspace({ discardUnsavedChanges: true }).then(() => {
      options?.onWorkspaceClose?.();
    });
  };
  const promptBeforeClosing = props.promptBeforeClosing ?? (() => {});
  const closeWorkspaceWithSavedChanges =
    props.closeWorkspaceWithSavedChanges ??
    ((options?: { onWorkspaceClose?: () => void }) => {
      void props.closeWorkspace({ discardUnsavedChanges: false }).then(() => {
        options?.onWorkspaceClose?.();
      });
    });
  const setTitle = props.setTitle ?? (() => {});

  const availableForms = useMemo<Array<CompletedFormInfo>>(() => {
    return maternalFormKeys.reduce<Array<CompletedFormInfo>>((forms, formKey) => {
      const formIdentifier = config.formsList[formKey]?.trim();
      if (!formIdentifier || !canEditMaternalForm(session, formEditPrivileges[formKey])) {
        return forms;
      }

      const label = formLabels[formKey] ?? formIdentifier;
      forms.push({
        form: {
          uuid: formIdentifier,
          name: label,
          display: label,
          version: '1',
          published: true,
          retired: false,
          resources: [],
        },
        associatedEncounters: [],
      });

      return forms;
    }, []);
  }, [config.formsList, session]);
  const formsWithHistory = useMemo<Array<CompletedFormInfo>>(
    () =>
      availableForms.map((formInfo) => {
        const matchingEncounters = (encounterData ?? [])
          .filter(
            (encounter) =>
              encounterMatchesForm(encounter, formInfo.form.uuid) &&
              isWithinPregnancyEpisode(encounter.encounterDatetime, pregnancyStartDate),
          )
          .sort(
            (first, second) =>
              new Date(second.encounterDatetime).getTime() - new Date(first.encounterDatetime).getTime(),
          );
        const associatedEncounters = matchingEncounters.map((encounter) => ({
          uuid: encounter.uuid,
          encounterDatetime: encounter.encounterDatetime,
        }));

        return {
          ...formInfo,
          associatedEncounters,
          lastCompletedDate: associatedEncounters[0]?.encounterDatetime
            ? new Date(associatedEncounters[0].encounterDatetime)
            : undefined,
        };
      }),
    [availableForms, encounterData, pregnancyStartDate],
  );

  const launchForm = useCallback(
    async (form: Form, encounterUuid: string, onFormSubmitted: () => void) => {
      const formKey = maternalFormKeys.find((key) => config.formsList[key]?.trim() === form.uuid);
      if (pendingLaunch.current || !formKey) {
        return;
      }
      const canLaunch = () => {
        const { loaded, session: currentSession } = getSessionStore().getState();
        return (
          loaded &&
          currentSession?.user?.uuid === session?.user?.uuid &&
          canEditMaternalForm(currentSession, formEditPrivileges[formKey])
        );
      };
      if (!canLaunch()) {
        return;
      }

      const request = {};
      pendingLaunch.current = request;
      try {
        const resolvedForm = await resolveMaternalForm(form.uuid, form.display ?? form.name);
        if (pendingLaunch.current !== request || !canLaunch()) {
          return;
        }
        await launchWorkspace2(formEntryWorkspace, {
          form: resolvedForm,
          encounterUuid,
          handlePostResponse: () => {
            onFormSubmitted();
            void mutateMaternalEncounters();
          },
        });
      } catch {
        if (pendingLaunch.current === request && canLaunch()) {
          showSnackbar({
            kind: 'error',
            title: t('maternalFormNotAvailable', 'Formulario materno no disponible'),
            subtitle: t(
              'maternalFormNotAvailableSubtitle',
              'Revise que el formulario esté publicado y que el UUID o nombre configurado sea exacto.',
            ),
          });
        }
      } finally {
        if (pendingLaunch.current === request) {
          pendingLaunch.current = null;
        }
      }
    },
    [config.formsList, mutateMaternalEncounters, session?.user?.uuid, t],
  );

  if (pregnancyError || encounterError) {
    return (
      <ErrorState
        error={pregnancyError ?? encounterError}
        headerTitle={t('maternalHealthForms', 'Formularios de salud materna')}
      />
    );
  }

  if (isPregnancyLoading || isEncounterLoading) {
    return <div role="status">{t('loadingMaternalForms', 'Cargando historial de formularios maternos...')}</div>;
  }

  return (
    <FormsSelectorWorkspace
      availableForms={formsWithHistory}
      patientAge=""
      controlNumber={0}
      patientUuid={patientUuid}
      closeWorkspace={closeWorkspace}
      title={t('maternalHealthForms', 'Formularios de salud materna')}
      subtitle={t(
        'maternalHealthFormsInstructions',
        'Seleccione el formulario de salud materna que desea completar para esta paciente.',
      )}
      backWorkspace={null}
      onFormLaunch={launchForm}
      promptBeforeClosing={promptBeforeClosing}
      closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges}
      setTitle={setTitle}
    />
  );
};

const MaternalHealthFormsSelectorWorkspace: React.FC<DefaultPatientWorkspaceProps> = (props) => {
  const session = useSession();
  const canEdit = maternalHealthPrivileges.some(({ edit }) => canEditMaternalForm(session, edit));

  return canEdit ? (
    <MaternalHealthFormsSelector
      key={String(props.patientUuid ?? props.workspaceProps?.patientUuid ?? '')}
      {...props}
    />
  ) : (
    <UnauthorizedState privilege={maternalPatientChartPrivilege} />
  );
};

export default MaternalHealthFormsSelectorWorkspace;
