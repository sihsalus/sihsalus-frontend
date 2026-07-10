import {
  DataTable,
  Link,
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
import { useTranslation } from 'react-i18next';

import styles from './forms-table.scss';
import { type Form } from './types';

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
  handleFormOpen?: (form: Form, encounterUuid: string) => void;
}

const FormsTable = ({
  tableHeaders,
  tableRows,
  isTablet,
  handleSearch,
  handleFormOpen,
}: FormsTableProps): JSX.Element => {
  const { t } = useTranslation();
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
                    placeholder={t('searchThisList', 'Buscar en esta lista')}
                    size="sm"
                  />
                </TableToolbarContent>
              </TableToolbar>
            </div>
            {rows.length > 0 && (
              <Table aria-label="forms" {...getTableProps()} className={styles.table}>
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
                  {rows.map((row, i) => {
                    const { key, ...rowProps } = getRowProps({ row });

                    return (
                      <TableRow key={key ?? row.id} {...rowProps}>
                        <TableCell key={row.cells[0].id}>
                          <Link
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              handleFormOpen(tableRows[i].form, tableRows[i].encounterUuid ?? '');
                            }}
                            role="presentation"
                            className={styles.formName}
                          >
                            {tableRows[i]?.formName}
                          </Link>
                        </TableCell>
                        <TableCell className={styles.editCell}>
                          <label>{row.cells[1].value ?? t('never', 'Nunca')}</label>
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
