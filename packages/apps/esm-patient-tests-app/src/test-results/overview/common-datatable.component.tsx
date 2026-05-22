/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
import { useLayoutType } from '@openmrs/esm-framework';
import { type OBSERVATION_INTERPRETATION } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import * as React from 'react';

import styles from './common-datatable.scss';
import { type OverviewPanelData } from './useOverviewData';

interface CommonDataTableProps {
  data: Array<OverviewPanelData>;
  tableHeaders: Array<{
    key: string;
    header: string;
  }>;
  title?: string;
  toolbar?: React.ReactNode;
  description?: React.ReactNode;
}

const CommonDataTable: React.FC<CommonDataTableProps> = ({ title, data, description, toolbar, tableHeaders }) => {
  const interpretationToCSS = {
    OFF_SCALE_HIGH: 'offScaleHigh',
    CRITICALLY_HIGH: 'criticallyHigh',
    HIGH: 'high',
    OFF_SCALE_LOW: 'offScaleLow',
    CRITICALLY_LOW: 'criticallyLow',
    LOW: 'low',
    NORMAL: '',
  };

  const isTablet = useLayoutType() === 'tablet';

  const getInterpretation = (value: unknown): OBSERVATION_INTERPRETATION | undefined => {
    if (value && typeof value === 'object' && 'interpretation' in value) {
      const interpretation = value.interpretation;
      return typeof interpretation === 'string' ? (interpretation as OBSERVATION_INTERPRETATION) : undefined;
    }

    return undefined;
  };

  const getDisplayValue = (value: unknown) => {
    if (value && typeof value === 'object' && 'value' in value) {
      return value.value as React.ReactNode;
    }

    return value as React.ReactNode;
  };

  return (
    <DataTable rows={data} headers={tableHeaders} size="sm" useZebraStyles>
      {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }) => (
        <TableContainer
          className={classNames(styles.tableContainer, isTablet ? styles.tablet : styles.desktop)}
          title={title}
          description={description}
          {...getTableContainerProps()}
        >
          {toolbar}
          <Table {...getTableProps()} isSortable>
            <colgroup className={styles.columns}>
              <col span={1} />
              <col span={1} />
              <col span={1} />
            </colgroup>
            <TableHead>
              <TableRow>
                {headers.map((header) => {
                  const { key, ...headerProps } = getHeaderProps({ header });
                  return (
                    <TableHeader key={key} {...headerProps} isSortable>
                      {header.header}
                    </TableHeader>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => {
                const { key, ...rowProps } = getRowProps({ row });
                return (
                  <TypedTableRow key={key} interpretation={getInterpretation(data[i]?.value)} {...rowProps}>
                    {row.cells.map((cell) => {
                      const interpretation = getInterpretation(cell.value);
                      return interpretation ? (
                        <TableCell className={styles[interpretationToCSS[interpretation]]} key={cell.id}>
                          <span>{getDisplayValue(cell.value)}</span>
                        </TableCell>
                      ) : (
                        <TableCell key={cell.id}>{cell?.value}</TableCell>
                      );
                    })}
                  </TypedTableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataTable>
  );
};

const TypedTableRow: React.FC<
  React.ComponentProps<typeof TableRow> & { interpretation?: OBSERVATION_INTERPRETATION }
> = ({ interpretation, ...props }) => {
  switch (interpretation) {
    case 'OFF_SCALE_HIGH':
      return <TableRow {...props} className={styles['off-scale-high']} />;

    case 'CRITICALLY_HIGH':
      return <TableRow {...props} className={styles['critically-high']} />;

    case 'HIGH':
      return <TableRow {...props} className={styles['high']} />;

    case 'OFF_SCALE_LOW':
      return <TableRow {...props} className={styles['off-scale-low']} />;

    case 'CRITICALLY_LOW':
      return <TableRow {...props} className={styles['critically-low']} />;

    case 'LOW':
      return <TableRow {...props} className={styles['low']} />;

    case 'NORMAL':
    default:
      return <TableRow {...props} />;
  }
};

export default CommonDataTable;
