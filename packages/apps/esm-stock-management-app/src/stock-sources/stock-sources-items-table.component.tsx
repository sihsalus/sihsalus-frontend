import {
  DataTable,
  DataTableSkeleton,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarAction,
  TableToolbarContent,
  TableToolbarMenu,
  TableToolbarSearch,
  Tile,
} from '@carbon/react';
import { isDesktop, restBaseUrl } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { stockManagementSourcesEditPrivilege } from '../constants';
import { ResourceRepresentation } from '../core/api/api';
import { type CustomTableHeader } from '../core/components/table/types';
import { handleMutate } from '../utils';
import AddStockSourceActionButton from './add-stock-source-button.component';
import EditStockSourceActionsMenu from './edit-stock-source/edit-stock-source.component';
import styles from './stock-sources.scss';
import StockSourcesDeleteActionMenu from './stock-sources-delete/stock-sources-delete.component';
import StockSourcesFilter from './stock-sources-filter/stock-sources-filter.component';
import useStockSourcesPage from './stock-sources-items-table.resource';

const StockSourcesItems: React.FC = () => {
  const { t } = useTranslation();
  const [selectedSourceType, setSelectedSourceType] = React.useState('');

  const handleRefresh = () => {
    handleMutate(`${restBaseUrl}/stockmanagement/stocksource`);
  };

  // get sourcess
  const { items, totalItems, tableHeaders, currentPage, pageSizes, goTo, currentPageSize, setPageSize, isLoading } =
    useStockSourcesPage({
      v: ResourceRepresentation.Default,
      totalCount: true,
    });

  const tableRows = useMemo(() => {
    return items?.map((entry, index) => {
      return {
        ...entry,
        id: entry?.uuid,
        key: `key-${entry?.uuid}`,
        uuid: entry?.uuid,
        name: entry?.name,
        acronym: entry?.acronym,
        sourceType: entry?.sourceType?.display,
        actions: (
          <RequirePrivilege privilege={stockManagementSourcesEditPrivilege} hideUnauthorized>
            <EditStockSourceActionsMenu data={items[index]} />
            <StockSourcesDeleteActionMenu uuid={items[index].uuid} />
          </RequirePrivilege>
        ),
      };
    });
  }, [items]);

  const handleFilterChange = (selectedSourceType: string) => {
    setSelectedSourceType(selectedSourceType);
  };

  const filteredTableRows = useMemo(() => {
    if (!selectedSourceType) {
      return tableRows;
    }
    return tableRows.filter((row) => row.sourceType === selectedSourceType);
  }, [tableRows, selectedSourceType]);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  return (
    <div className={styles.tableOverride}>
      <h2 className={styles.tableHeader}>
        {t('stockSourcesTableHeader', 'List of partners who provide stock to the facility.')}
      </h2>
      <DataTable rows={filteredTableRows} headers={tableHeaders} isSortable useZebraStyles>
        {({ rows, headers, getHeaderProps, getTableProps, getRowProps, onInputChange }) => (
          <TableContainer>
            <TableToolbar
              style={{
                position: 'static',
                overflow: 'visible',
                backgroundColor: 'color',
              }}
            >
              <TableToolbarContent className={styles.toolbarContent}>
                <TableToolbarSearch
                  persistent
                  labelText={t('filterTable', 'Filter table')}
                  placeholder={t('filterTable', 'Filter table')}
                  onChange={onInputChange}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <StockSourcesFilter onFilterChange={handleFilterChange} />
                </div>
                <TableToolbarMenu>
                  <TableToolbarAction className={styles.toolbarMenuAction} onClick={handleRefresh}>
                    {t('refresh', 'Refresh')}
                  </TableToolbarAction>
                </TableToolbarMenu>

                <RequirePrivilege privilege={stockManagementSourcesEditPrivilege} hideUnauthorized>
                  <AddStockSourceActionButton />
                </RequirePrivilege>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map(
                    (header) =>
                      header.key !== 'details' && (
                        <TableHeader
                          {...getHeaderProps({
                            header,
                            isSortable: (header as CustomTableHeader).isSortable,
                          })}
                          className={isDesktop ? styles.desktopHeader : styles.tabletHeader}
                          key={`${header.key}`}
                        >
                          {(() => {
                            const customHeader = header as CustomTableHeader;
                            return typeof customHeader.header === 'object' &&
                              customHeader.header !== null &&
                              'content' in customHeader.header
                              ? (customHeader.header.content as React.ReactNode)
                              : (customHeader.header as React.ReactNode);
                          })()}
                        </TableHeader>
                      ),
                  )}
                  <TableHeader></TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const { key, ...rowProps } = getRowProps({ row }) as React.HTMLAttributes<HTMLTableRowElement> & {
                    key: React.Key;
                  };

                  return (
                    <TableRow key={key} className={isDesktop ? styles.desktopRow : styles.tabletRow} {...rowProps}>
                      {row.cells.map(
                        (cell) => cell?.info?.header !== 'details' && <TableCell key={cell.id}>{cell.value}</TableCell>,
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {rows.length === 0 ? (
              <div className={styles.tileContainer}>
                <Tile className={styles.tile}>
                  <div className={styles.tileContent}>
                    <p className={styles.content}>{t('noSourcesToDisplay', 'No stock sources to display')}</p>
                    <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
                  </div>
                </Tile>
              </div>
            ) : null}
          </TableContainer>
        )}
      </DataTable>
      <Pagination
        page={currentPage}
        pageSize={currentPageSize}
        pageSizes={pageSizes}
        itemsPerPageText={t('itemsPerPage', 'Items per page:')}
        pageNumberText={t('pageNumber', 'Page number')}
        pageRangeText={(_, total) => t('pageRangeText', 'of {{total}} pages', { total })}
        totalItems={totalItems}
        onChange={({ pageSize, page }) => {
          if (pageSize !== currentPageSize) {
            setPageSize(pageSize);
          }
          if (page !== currentPage) {
            goTo(page);
          }
        }}
        className={styles.paginationOverride}
      />
    </div>
  );
};

export default StockSourcesItems;
