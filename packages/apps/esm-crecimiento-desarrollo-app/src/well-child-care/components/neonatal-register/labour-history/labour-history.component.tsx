import {
  DataTable,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { credNeonatalEditPrivilege } from '../../../../constants';
import { useHasPrivilege } from '../../../../rbac';
import { useCurrentPregnancy } from '../../../../hooks/useCurrentPregnancy';
import { formEntryWorkspace } from '../../../../types';

import styles from './labour-history-summary.scss';

// Types
interface LabourHistorySummaryProps {
  patientUuid: string;
}

interface SummaryRow {
  id: string;
  category: string;
  value: string;
}

// Component
const LabourHistorySummary: React.FC<LabourHistorySummaryProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const canEdit = useHasPrivilege(credNeonatalEditPrivilege);

  const headerTitle = t('labourHistorySummary', 'Labour history summary');
  const config = useConfig();
  const { prenatalEncounter: data, error, isLoading } = useCurrentPregnancy(patientUuid);

  // Configuration for form launch
  const formPrenatalUuid = config.formsList.deliveryOrAbortion;

  // Table Headers
  const headers = useMemo(
    () => [
      { header: t('category', 'Category'), key: 'category' },
      { header: t('value', 'Value'), key: 'value' },
    ],
    [t],
  );

  // Summarized Data
  const summaryRows = useMemo(() => {
    if (!data?.obs) return [];

    const rows: SummaryRow[] = [];
    let rowId = 0;

    const addRow = (category: string, value: string) => {
      rows.push({ id: `row-${rowId++}`, category, value });
    };

    data.obs.forEach((obs) => {
      const groupMembers = obs.groupMembers || [];
      switch (obs.display.split(': ')[0]) {
        case 'Datos generales del Embarazo Actual':
          groupMembers.forEach((member) => {
            const [category, value] = member.display.split(': ');
            if (category === 'Talla (cm)') addRow('Height (cm)', value);
            if (category === 'Peso habitual antes del embarazo (Kg)') addRow('Pre-pregnancy Weight (Kg)', value);
            if (category === 'IMC pregestacional') addRow('Pre-pregnancy BMI', value);
            if (category === 'Captada') addRow('Captured', value);
          });
          break;
        case 'FUM':
          groupMembers.forEach((member) => {
            const [category, value] = member.display.split(': ');
            if (category === 'FUM') addRow('Last Menstrual Period', value);
            if (category === 'Edad gestacional actual FUM (semanas)') addRow('Gestational Age (weeks)', value);
            if (category === 'Fecha probable de parto FUM') addRow('Estimated Due Date', value);
          });
          break;
        case 'Antitetánica':
          groupMembers.forEach((member) => {
            const [category, value] = member.display.split(': ');
            if (category === 'N° Dosis previa') addRow('Previous Tetanus Doses', value);
            if (category === '1ra Dosis Antitetánica') addRow('1st Tetanus Dose', value);
            if (category === '2da Dosis Antitetánica') addRow('2nd Tetanus Dose', value);
          });
          break;
        case 'Examen Físico':
          groupMembers.forEach((member) => {
            const [category, value] = member.display.split(': ');
            if (category === 'Clínico') addRow('Clinical Exam', value);
          });
          break;
      }
    });

    return rows;
  }, [data]);

  // Handler to launch form for additional data
  const handleAddLabourDetails = () => {
    launchWorkspace2(formEntryWorkspace, {
      form: { uuid: formPrenatalUuid },
      encounterUuid: '',
    });
  };

  // Skeleton Loader Component
  const SkeletonLoader = () => (
    <div className={styles.skeletonContainer}>
      <SkeletonText heading width="50%" />
      <TableContainer>
        <Table aria-label="Skeleton Table">
          <TableHead>
            <TableRow>
              <TableHeader>
                <SkeletonText width="30%" />
              </TableHeader>
              <TableHeader>
                <SkeletonText width="30%" />
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <SkeletonText width="40%" />
                </TableCell>
                <TableCell>
                  <SkeletonText width="40%" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );

  // Render el error correcto
  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  return (
    <div className={styles.summaryContainer}>
      {isLoading && !data ? (
        <SkeletonLoader />
      ) : summaryRows.length > 0 ? (
        <DataTable rows={summaryRows} headers={headers} size="sm" useZebraStyles>
          {({ headers, getHeaderProps, getTableProps }) => (
            <TableContainer>
              <Table {...getTableProps()} aria-label="Detalles del Embarazo y Parto">
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader key={header.key} {...getHeaderProps({ header })}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summaryRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      ) : (
        <EmptyState
          headerTitle={headerTitle}
          displayText={t('noDataAvailableDescription', 'No data available')}
          launchForm={canEdit ? handleAddLabourDetails : undefined}
        />
      )}
    </div>
  );
};

export default LabourHistorySummary;
