import {
  Button,
  DataTable,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { AddIcon, launchWorkspace2 } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { usePrenatalAntecedents } from '../../../../hooks/usePrenatalAntecedents';

import styles from './prenatal-history.scss';

interface NeonatalSummaryProps {
  patientUuid: string;
}

const PrenatalAntecedents: React.FC<NeonatalSummaryProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const displayText = t('biometrics_lower', 'biometrics');
  const headerTitle = t('prenatalAntecedents', 'Antecedentes Prenatales');

  const { data: formattedObs, isLoading, error } = usePrenatalAntecedents(patientUuid);

  const launchPerinatalForm = useCallback(() => {
    launchWorkspace2('perinatal-register-form', { patientUuid });
  }, [patientUuid]);

  const tableRows = useMemo(() => {
    if (!formattedObs?.length) return [];

    const lastAntecedent = formattedObs[0];

    return [
      {
        id: 'gravidez',
        label: t('gravidez', 'Gravidez'),
        value: lastAntecedent.gravidez || '--',
      },
      {
        id: 'partoAlTermino',
        label: t('partoAlTermino', 'Partos a término'),
        value: lastAntecedent.partoAlTermino || '--',
      },
      {
        id: 'partoPrematuro',
        label: t('partoPrematuro', 'Partos prematuros'),
        value: lastAntecedent.partoPrematuro || '--',
      },
      {
        id: 'partoAborto',
        label: t('partoAborto', 'Abortos'),
        value: lastAntecedent.partoAborto || '--',
      },
      {
        id: 'partoNacidoVivo',
        label: t('partoNacidoVivo', 'Nacidos vivos'),
        value: lastAntecedent.partoNacidoVivo || '--',
      },
    ];
  }, [formattedObs, t]);

  if (isLoading) return <DataTableSkeleton />;
  if (error) return <ErrorState error={error} headerTitle={headerTitle} />;
  if (formattedObs?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <Button kind="ghost" renderIcon={(props) => <AddIcon size={16} {...props} />} onClick={launchPerinatalForm}>
            {t('update', 'Actualizar')}
          </Button>
        </CardHeader>
        <DataTable
          rows={tableRows}
          headers={[
            { key: 'label', header: t('field', 'Field') },
            { key: 'value', header: t('value', 'Value') },
          ]}
          size="sm"
          useZebraStyles
        >
          {({ rows, headers, getHeaderProps, getTableProps }) => (
            <TableContainer>
              <Table {...getTableProps()}>
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
                  {rows.map((row) => (
                    <TableRow key={row.id}>
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
      </div>
    );
  }
  return <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchPerinatalForm} />;
};

export default PrenatalAntecedents;
