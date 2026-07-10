import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { formatDate, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useChiefComplaint } from '../hooks/useChiefComplaint';
import { patientFormEntryWorkspace } from '../utils/constants';
import ClinicalHistoryCard from './clinical-history-card.component';

interface MotivoConsultaProps {
  patientUuid: string;
}

const MotivoConsulta: React.FC<MotivoConsultaProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const isTablet = useLayoutType() === 'tablet';
  const { complaints, isLoading, isValidating, error, mutate } = useChiefComplaint(
    patientUuid,
    config.encounterTypes?.externalConsultation,
    config.concepts?.chiefComplaintUuid,
  );

  const headers = [
    { key: 'date', header: t('date', 'Fecha') },
    { key: 'complaint', header: t('chiefComplaint', 'Motivo de Consulta') },
  ];

  const rows = complaints.map((obs) => ({
    id: obs.uuid,
    date: formatDate(new Date(obs.obsDatetime)),
    complaint: obs.display,
  }));

  const handleLaunchForm = () => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      mutateForm: mutate,
      formInfo: {
        patientUuid,
        formUuid: config.formsList?.anamnesisForm ?? config.formsList?.consultaExternaForm,
      },
    });
  };

  return (
    <ClinicalHistoryCard
      title={t('chiefComplaintHistory', 'Historial de Motivos de Consulta')}
      actionLabel={t('addChiefComplaint', 'Registrar Motivo')}
      empty={rows.length === 0}
      emptyDisplayText={t('chiefComplaints', 'motivos de consulta')}
      error={error}
      isLoading={isLoading}
      isValidating={isValidating}
      onAction={handleLaunchForm}
      skeletonHeaders={headers}
    >
      <DataTable rows={rows} headers={headers} size={isTablet ? 'lg' : 'sm'}>
        {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer>
            <Table {...getTableProps()} aria-label={t('chiefComplaintHistory', 'Historial de Motivos de Consulta')}>
              <TableHead>
                <TableRow>
                  {tableHeaders.map((header) => (
                    <TableHeader key={header.key} {...getHeaderProps({ header })}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </ClinicalHistoryCard>
  );
};

export default MotivoConsulta;
