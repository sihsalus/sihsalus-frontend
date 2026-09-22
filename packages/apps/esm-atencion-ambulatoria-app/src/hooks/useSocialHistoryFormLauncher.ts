import {
  launchWorkspace2,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  useConfig,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { workspace2Store } from '@openmrs/esm-framework/src/internal';
import { usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { patientFormEntryWorkspace, socialHistoryEditPrivilege } from '../utils/constants';
import { useAmbulatoryVisitGuard } from './useAmbulatoryVisitGuard';
import { findSingleEncounterForVisit, resolvePublishedForm } from './useConsultaExternaFormLauncher';
import { socialHistoryRepresentation, type SocialHistoryEncounter } from './useSocialHistory';

/** Both entry points use the canonical form workspace and explicit patient/visit context. */
export function useSocialHistoryFormLauncher(patientUuid: string, mutate?: () => unknown) {
  const { t } = useTranslation();
  const { socialHistory, visitTypes } = useConfig<ConfigObject>();
  const session = useSession();
  const canEdit = userHasAccess(socialHistoryEditPrivilege, session?.user);
  const chart = usePatientChartStore(patientUuid);
  const { requireAmbulatoryVisit, verifiedAmbulatoryVisitUuid } = useAmbulatoryVisitGuard({
    patientUuid,
    ambulatoryVisitTypeUuid: visitTypes?.ambulatory,
  });
  const formUuid = socialHistory?.formUuid;
  const encounterTypeUuid = socialHistory?.encounterTypeUuid;
  const source = useMemo(
    () => ({ patientUuid, formUuid, encounterTypeUuid, verifiedAmbulatoryVisitUuid, canEdit }),
    [patientUuid, formUuid, encounterTypeUuid, verifiedAmbulatoryVisitUuid, canEdit],
  );
  const pending = useRef<{ source: typeof source } | null>(null);
  const opened = useRef<{ identity: string; args: Parameters<typeof launchWorkspace2> } | null>(null);

  useEffect(
    () => () => {
      if (pending.current?.source === source) pending.current = null;
    },
    [source],
  );

  return useCallback(
    async (encounterUuid?: string) => {
      if (pending.current || !canEdit) return false;
      const request = { source };
      pending.current = request;
      try {
        if (!patientUuid || !formUuid || !encounterTypeUuid) throw new Error('missing-content-configuration');
        // Editing keeps the encounter's original visit, including a closed visit.
        let visit: SocialHistoryEncounter['visit'] | null;
        if (encounterUuid) {
          const { data: encounter } = await openmrsFetch<SocialHistoryEncounter>(
            `${restBaseUrl}/encounter/${encodeURIComponent(encounterUuid)}?v=${socialHistoryRepresentation}`,
          );
          if (
            encounter?.uuid !== encounterUuid ||
            encounter.voided !== false ||
            encounter.patient?.uuid !== patientUuid ||
            encounter.form?.uuid !== formUuid ||
            encounter.encounterType?.uuid !== encounterTypeUuid ||
            !encounter.visit?.uuid ||
            !encounter.visit.startDatetime ||
            !encounter.visit.visitType?.uuid
          ) {
            throw new Error('invalid-social-history-encounter');
          }
          visit = encounter.visit;
        } else {
          visit = requireAmbulatoryVisit();
          if (!visit || visit.stopDatetime) return false;
        }
        const form = await resolvePublishedForm(formUuid, encounterTypeUuid);
        if (pending.current !== request) return false;
        const identity = JSON.stringify([patientUuid, visit.uuid, form.uuid, encounterUuid ?? 'active']);
        const previous = opened.current;
        const canRestore =
          previous?.identity === identity &&
          workspace2Store
            .getState()
            .openedWindows.some((window) =>
              window.openedWorkspaces.some(
                (workspace) =>
                  workspace.workspaceName === patientFormEntryWorkspace && workspace.props === previous.args[1],
              ),
            );
        const targetEncounter =
          encounterUuid ?? (await findSingleEncounterForVisit(patientUuid, visit.uuid, encounterTypeUuid, form.uuid));
        if (pending.current !== request) return false;
        const args: Parameters<typeof launchWorkspace2> = canRestore
          ? previous.args
          : [
              patientFormEntryWorkspace,
              {
                workspaceTitle: t('socialHistory', 'Social History'),
                mutateForm: () => {
                  try {
                    void Promise.resolve(mutate?.()).catch(() => undefined);
                  } catch {
                    /* Best-effort cache refresh. */
                  }
                },
                formInfo: {
                  encounterUuid: targetEncounter,
                  formUuid: form.uuid,
                  patientUuid,
                  visitTypeUuid: visit.visitType.uuid,
                  visitUuid: visit.uuid,
                  visitStartDatetime: visit.startDatetime,
                  visitStopDatetime: visit.stopDatetime ?? undefined,
                },
              },
              null,
              {
                patientUuid,
                patient: chart?.patient,
                visitContext: visit,
                mutateVisitContext: chart?.mutateVisitContext,
              },
            ];
        if ((await launchWorkspace2(...args)) !== true) throw new Error('workspace-unavailable');
        opened.current = { identity, args };
        return true;
      } catch {
        if (pending.current === request) {
          showSnackbar({
            kind: 'error',
            title: t('consultationFormOpenError', 'Could not open the clinical form'),
            subtitle: t(
              'socialHistoryFormUnavailable',
              'The social history form could not be verified. Try again or contact your system administrator.',
            ),
          });
        }
        return false;
      } finally {
        if (pending.current === request) pending.current = null;
      }
    },
    [canEdit, chart, encounterTypeUuid, formUuid, mutate, patientUuid, requireAmbulatoryVisit, source, t],
  );
}
