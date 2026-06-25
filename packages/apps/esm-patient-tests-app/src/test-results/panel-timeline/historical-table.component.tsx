import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type ObsRecord } from '../../types';

interface HistoricalTableProps {
  conceptUuids: string[];
  groupedObservations: Record<string, Array<ObsRecord>>;
}

const HistoricalTable: React.FC<HistoricalTableProps> = ({ conceptUuids, groupedObservations }) => {
  const { t } = useTranslation();

  const rows = conceptUuids.flatMap((uuid) =>
    (groupedObservations[uuid] ?? []).map((obs) => ({
      id: obs.id ?? `${uuid}-${obs.effectiveDateTime}`,
      name: obs.name ?? uuid,
      value: obs.value,
      date: obs.effectiveDateTime ? formatDate(parseDate(obs.effectiveDateTime)) : '--',
    })),
  );

  if (rows.length === 0) {
    return <p>{t('noResultsAvailable', 'No results available')}</p>;
  }

  return (
    <Table size="sm">
      <TableHead>
        <TableRow>
          <TableHeader>{t('test', 'Test')}</TableHeader>
          <TableHeader>{t('value', 'Value')}</TableHeader>
          <TableHeader>{t('date', 'Date')}</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.value}</TableCell>
            <TableCell>{row.date}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default HistoricalTable;
