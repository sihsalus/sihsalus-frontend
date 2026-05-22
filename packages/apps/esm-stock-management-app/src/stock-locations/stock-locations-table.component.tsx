import {
  Button,
  DataTableSkeleton,
  TableToolbarAction,
  TableToolbarMenu,
  TableToolbarSearch,
  Tile,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { restBaseUrl } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { ResourceRepresentation } from '../core/api/api';
import DataList from '../core/components/table/table.component';
import styles from '../stock-items/stock-items-table.scss';
import { handleMutate } from '../utils';
import NewLocationForm from './add-locations-form.workspace';
import { useStockLocationPages } from './stock-locations-table.resource';

interface StockLocationsTableProps {
  status?: string;
}

const StockLocationsItems: React.FC<StockLocationsTableProps> = () => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [showLocationModal, setAddLocationModal] = useState(false);

  const { tableHeaders, tableRows, items, isLoading } = useStockLocationPages({
    v: ResourceRepresentation.Full,
  });

  const handleRefresh = () => {
    handleMutate(`${restBaseUrl}/Location?_summary=data`);
  };

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (items?.length) {
    return (
      <DataList columns={tableHeaders} data={tableRows}>
        {({ onInputChange }) => (
          <>
            <TableToolbarSearch persistent onChange={onInputChange} />
            <TableToolbarMenu>
              <TableToolbarAction className={styles.toolbarMenuAction} onClick={handleRefresh}>
                {t('refresh', 'Refresh')}
              </TableToolbarAction>
            </TableToolbarMenu>
            {showLocationModal ? (
              <NewLocationForm onModalChange={setAddLocationModal} showModal={showLocationModal} mutate={mutate} />
            ) : null}
            <Button
              kind="ghost"
              renderIcon={(props) => <Add size={16} {...props} />}
              onClick={() => setAddLocationModal(true)}
            >
              {t('createLocation', 'Create Location')}
            </Button>
          </>
        )}
      </DataList>
    );
  }

  return (
    <div className={styles.tileContainer}>
      <Tile className={styles.tile}>
        <p className={styles.content}>{t('noLocationsToDisplay', 'No locations to display')}</p>
      </Tile>
    </div>
  );
};

export default StockLocationsItems;
