import {
  DataTable,
  DataTableSkeleton,
  IconButton,
  Pagination,
  Table,
  TableBatchActions,
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
import { Edit } from '@carbon/react/icons';
import { isDesktop, restBaseUrl } from '@openmrs/esm-framework';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceRepresentation } from '../core/api/api';
import { type CustomTableHeader } from '../core/components/table/types';
import { useDebounce } from '../core/hooks/debounce-hook';
import { type StockItemDTO } from '../core/api/types/stockItem/StockItem';
import { handleMutate } from '../utils';
import AddStockItemsBulktImportActionButton from './add-bulk-stock-item/add-stock-items-bulk-import-action-button.component';
import AddStockItemActionButton from './add-stock-item/add-stock-action-button.component';
import FilterStockItems from './components/filter-stock-items/filter-stock-items.component';
import EditStockItemActionsMenu from './edit-stock-item/edit-stock-item-action-menu.component';
import { launchAddOrEditStockItemWorkspace } from './stock-item.utils';
import { stockItemCreatedEvent, type StockItemCreatedEventDetail } from './stock-items.events';
import { useStockItemsPages } from './stock-items-table.resource';
import styles from './stock-items-table.scss';

interface StockItemsTableProps {
  from?: string;
}

const StockItemsTableComponent: React.FC<StockItemsTableProps> = () => {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [recentlyCreatedStockItem, setRecentlyCreatedStockItem] = useState<StockItemDTO | null>(null);

  const handleRefresh = () => {
    handleMutate(`${restBaseUrl}/stockmanagement/stockitem`);
  };

  const {
    currentPage,
    currentPageSize,
    isDrug,
    isLoading,
    items,
    pageSizes,
    setCurrentPage,
    setDrug,
    setPageSize,
    setSearchString,
    totalCount,
  } = useStockItemsPages(ResourceRepresentation.Full);

  const handleSearch = (query: string) => {
    setSearchInput(query);
  };

  const debouncedSearch = useDebounce((query: string) => {
    setSearchString(query);
  }, 1000);

  useEffect(() => {
    debouncedSearch(searchInput);
  }, [searchInput, debouncedSearch]);

  useEffect(() => {
    const handleStockItemCreated = (event: Event) => {
      const { stockItem } = (event as CustomEvent<StockItemCreatedEventDetail>).detail ?? {};
      if (!stockItem?.uuid) {
        return;
      }

      setCurrentPage(1);
      setRecentlyCreatedStockItem(stockItem);
    };

    globalThis.addEventListener(stockItemCreatedEvent, handleStockItemCreated);
    return () => globalThis.removeEventListener(stockItemCreatedEvent, handleStockItemCreated);
  }, [setCurrentPage]);

  const displayedItems = useMemo(() => {
    if (!recentlyCreatedStockItem || currentPage !== 1) {
      return items ?? [];
    }

    const itemMatchesFilter =
      isDrug === '' ||
      (isDrug === 'true' && !!recentlyCreatedStockItem.drugUuid) ||
      (isDrug === 'false' && !recentlyCreatedStockItem.drugUuid);
    const normalizedSearch = searchInput.trim().toLowerCase();
    const itemMatchesSearch =
      !normalizedSearch ||
      [
        recentlyCreatedStockItem.commonName,
        recentlyCreatedStockItem.drugName,
        recentlyCreatedStockItem.conceptName,
        recentlyCreatedStockItem.acronym,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));

    if (!itemMatchesFilter || !itemMatchesSearch) {
      return items ?? [];
    }

    const itemsWithoutDuplicate = (items ?? []).filter((item) => item.uuid !== recentlyCreatedStockItem.uuid);
    return [recentlyCreatedStockItem, ...itemsWithoutDuplicate].slice(0, currentPageSize);
  }, [currentPage, currentPageSize, isDrug, items, recentlyCreatedStockItem, searchInput]);

  const tableHeaders = useMemo(
    () => [
      {
        id: 0,
        header: t('type', 'Type'),
        key: 'type',
      },
      {
        id: 1,
        header: t('genericName', 'Generic name'),
        key: 'genericName',
      },
      {
        id: 2,
        header: t('commonName', 'Common name'),
        key: 'commonName',
      },
      {
        id: 3,
        header: t('tradeName', 'Trade name'),
        key: 'tradeName',
      },
      {
        id: 4,
        header: t('dispensingUnitName', 'Dispensing UoM'),
        key: 'dispensingUnitName',
      },
      {
        id: 5,
        header: t('defaultStockOperationsUoMName', 'Bulk packaging'),
        key: 'defaultStockOperationsUoMName',
      },
      {
        id: 6,
        header: t('reorderLevel', 'Reorder level'),
        key: 'reorderLevel',
      },
      {
        id: 7,
        header: t('actions', 'Actions'),
        key: 'actions',
      },
    ],
    [t],
  );

  const tableRows = useMemo(() => {
    return displayedItems?.map((stockItem, index) => ({
      ...stockItem,
      id: stockItem?.uuid,
      key: `key-${stockItem?.uuid}`,
      uuid: `${stockItem?.uuid}`,
      type: stockItem?.drugUuid ? t('drug', 'Drug') : t('other', 'Other'),
      genericName: <EditStockItemActionsMenu data={displayedItems[index]} />,
      commonName: stockItem?.commonName,
      tradeName: stockItem?.drugUuid ? stockItem?.conceptName : '',
      preferredVendorName: stockItem?.preferredVendorName,
      dispensingUoM: stockItem?.defaultStockOperationsUoMName,
      dispensingUnitName: stockItem?.dispensingUnitName,
      defaultStockOperationsUoMName: stockItem?.defaultStockOperationsUoMName,
      reorderLevel:
        stockItem?.reorderLevelUoMName && stockItem?.reorderLevel
          ? `${stockItem?.reorderLevel?.toLocaleString()} ${stockItem?.reorderLevelUoMName}`
          : '',
      actions: (
        <IconButton
          kind="ghost"
          label={t('editStockItem', 'Edit stock item')}
          onClick={() => {
            stockItem.isDrug = !!stockItem.drugUuid;
            launchAddOrEditStockItemWorkspace(t, stockItem);
          }}
        >
          <Edit size={16} />
        </IconButton>
      ),
    }));
  }, [displayedItems, t]);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  return (
    <>
      <h2 className={styles.tableHeader}>
        {t('stockItemsTableHeader', 'Drugs and other stock items managed by the system.')}
      </h2>
      <DataTable rows={tableRows} headers={tableHeaders} isSortable useZebraStyles>
        {({ rows, headers, getHeaderProps, getTableProps, getRowProps, getBatchActionProps }) => (
          <TableContainer>
            <TableToolbar
              style={{
                position: 'static',
                overflow: 'visible',
                backgroundColor: 'color',
              }}
            >
              <TableBatchActions {...getBatchActionProps()} />
              <TableToolbarContent
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <TableToolbarSearch
                  onChange={(e) =>
                    handleSearch(typeof e === 'string' ? e : (e as React.ChangeEvent<HTMLInputElement>).target.value)
                  }
                  persistent
                  placeholder={t('searchStockItems', 'Search stock items')}
                  value={searchInput}
                />
                <FilterStockItems filterType={isDrug} changeFilterType={setDrug} />
                <AddStockItemsBulktImportActionButton />
                <TableToolbarMenu data-testid="stock-items-menu">
                  <TableToolbarAction className={styles.toolbarAction} onClick={handleRefresh}>
                    {t('refresh', 'Refresh')}
                  </TableToolbarAction>
                </TableToolbarMenu>
                <AddStockItemActionButton />
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
                          isSortable={header.key !== 'name'}
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
                  <TableHeader />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  return (
                    <React.Fragment key={row.id}>
                      <TableRow
                        {...getRowProps({ row })}
                        className={isDesktop ? styles.desktopRow : styles.tabletRow}
                        key={row.id}
                      >
                        {row.cells.map(
                          (cell) =>
                            cell?.info?.header !== 'details' && <TableCell key={cell.id}>{cell.value}</TableCell>,
                        )}
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {rows.length === 0 ? (
              <div className={styles.tileContainer}>
                <Tile className={styles.tile}>
                  <div className={styles.tileContent}>
                    <p className={styles.content}>{t('noStockItemsToDisplay', 'No stock items to display')}</p>
                    <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
                  </div>
                </Tile>
              </div>
            ) : null}
          </TableContainer>
        )}
      </DataTable>
      <Pagination
        className={styles.paginationOverride}
        backwardText={t('previousPage', 'Pagina anterior')}
        forwardText={t('nextPage', 'Pagina siguiente')}
        itemsPerPageText={t('itemsPerPage', 'Elementos por pagina:')}
        itemRangeText={(min, max, total) => `${min}-${max} ${t('of', 'de')} ${total} ${t('items', 'elementos')}`}
        pageNumberText={t('pageNumber', 'Numero de pagina')}
        pageRangeText={(current, total) =>
          `${t('of', 'de')} ${total} ${total === 1 ? t('page', 'pagina') : t('pages', 'paginas')}`
        }
        onChange={({ page, pageSize }) => {
          setCurrentPage(pageSize === currentPageSize ? page : 1);
          setPageSize(pageSize);
        }}
        page={currentPage}
        pageSize={currentPageSize}
        pageSizes={pageSizes}
        totalItems={totalCount}
      />
    </>
  );
};

export default StockItemsTableComponent;
