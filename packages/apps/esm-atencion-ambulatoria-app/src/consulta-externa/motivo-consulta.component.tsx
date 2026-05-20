import {
  Button,
  DataTable,
  InlineLoading,
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
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useChiefComplaint } from '../hooks/useChiefComplaint';
import { patientFormEntryWorkspace } from '../utils/constants';
import styles from './consulta-externa-dashboard.scss';

interface MotivoConsultaProps {
  patientUuid: string;
}

const MotivoConsulta: React.FC<MotivoConsultaProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { complaints, isLoading } = useChiefComplaint(patientUuid, config.concepts?.chiefComplaintUuid);

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
      formInfo: {
        patientUuid,
        formUuid: config.formsList?.anamnesisForm ?? config.formsList?.consultaExternaForm,
      },
    });
  };

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Cargando...')} />;
  }

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.tableHeader}>
        <span className={styles.tableHeaderTitle}>
          {t('chiefComplaintHistory', 'Historial de Motivos de Consulta')}
        </span>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleLaunchForm}>
          {t('addChiefComplaint', 'Registrar Motivo')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('noChiefComplaintData', 'No hay motivos de consulta registrados para este paciente.')}</p>
        </div>
      ) : (
        <DataTable rows={rows} headers={headers} size="sm">
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
      )}
    </div>
  );
};

export default MotivoConsulta;
