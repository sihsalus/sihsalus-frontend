import { Button, DataTableSkeleton } from '@carbon/react';
import { ErrorState, showModal, showSnackbar, useConfig, useSession, userHasAccess } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../config-schema';
import { deleteEncounter } from './encounter.resource';
import PhysicalTherapyTable from './physical-therapy-table.component';
import { physicalTherapyTableHeader, useEncounters } from './useEncounters';

type PhysicalTherapyDashboardProps = { patientUuid: string };

const patientFormEntryWorkspace = 'patient-form-entry-workspace';

const PhysicalTherapyDashboard: React.FC<PhysicalTherapyDashboardProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess('app:hoja.clinica.terapiaFisica.editar', session?.user);
  const { encounterTypeUuid, formUuid } = useConfig<ConfigObject>();
  const { encounters, isLoading, error, mutate } = useEncounters(encounterTypeUuid, formUuid, patientUuid);
  const clinicalFormTitle = t('terapiaFisica', 'Terapia Física');

  const launchPhysicalTherapyForm = (encounterUuid = '') => {
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
        headers={physicalTherapyTableHeader}
        aria-label={t('physicalTherapyEncounters', 'Physical therapy encounters')}
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
        launchForm={canEdit ? () => launchPhysicalTherapyForm() : undefined}
      />
    );
  }

  return (
    <div>
      <CardHeader title={clinicalFormTitle}>
        {canEdit ? (
          <Button onClick={() => launchPhysicalTherapyForm()} kind="ghost">
            {t('add', 'Add')}
          </Button>
        ) : null}
      </CardHeader>
      <PhysicalTherapyTable
        canEdit={canEdit}
        encounters={encounters}
        onEdit={launchPhysicalTherapyForm}
        onDelete={handleDeleteEncounter}
        headers={physicalTherapyTableHeader}
      />
    </div>
  );
};

export default PhysicalTherapyDashboard;
