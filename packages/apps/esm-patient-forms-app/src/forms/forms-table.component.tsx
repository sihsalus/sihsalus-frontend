import {
  Button,
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
} from '@carbon/react';
import { EditIcon } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Form } from '../types';

import styles from './forms-table.scss';

interface FormsTableProps {
  tableHeaders: Array<{
    header: string;
    key: string;
  }>;
  tableRows: Array<{
    id: string;
    lastCompleted: string;
    formName: string;
    formUuid: string;
    encounterUuid: string;
    form: Form;
  }>;
  isTablet: boolean;
  handleSearch: (search: string) => void;
  handleFormOpen: (form: Form, encounterUuid?: string) => void;
}

const FormsTable = ({ tableHeaders, tableRows, isTablet, handleSearch, handleFormOpen }: FormsTableProps) => {
  const { t } = useTranslation();
  const rowsById = React.useMemo(() => new Map(tableRows.map((row) => [row.id, row])), [tableRows]);

  return (
    <DataTable rows={tableRows} headers={tableHeaders} size={isTablet ? 'lg' : 'sm'} useZebraStyles>
      {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
        <>
          <TableContainer className={styles.tableContainer}>
            <div className={styles.toolbarWrapper}>
              <TableToolbar className={styles.tableToolbar}>
                <TableToolbarContent>
                  <TableToolbarSearch
                    className={styles.search}
                    expanded
                    onChange={(_, value) => handleSearch(value ?? '')}
                    placeholder={t('searchThisList', 'Search this list')}
                    size="sm"
                  />
                </TableToolbarContent>
              </TableToolbar>
            </div>
            {rows.length > 0 && (
              <Table aria-label="forms" {...getTableProps()} className={styles.table}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader key={header.key} {...getHeaderProps({ header })}>
                        {header.header}
                      </TableHeader>
                    ))}
                    <TableHeader />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const tableRow = rowsById.get(row.id);

                    if (!tableRow) {
                      return null;
                    }

                    return (
                      <TableRow key={row.id} {...getRowProps({ row })}>
                        <TableCell key={row.cells[0].id}>
                          <button
                            type="button"
                            onClick={() => handleFormOpen(tableRow.form, undefined)}
                            className={styles.formNameButton}
                          >
                            {tableRow.formName}
                          </button>
                        </TableCell>
                        <TableCell className={styles.editCell}>
                          {tableRow.encounterUuid ? (
                            <button
                              type="button"
                              onClick={() => handleFormOpen(tableRow.form, tableRow.encounterUuid)}
                              className={styles.formNameButton}
                            >
                              {row.cells[1].value ?? t('never', 'Never')}
                            </button>
                          ) : (
                            <span>{row.cells[1].value ?? t('never', 'Never')}</span>
                          )}
                        </TableCell>
                        <TableCell className="cds--table-column-menu">
                          {tableRow.encounterUuid ? (
                            <Button
                              hasIconOnly
                              renderIcon={EditIcon}
                              aria-label={t('editForm', 'Edit form')}
                              iconDescription={t('editForm', 'Edit form')}
                              onClick={() => handleFormOpen(tableRow.form, tableRow.encounterUuid)}
                              size="sm"
                              kind="ghost"
                              tooltipPosition="left"
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </>
      )}
    </DataTable>
  );
};

export default FormsTable;
