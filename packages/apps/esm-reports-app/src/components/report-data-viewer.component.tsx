import {
  Button,
  Checkbox,
  DataTable,
  FormGroup,
  Modal,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Download } from '@carbon/react/icons';
import { formatDatetime, getCoreTranslation, isDesktop, parseDate, useLayoutType } from '@openmrs/esm-framework';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './reports.scss';

interface ReportDataViewerProps {
  reportData: unknown;
}

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZES = [10, 20, 30, 40, 50];

const ReportDataViewer: React.FC<ReportDataViewerProps> = ({ reportData }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({});

  const reportDataRecord = reportData as Record<string, unknown>;

  // Get the first dataset since we're only handling one dataset for now
  const dataset = useMemo(() => {
    const dataSets = reportDataRecord?.dataSets as Array<Record<string, unknown>>;
    return dataSets?.[0];
  }, [reportDataRecord]);

  const columns = useMemo(() => {
    const metadata = dataset?.metadata as Record<string, unknown>;
    return (metadata?.columns as Array<Record<string, unknown>>) || [];
  }, [dataset]);

  const rows = useMemo(() => {
    return (dataset?.rows as Array<Record<string, unknown>>) || [];
  }, [dataset]);

  // Initialize selected columns when columns change
  React.useEffect(() => {
    const initialSelection = columns.reduce<Record<string, boolean>>((acc, col) => {
      acc[col.name as string] = true; // Select all columns by default
      return acc;
    }, {});
    setSelectedColumns(initialSelection);
  }, [columns]);

  const handleColumnToggle = (columnName: string) => {
    setSelectedColumns((prev) => ({
      ...prev,
      [columnName]: !prev[columnName],
    }));
  };

  function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Handle object values that have size and memberIds properties
    if (typeof value === 'object' && 'size' in value) {
      return (value as { size: { toString(): string } }).size.toString();
    }

    // Handle date strings
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return formatDatetime(parseDate(value));
    }

    return String(value);
  }

  /**
   * Wraps a CSV cell value in double quotes and escapes internal quotes.
   * Strips leading formula characters (=, @, +, -, tab, CR) to prevent
   * CSV injection when the file is opened in spreadsheet applications.
   */
  const toCsvCell = (raw: unknown): string => {
    let str: string;
    if (Array.isArray(raw)) {
      if (raw.length >= 3 && raw.length <= 6) {
        const [year, month, day, hour = 0, minute = 0, second = 0] = raw as number[];
        str = formatDatetime(new Date(year, month - 1, day, hour, minute, second));
      } else {
        str = raw.join(' ');
      }
    } else {
      str = raw == null ? '' : String(raw);
    }
    // Strip leading characters that spreadsheet apps treat as formula triggers
    str = str.replace(/^[\t\r=+\-@]/, "'$&");
    // Always quote and escape internal double quotes
    return `"${str.replace(/"/g, '""')}"`;
  };

  const exportToCSV = () => {
    // Filter selected columns
    const selectedColumnNames = Object.entries(selectedColumns)
      .filter(([_, selected]) => selected)
      .map(([name]) => name);

    const selectedColumnsData = columns.filter((col) => selectedColumnNames.includes(col.name as string));

    // Create CSV header (labels are developer-controlled, but quote them for safety)
    const header = selectedColumnsData.map((col) => toCsvCell(col.label)).join(',');

    // Create CSV rows
    const csvRows = rows.map((row) => {
      return selectedColumnsData.map((col) => toCsvCell(row[col.name as string])).join(',');
    });

    // Combine header and rows
    const csvContent = [header, ...csvRows].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    try {
      link.setAttribute('href', url);
      const definition = reportDataRecord?.definition as Record<string, unknown>;
      link.setAttribute('download', `${(definition?.name as string) || 'report'}.csv`);
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }

    setShowExportModal(false);
  };

  // Calculate pagination
  const totalItems = rows.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = rows.slice(startIndex, endIndex);

  // Transform the data into a format that Carbon's DataTable can understand
  const tableRows = paginatedRows.map((row, index) => ({
    id: index.toString(),
    ...row,
  }));

  const tableHeaders = columns.map((column) => ({
    key: column.name as string,
    header: column.label as string,
  }));

  const definition = reportDataRecord?.definition as Record<string, unknown>;

  return (
    <div className={styles.reportDataViewer}>
      <div className={styles.reportDataViewerHeader}>
        <h3>{(definition?.name as string) || t('reportData', 'Report Data')}</h3>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Download}
          iconDescription={t('exportCSV', 'Export CSV')}
          onClick={() => setShowExportModal(true)}
        >
          {t('exportCSV', 'Export CSV')}
        </Button>
      </div>
      <div className={styles.reportDataViewerContent}>
        <DataTable rows={tableRows} headers={tableHeaders} isSortable>
          {({ rows, headers }) => (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader key={header.key}>{header.header}</TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{formatCellValue(cell.value)}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={headers.length} className={styles.emptyTableMessage}>
                        {t('noDataAvailable', 'No data available')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
        <Pagination
          backwardText={t('previousPage', 'Previous page')}
          forwardText={t('nextPage', 'Next page')}
          page={currentPage}
          pageSize={pageSize}
          pageSizes={DEFAULT_PAGE_SIZES}
          totalItems={totalItems}
          size={isDesktop(layout) ? 'sm' : 'lg'}
          onChange={({ pageSize: newPageSize, page: newPage }) => {
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
            }

            if (newPage !== currentPage) {
              setCurrentPage(newPage);
            }
          }}
        />
      </div>

      <Modal
        open={showExportModal}
        modalHeading={t('selectColumns', 'Select Columns to Export')}
        primaryButtonText={t('export', 'Export')}
        secondaryButtonText={getCoreTranslation('cancel')}
        onRequestClose={() => setShowExportModal(false)}
        onRequestSubmit={exportToCSV}
      >
        <FormGroup legendText={t('availableColumns', 'Available Columns')}>
          {columns.map((column) => (
            <Checkbox
              key={column.name as string}
              id={column.name as string}
              labelText={column.label as string}
              checked={selectedColumns[column.name as string]}
              onChange={() => handleColumnToggle(column.name as string)}
            />
          ))}
        </FormGroup>
      </Modal>
    </div>
  );
};

export default ReportDataViewer;
