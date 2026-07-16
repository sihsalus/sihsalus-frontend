import { MultiSelect, Search, TabPanel } from '@carbon/react';
import { useConfig, useDebounce } from '@openmrs/esm-framework';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PharmacyConfig } from '../config-schema';
import { useLocations } from '../location/location.resource';
import { type SimpleLocation } from '../types';
import styles from './prescriptions.scss';
import PrescriptionsTable from './prescriptions-table.component';

interface PrescriptionTabPanelProps {
  isTabActive: boolean;
  status?: string;
  customPrescriptionsTableEndpoint?: string;
}

const PrescriptionTabPanel: React.FC<PrescriptionTabPanelProps> = ({
  status,
  isTabActive,
  customPrescriptionsTableEndpoint,
}) => {
  const { t } = useTranslation();
  const config = useConfig<PharmacyConfig>();
  const isInitialized = useRef(false);
  const { locations, isLoading: isFilterLocationsLoading } = useLocations(config);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [filterLocations, setFilterLocations] = useState<SimpleLocation[]>([]);

  // set any initially selected locations
  useEffect(() => {
    if (!isInitialized.current && !isFilterLocationsLoading && config.dispensingLocationUuid) {
      setFilterLocations(
        locations?.filter((location) => config.dispensingLocationUuid === location.associatedPharmacyLocation) || [],
      );
      isInitialized.current = true; // we only want to run when the component is first mounted so we don't override user changes
    }
  }, [config.dispensingLocationUuid, isFilterLocationsLoading, locations]);

  return (
    <TabPanel>
      <div className={styles.searchContainer}>
        {config.locationBehavior?.locationFilter?.enabled &&
          !isFilterLocationsLoading &&
          isInitialized.current &&
          locations?.length > 1 && (
            <MultiSelect
              hideLabel
              id="locationFilter"
              label={t('filterByLocations', 'Filter by locations')}
              initialSelectedItems={filterLocations}
              items={locations}
              itemToString={(item: SimpleLocation) => item?.name}
              onChange={({ selectedItems }) => {
                setFilterLocations(selectedItems);
              }}
              className={styles.locationFilter}
            />
          )}
        <Search
          closeButtonLabelText={t('clearSearchInput', 'Clear search input')}
          defaultValue={searchTerm}
          placeholder={t('searchByPatientIdOrName', 'Search by patient ID or name')}
          labelText={t('searchByPatientIdOrName', 'Search by patient ID or name')}
          onChange={(e) => {
            e.preventDefault();
            setSearchTerm(e.target.value);
          }}
          size="md"
          className={styles.patientSearch}
        />
      </div>
      <PrescriptionsTable
        loadData={isTabActive}
        status={status}
        customPrescriptionsTableEndpoint={customPrescriptionsTableEndpoint}
        debouncedSearchTerm={debouncedSearchTerm}
        locations={filterLocations}
      />
    </TabPanel>
  );
};

export default PrescriptionTabPanel;
