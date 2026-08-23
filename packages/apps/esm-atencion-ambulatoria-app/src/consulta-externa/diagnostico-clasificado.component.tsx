import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { formatDate, showSnackbar, useConfig, useLayoutType, useVisit } from '@openmrs/esm-framework';
import { launchPatientWorkspace, launchStartVisitPrompt } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useDiagnosisHistory } from '../hooks/useDiagnosisHistory';
import { consultaExternaEditPrivilege, visitNotesFormWorkspace, visitNotesPrivilege } from '../utils/constants';
import ClinicalHistoryCard from './clinical-history-card.component';

interface DiagnosticoClasificadoProps {
  patientUuid: string;
}

const DiagnosticoClasificado: React.FC<DiagnosticoClasificadoProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const isTablet = useLayoutType() === 'tablet';
  const { currentVisit } = useVisit(patientUuid);
  const { diagnoses, isLoading, isValidating, error, pagination, sourceErrors } = useDiagnosisHistory(patientUuid, [
    config.encounterTypes?.externalConsultation,
    {
      encounterTypeUuid: config.encounterTypes?.visitNote,
      formUuid: config.formsList?.visitNoteFormUuid,
      visitTypeUuid: config.visitTypes?.ambulatory,
    },
  ]);

  const headers = [
    { key: 'date', header: t('dateAndTime', 'Fecha y hora') },
    { key: 'diagnosis', header: t('diagnosis', 'Diagnóstico') },
    { key: 'cie10', header: t('cie10Code', 'CIE-10') },
    { key: 'priority', header: t('diagnosisPriority', 'Prioridad') },
    { key: 'certainty', header: t('certainty', 'Tipo') },
  ];

  const rows = diagnoses.map((dx) => ({
    id: dx.uuid,
    date: formatDate(new Date(dx.encounterDatetime), { time: true }),
    diagnosis: dx.display,
    cie10: dx.cie10Code || '—',
    priority:
      dx.rank === 1 ? (
        <Tag type="red" size="sm">
          {t('primaryDiagnosis', 'Diagnóstico primario')}
        </Tag>
      ) : (
        <Tag type="blue" size="sm">
          {t('secondaryDiagnosis', 'Diagnóstico secundario')}
        </Tag>
      ),
    certainty:
      dx.tipoNts === 'D' ? (
        <Tag type="green" size="sm">
          {t('diagnosisTypeDefinitivo', 'Definitivo')}
        </Tag>
      ) : dx.tipoNts === 'R' ? (
        <Tag type="purple" size="sm">
          {t('diagnosisTypeRepetitivo', 'Repetitivo')}
        </Tag>
      ) : (
        <Tag type="red" size="sm">
          {t('diagnosisTypePresuntivo', 'Presuntivo')}
        </Tag>
      ),
  }));

  const handleLaunchForm = () => {
    if (!currentVisit) {
      launchStartVisitPrompt();
      return;
    }

    const ambulatoryVisitTypeUuid = config.visitTypes?.ambulatory;
    if (!ambulatoryVisitTypeUuid || currentVisit.visitType?.uuid !== ambulatoryVisitTypeUuid) {
      showSnackbar({
        kind: 'error',
        title: t('diagnosisRequiresAmbulatoryVisit', 'An ambulatory visit is required'),
        subtitle: t(
          'diagnosisRequiresAmbulatoryVisitSubtitle',
          'Start or select an ambulatory visit before recording a diagnosis.',
        ),
      });
      return;
    }

    launchPatientWorkspace(visitNotesFormWorkspace, { formContext: 'creating' });
  };

  return (
    <ClinicalHistoryCard
      title={t('diagnosisHistory', 'Historial de Diagnósticos')}
      actionLabel={t('addDiagnosis', 'Registrar Diagnóstico')}
      empty={rows.length === 0}
      emptyDisplayText={t('diagnoses', 'diagnósticos')}
      editPrivilege={[consultaExternaEditPrivilege, visitNotesPrivilege]}
      error={error}
      isLoading={isLoading}
      isValidating={isValidating}
      onAction={handleLaunchForm}
      pagination={pagination}
      sourceErrors={sourceErrors}
      skeletonHeaders={headers}
    >
      <DataTable rows={rows} headers={headers} size={isTablet ? 'lg' : 'sm'}>
        {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer>
            <Table {...getTableProps()} aria-label={t('diagnosisHistory', 'Historial de Diagnósticos')}>
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

export default DiagnosticoClasificado;
