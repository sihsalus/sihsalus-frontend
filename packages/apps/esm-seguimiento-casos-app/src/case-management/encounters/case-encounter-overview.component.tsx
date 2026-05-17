import { ComboBox, DataTableSkeleton, Dropdown, Layer, Pagination, Tile } from '@carbon/react';
import { formatDate, launchWorkspace, showModal, showSnackbar, useConfig, usePagination } from '@openmrs/esm-framework';
import { CardHeader, EmptyDataIllustration, usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { KeyedMutator } from 'swr';

import type { ConfigObject } from '../../config-schema';
import { patientFormEntryWorkspace } from '../../utils/constants';

import styles from './case-encounter-header.scss';
import { deleteEncounter, useInfiniteVisits } from './case-encounter-table.resource';
import CaseEncounterTable from './components/case-encounter-table.component';

interface CaseEncounterProps {
  mutate: KeyedMutator<unknown>;
  patientUuid: string;
  onFilterChange: (formUuid: string) => void;
}

interface CaseEncounterOverviewComponentProps {
  patientUuid: string;
}

const CaseEncounterHeader = ({ patientUuid, mutate, onFilterChange }: CaseEncounterProps) => {
  const { t } = useTranslation();
  const title = t('caseEncounter', 'Seguimiento clínico del caso');
  const { caseManagementForms } = useConfig<ConfigObject>();

  const handleOpenOrEditClinicalEncounterForm = (formUuid: string, encounterUUID = '') => {
    launchWorkspace(patientFormEntryWorkspace, {
      workspaceTitle: t('caseMonitoringEncounter', 'Atención de seguimiento'),
      mutateForm: mutate,
      formInfo: {
        encounterUuid: encounterUUID,
        formUuid,
        patientUuid,
        visitTypeUuid: '',
        visitUuid: '',
      },
    });
  };

  const items = caseManagementForms.map((form) => ({
    id: form.id,
    text: form.title,
    formUuid: form.formUuid,
    filterUuid: form.formUuid,
  }));

  const handleComboBoxChange = ({ selectedItem }) => {
    if (selectedItem) {
      handleOpenOrEditClinicalEncounterForm(selectedItem.formUuid);
    }
  };

  const handleEncounterTypeChange = ({ selectedItem }) => {
    onFilterChange(selectedItem.filterUuid);
  };

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={title}>
        <div className={styles.elementContainer}>
          <Dropdown
            id="serviceFilter"
            initialSelectedItem={{ text: t('all', 'All'), filterUuid: '' }}
            label=""
            titleText={t('filterByForm', 'Filter by form') + ':'}
            type="inline"
            items={[{ text: t('all', 'All'), filterUuid: '' }, ...items]}
            itemToString={(item) => (item ? item.text : '')}
            onChange={handleEncounterTypeChange}
            size="lg"
          />
          <ComboBox
            onChange={handleComboBoxChange}
            id="select-form"
            items={items}
            itemToString={(item) => (item ? item.text : '')}
            placeholder={t('selectForms', 'Select forms')}
            className={styles.comboBox}
          />
        </div>
      </CardHeader>
    </div>
  );
};

const CaseEncounterOverviewComponent = ({ patientUuid }: CaseEncounterOverviewComponentProps): JSX.Element => {
  const { visits, isLoading, mutateVisits } = useInfiniteVisits(patientUuid);
  const { t } = useTranslation();
  const { caseManagementForms } = useConfig<ConfigObject>();
  const [filterFormUuid, setFilterFormUuid] = useState('');
  const [pageSize, setPageSize] = useState(10);

  const formUuids = caseManagementForms.map((form) => form.formUuid);

  const filteredEncounters =
    visits
      ?.flatMap((visit) => visit.encounters)
      .filter((encounter) =>
        filterFormUuid ? encounter.form?.uuid === filterFormUuid : formUuids.includes(encounter.form?.uuid),
      ) || [];

  const visitTypeMap = visits?.reduce(
    (acc, visit) => {
      visit.encounters.forEach((encounter) => {
        acc[encounter.uuid] = visit.visitType?.display ?? '--';
      });
      return acc;
    },
    {} as Record<string, string>,
  );

  const { results, totalPages, currentPage, goTo } = usePagination(filteredEncounters, pageSize);
  const { pageSizes } = usePaginationInfo(pageSize, totalPages, currentPage, results.length);

  const genericTableHeader = [
    { header: t('date', 'Date'), key: 'encounterDatetime' },
    { header: t('visitType', 'Visit Type'), key: 'visitType' },
    { header: t('encounterType', 'Encounter type'), key: 'encounterType' },
    { header: t('formName', 'Form name'), key: 'formName' },
  ];

  const rows = results.map((encounter) => ({
    id: `${encounter.uuid}`,
    encounterDatetime: formatDate(new Date(encounter.encounterDatetime)),
    visitType: visitTypeMap[encounter.uuid] ?? '--',
    encounterType: encounter.encounterType?.display ?? '--',
    formName: encounter.form?.display ?? encounter.form?.name ?? '--',
  }));

  const handleWorkspaceEditForm = (encounterUuid: string) => {
    const encounter = results.find((enc) => enc.uuid === encounterUuid);
    const workspaceTitle = encounter.form?.display ?? encounter.form?.name ?? '';
    const encounterTypeUuid = encounter.encounterType?.uuid ?? '';
    const formUuid = encounter.form?.uuid ?? '';

    launchWorkspace(patientFormEntryWorkspace, {
      workspaceTitle,
      mutateForm: mutateVisits,
      formInfo: {
        encounterUuid,
        formUuid,
        additionalProps: {
          encounterTypeUuid,
        },
      },
    });
  };

  const handleDeleteEncounter = React.useCallback(
    (encounterUuid: string, encounterTypeName?: string) => {
      const close = showModal('delete-encounter-modal', {
        close: () => close(),
        encounterTypeName: encounterTypeName || '',
        onConfirmation: () => {
          const abortController = new AbortController();
          deleteEncounter(encounterUuid, abortController)
            .then(() => {
              mutateVisits?.();
              showSnackbar({
                isLowContrast: true,
                title: t('encounterDeleted', 'Encounter deleted'),
                subtitle: `Encounter ${t('successfullyDeleted', 'successfully deleted')}`,
                kind: 'success',
              });
            })
            .catch(() => {
              showSnackbar({
                isLowContrast: false,
                title: t('error', 'Error'),
                subtitle: `Encounter ${t('failedDeleting', "couldn't be deleted")}`,
                kind: 'error',
              });
            });
          close();
        },
      });
    },
    [t, mutateVisits],
  );

  if (isLoading) {
    return <DataTableSkeleton rowCount={10} />;
  }

  return (
    <>
      <CaseEncounterHeader patientUuid={patientUuid} mutate={mutateVisits} onFilterChange={setFilterFormUuid} />
      {filteredEncounters.length === 0 ? (
        <Layer>
          <Tile className={styles.tile}>
            <EmptyDataIllustration />
            <p className={styles.content}>
              {t('noEncounterToDisplay', 'There are no encounters to display for this patient.')}
            </p>
          </Tile>
        </Layer>
      ) : (
        <div className={styles.widgetContainer}>
          <CaseEncounterTable
            encounters={results}
            onEdit={handleWorkspaceEditForm}
            onDelete={handleDeleteEncounter}
            headers={genericTableHeader}
            rows={rows}
          />
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            pageSizes={pageSizes}
            totalItems={filteredEncounters.length}
            onChange={({ page, pageSize }) => {
              goTo(page);
              setPageSize(pageSize);
            }}
          />
        </div>
      )}
    </>
  );
};

export default CaseEncounterOverviewComponent;
