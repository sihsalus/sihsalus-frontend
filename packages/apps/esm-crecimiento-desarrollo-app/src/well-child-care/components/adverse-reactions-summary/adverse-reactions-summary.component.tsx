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
import { Add } from '@carbon/react/icons';
import { launchWorkspace2, useConfig, usePatient } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../../config-schema';
import { useAdverseReactions } from '../../workspace/adverse-reaction/adverse-reaction.resource';

const AdverseReactionsSummary: React.FC = () => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { patientUuid } = usePatient();
  const { reactions, error, isLoading } = useAdverseReactions(patientUuid, config);
  const headerTitle = t('adverseReactions', 'Reacciones Adversas a Vacunas');
  const displayText = t('adverseReactions', 'Reacciones Adversas a Vacunas');

  const launchAdverseReactionForm = useCallback(() => {
    launchWorkspace2('adverse-reaction-form-workspace', {
      patientUuid,
    });
  }, [patientUuid]);

  const tableHeaders = [
    { key: 'occurrenceDate', header: t('occurrenceDate', 'Fecha de ocurrencia') },
    { key: 'vaccineName', header: t('vaccine', 'Vacuna') },
    { key: 'severity', header: t('severity', 'Severidad') },
    { key: 'reactionDescription', header: t('reactionDescription', 'Descripción de la reacción') },
  ];

  if (isLoading) {
    return <DataTableSkeleton size="sm" rowCount={3} columnCount={4} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (!reactions.length) {
    return <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchAdverseReactionForm} />;
  }

  return (
    <div>
      <CardHeader title={headerTitle}>
        <Button kind="ghost" renderIcon={Add} iconDescription={t('add', 'Agregar')} onClick={launchAdverseReactionForm}>
          {t('add', 'Agregar')}
        </Button>
      </CardHeader>
      <DataTable headers={tableHeaders} rows={reactions} size="sm" useZebraStyles>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer>
            <Table {...getTableProps()} aria-label={headerTitle}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });

                    return (
                      <TableHeader key={key ?? header.key} {...headerProps}>
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const { key, ...rowProps } = getRowProps({ row });

                  return (
                    <TableRow key={key ?? row.id} {...rowProps}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

export default AdverseReactionsSummary;
