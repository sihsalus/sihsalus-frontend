import {
  Button,
  DataTable,
  InlineLoading,
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import {
  CardHeader,
  EmptyState,
  ErrorState,
  getObsFromEncounter,
  launchPatientWorkspace,
} from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { KeyedMutator } from 'swr';
import { mutate } from 'swr';
import type { ConfigObject } from '../../../config-schema';
import type { OpenmrsEncounter } from '../../../types';
import { patientFormEntryWorkspace } from '../../../utils/constants';

interface OutPatientMedicalHistoryProps {
  patientUuid: string;
  encounters: OpenmrsEncounter[];
  isLoading: boolean;
  error: Error;
  isValidating: boolean;
  mutate: KeyedMutator<{ data: { results: OpenmrsEncounter[] } }>;
}
const OutPatientMedicalHistory: React.FC<OutPatientMedicalHistoryProps> = ({
  patientUuid,
  encounters,
  isLoading,
  error,
}) => {
  const { t } = useTranslation();
  const {
    concepts,
    formsList: { clinicalEncounterFormUuid },
  } = useConfig<ConfigObject>();
  const headerTitle = t('medicalHistory', 'Medical History');
  const handleOpenOrEditClinicalEncounterForm = (encounterUUID = '') => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      workspaceTitle: t('medicalHistory', 'Medical History'),
      mutateForm: mutate(
        (key) => typeof key === 'string' && key.startsWith('/openmrs/ws/rest/v1/kenyaemr/flags'),
        undefined,
        {
          revalidate: true,
        },
      ),
      formInfo: {
        encounterUuid: encounterUUID,
        formUuid: clinicalEncounterFormUuid,
        patientUuid,
        visitTypeUuid: '',
        visitUuid: '',
      },
    });
  };
  const tableHeader = [
    {
      key: 'encounterDate',
      header: t('encounterDate', 'Date'),
    },
    {
      key: 'surgicalHistory',
      header: t('surgicalHistory', 'Surgical History'),
    },
    {
      key: 'bloodTransfusion',
      header: t('bloodTransfusion', 'Blood Transfusion'),
    },
    {
      key: 'accidentOrTrauma',
      header: t('accidentOrTrauma', 'Accident or Trauma'),
    },
    {
      key: 'finalDiagnosis',
      header: t('finalDiagnosis', 'Final Diagnosis'),
    },
  ];
  const tableRows = encounters
    ?.map((encounter) => {
      const allFieldsNull = () => {
        return (
          getObsFromEncounter(encounter, concepts.surgicalHistoryUuid) === '--' &&
          getObsFromEncounter(encounter, concepts.bloodTransfusionUuid) === '--' &&
          getObsFromEncounter(encounter, concepts.accidentTraumaUuid) === '--' &&
          encounter.diagnoses.length === 0 &&
          encounter.encounterDatetime !== null
        );
      };
      if (allFieldsNull()) {
        return null;
      }
      return {
        id: `${encounter.uuid}`,
        encounterDate: formatDate(new Date(encounter.encounterDatetime)),
        surgicalHistory: getObsFromEncounter(encounter, concepts.surgicalHistoryUuid),
        bloodTransfusion: getObsFromEncounter(encounter, concepts.bloodTransfusionUuid),
        accidentOrTrauma: getObsFromEncounter(encounter, concepts.accidentTraumaUuid),
        finalDiagnosis: encounter.diagnoses.length > 0 ? encounter.diagnoses[0].diagnosis.coded.display : '--',
        actions: (
          <OverflowMenu aria-label={t('actions', 'Actions')} flipped={false}>
            <OverflowMenuItem
              onClick={() => handleOpenOrEditClinicalEncounterForm(encounter.uuid)}
              itemText={t('edit', 'Edit')}
            />
            <OverflowMenuItem itemText={t('delete', 'Delete')} isDelete />
          </OverflowMenu>
        ),
      };
    })
    .filter((row) => row !== null);
  if (isLoading) {
    return (
      <InlineLoading
        status="active"
        iconDescription={t('loading', 'Loading...')}
        description={t('loadingData', 'Loading data')}
      />
    );
  }
  if (error) {
    return <ErrorState error={error} headerTitle={t('medicalHistory', 'Medical History')} />;
  }
  if (encounters.length === 0) {
    return (
      <EmptyState
        displayText={t('clinicalEncounter', 'Clinical Encounter')}
        headerTitle={t('medicalHistory', 'Medical History')}
        launchForm={handleOpenOrEditClinicalEncounterForm}
      />
    );
  }
  return (
    <>
      <CardHeader title={headerTitle}>
        <Button
          size="md"
          kind="ghost"
          onClick={() => handleOpenOrEditClinicalEncounterForm()}
          renderIcon={(props) => <Add size={24} {...props} />}
          iconDescription={t('add', 'Add')}
        >
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <DataTable
        size="sm"
        rows={tableRows}
        headers={tableHeader}
        render={({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }) => (
          <TableContainer {...getTableContainerProps()}>
            <Table size="sm" {...getTableProps()} aria-label={t('medicalHistory', 'Medical History')}>
              <TableHead>
                <TableRow>
                  {headers.map((header, i) => (
                    <TableHeader
                      key={i}
                      {...getHeaderProps({
                        header,
                      })}
                    >
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    {...getRowProps({
                      row,
                    })}
                  >
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      />
    </>
  );
};
export default OutPatientMedicalHistory;
