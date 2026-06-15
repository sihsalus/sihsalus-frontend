import {
  Button,
  DataTable,
  DataTableSkeleton,
  Layer,
  Pagination,
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
  Tile,
} from '@carbon/react';
import { Renew, View } from '@carbon/react/icons';
import { formatDate, openmrsFetch, showSnackbar, usePagination } from '@openmrs/esm-framework';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FuaFormatRestURL } from '../constant';
import useFuaFormats, { type FuaFormat } from '../hooks/useFuaFormats';

const loadHtmlInWindow = (targetWindow: Window, html: string) => {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  targetWindow.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  targetWindow.location.href = url;
};

import styles from './fua-request-table.scss';

const formatDateValue = (dateValue: string | null | undefined) => {
  if (!dateValue) {
    return 'N/A';
  }

  return formatDate(new Date(dateValue), { mode: 'standard' });
};

const FuaFormatTable: React.FC = () => {
  const { t } = useTranslation();
  const { fuaFormats, isLoading, isValidating, mutate } = useFuaFormats();
  const [searchString, setSearchString] = useState('');

  const filteredData = useMemo(() => {
    if (!searchString) {
      return fuaFormats;
    }

    const search = searchString.toLowerCase();
    return fuaFormats.filter(
      (format) =>
        format.uuid?.toLowerCase().includes(search) ||
        format.codeName?.toLowerCase().includes(search) ||
        format.createdAt?.toLowerCase().includes(search) ||
        format.updatedAt?.toLowerCase().includes(search),
    );
  }, [fuaFormats, searchString]);

  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPageSize, setPageSize] = useState(10);
  const { results, goTo, currentPage } = usePagination(filteredData ?? [], currentPageSize);

  const handleViewFormat = useCallback(
    async (fuaFormat: FuaFormat) => {
      const fuaWindow = window.open('', '_blank');

      if (!fuaWindow) {
        showSnackbar({
          kind: 'error',
          title: t('errorLoadingFua', 'Error al cargar FUA'),
          subtitle: t('popupBlocked', 'El navegador bloqueo la nueva pestana'),
        });
        return;
      }

      fuaWindow.document.body.textContent = t('loadingFuaDocument', 'Cargando documento FUA...');

      try {
        const response = await openmrsFetch(`${FuaFormatRestURL}/${encodeURIComponent(fuaFormat.uuid)}/render`, {
          method: 'POST',
          headers: {
            Accept: 'text/html',
          },
        });

        const html = await response.text();
        loadHtmlInWindow(fuaWindow, html);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('unknownError', 'Error desconocido');
        fuaWindow.document.body.textContent = errorMessage;
        showSnackbar({
          kind: 'error',
          title: t('errorLoadingFua', 'Error al cargar FUA'),
          subtitle: errorMessage,
        });
      }
    },
    [t],
  );

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const headers = [
    { key: 'uuid', header: t('uuid', 'UUID') },
    { key: 'codeName', header: t('codeName', 'Code name') },
    { key: 'createdAt', header: t('createdAt', 'Fecha de creacion') },
    { key: 'updatedAt', header: t('updatedAt', 'Fecha de actualizacion') },
    { key: 'actions', header: t('actions', 'Acciones') },
  ];

  const rows =
    results?.map((format: FuaFormat) => ({
      id: format.uuid,
      uuid: format.uuid,
      codeName: format.codeName || 'N/A',
      createdAt: formatDateValue(format.createdAt),
      updatedAt: formatDateValue(format.updatedAt),
      actions: format,
    })) ?? [];

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" showHeader={false} showToolbar={false} />;
  }

  return (
    <div className={styles.tableContainer}>
      <DataTable rows={rows} headers={headers} isSortable useZebraStyles size="sm">
        {({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
          <TableContainer className={styles.tableContainer}>
            <TableToolbar>
              <TableToolbarContent className={styles.toolbarContent}>
                <Layer className={styles.toolbarItem}>
                  <TableToolbarSearch
                    expanded
                    onChange={(e) => {
                      setSearchString(typeof e === 'string' ? e : e.target.value);
                    }}
                    placeholder={t('searchThisList', 'Buscar en esta lista')}
                    size="sm"
                  />
                </Layer>
                <Button kind="ghost" size="sm" renderIcon={Renew} onClick={handleRefresh} disabled={isValidating}>
                  {isValidating ? t('refreshing', 'Actualizando...') : t('refresh', 'Actualizar')}
                </Button>
              </TableToolbarContent>
            </TableToolbar>
            <Table
              {...getTableProps()}
              className={styles.table}
              aria-label={t('completedFuas', 'Lista de Formatos FUA')}
            >
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader key={header.key} {...getHeaderProps({ header })} className={styles.tableHeader}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, rowIndex) => {
                  const fuaFormat = results[rowIndex];
                  return (
                    <TableRow key={row.id} {...getRowProps({ row })}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id} className={styles.tableCell}>
                          {cell.info.header === 'actions' ? (
                            <Button
                              kind="ghost"
                              size="sm"
                              renderIcon={View}
                              iconDescription={t('viewFua', 'Ver FUA')}
                              hasIconOnly
                              onClick={() => handleViewFormat(fuaFormat)}
                              tooltipPosition="left"
                            />
                          ) : (
                            cell.value
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {rows.length === 0 ? (
              <div className={styles.tileContainer}>
                <Tile className={styles.tile}>
                  <div className={styles.tileContent}>
                    <p className={styles.content}>{t('noFuaFormatsFound', 'No se encontraron formatos FUA')}</p>
                    <p className={styles.emptyStateHelperText}>
                      {t('checkFilters', 'Por favor revisa los filtros de arriba e intenta de nuevo')}
                    </p>
                  </div>
                </Tile>
              </div>
            ) : null}
          </TableContainer>
        )}
      </DataTable>
      {filteredData.length > 0 && (
        <Pagination
          page={currentPage}
          pageSize={currentPageSize}
          pageSizes={pageSizes}
          totalItems={filteredData.length}
          onChange={({ page, pageSize }) => {
            if (pageSize !== currentPageSize) setPageSize(pageSize);
            goTo(page);
          }}
          className={styles.pagination}
        />
      )}
    </div>
  );
};

export default FuaFormatTable;
