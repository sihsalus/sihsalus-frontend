import { Button, DataTableSkeleton } from '@carbon/react';
import { ErrorState, showModal, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../config-schema';
import { deleteEncounter } from './encounter.resource';
import PsychologyTable from './psychology-table.component';
import { psychologyTableHeader, useEncounters } from './useEncounters';

type PsychologyDashboardProps = { patientUuid: string };

const patientFormEntryWorkspace = 'patient-form-entry-workspace';

const PsychologyDashboard: React.FC<PsychologyDashboardProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { encounterTypeUuid, formUuid } = useConfig<ConfigObject>();
  const { encounters, isLoading, error, mutate } = useEncounters(encounterTypeUuid, formUuid, patientUuid);
  const clinicalFormTitle = t('psicologia', 'Psicología');

  const launchPsychologyForm = (encounterUuid = '') => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      workspaceTitle: clinicalFormTitle,
      mutateForm: mutate,
      formInfo: {
        patientUuid,
        encounterUuid,
        formUuid,
        additionalProps: {},
      },
    });
  };

  const handleDeleteEncounter = React.useCallback(
    (encounterUuid: string, encounterTypeName?: string) => {
      const close = showModal('delete-encounter-modal', {
        close: () => close(),
        encounterTypeName: encounterTypeName || clinicalFormTitle,
        onConfirmation: () => {
          const abortController = new AbortController();
          deleteEncounter(encounterUuid, abortController)
            .then(() => {
              mutate?.();
              showSnackbar({
                isLowContrast: true,
                title: t('encounterDeleted', 'Encounter deleted'),
                subtitle: t('encounterSuccessfullyDeleted', 'Encounter successfully deleted'),
                kind: 'success',
              });
            })
            .catch(() => {
              showSnackbar({
                isLowContrast: false,
                title: t('error', 'Error'),
                subtitle: t('encounterDeleteFailed', "Encounter couldn't be deleted"),
                kind: 'error',
              });
            });
          close();
        },
      });
    },
    [clinicalFormTitle, mutate, t],
  );

  if (isLoading) {
    return (
      <DataTableSkeleton
        headers={psychologyTableHeader}
        aria-label={t('psychologyEncounters', 'Psychology encounters')}
      />
    );
  }

  if (error) {
    return <ErrorState headerTitle={clinicalFormTitle} error={error} />;
  }

  if (encounters.length === 0) {
    return (
      <EmptyState
        headerTitle={clinicalFormTitle}
        displayText={clinicalFormTitle}
        launchForm={() => launchPsychologyForm()}
      />
    );
  }

  return (
    <div>
      <CardHeader title={clinicalFormTitle}>
        <Button onClick={() => launchPsychologyForm()} kind="ghost">
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <PsychologyTable
        encounters={encounters}
        onEdit={launchPsychologyForm}
        onDelete={handleDeleteEncounter}
        headers={psychologyTableHeader}
      />
    </div>
  );
};

export default PsychologyDashboard;
