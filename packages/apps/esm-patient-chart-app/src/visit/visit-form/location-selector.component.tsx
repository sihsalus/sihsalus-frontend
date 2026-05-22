import { ComboBox } from '@carbon/react';
import {
  type Location,
  type OpenmrsResource,
  useConfig,
  useFeatureFlag,
  useLocations,
  useSession,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import isEmpty from 'lodash-es/isEmpty';
import React, { useEffect, useState } from 'react';
import { type Control, Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type ChartConfig } from '../../config-schema';
import { useDefaultFacilityLocation } from '../hooks/useDefaultFacilityLocation';
import { useDefaultVisitLocation } from '../hooks/useDefaultVisitLocation';

import { type VisitFormData } from './visit-form.resource';
import styles from './visit-form.scss';

interface LocationSelectorProps {
  control: Control<VisitFormData>;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({ control }) => {
  const { t } = useTranslation();
  const config = useConfig<ChartConfig>();
  const {
    formState: { errors },
  } = useFormContext<VisitFormData>();
  const [searchTerm, setSearchTerm] = useState('');
  const sessionLocation = useSession().sessionLocation;
  const isEmrApiModuleInstalled = useFeatureFlag('emrapi-module');
  const defaultVisitLocation = useDefaultVisitLocation(
    sessionLocation,
    config.restrictByVisitLocationTag && isEmrApiModuleInstalled,
  );
  const locations = useLocations(
    config.restrictByVisitLocationTag && isEmrApiModuleInstalled ? 'Visit Location' : null,
    searchTerm,
  );
  const { defaultFacility, isLoading: loadingDefaultFacility } = useDefaultFacilityLocation();
  const disableChangingVisitLocation = config?.disableChangingVisitLocation;
  const locationsToShow: Array<OpenmrsResource> =
    !loadingDefaultFacility && !isEmpty(defaultFacility) ? [defaultFacility] : locations ? locations : [];

  const handleSearch = (searchString) => {
    setSearchTerm(searchString);
  };

  useEffect(() => {
    if (config.restrictByVisitLocationTag && !isEmrApiModuleInstalled) {
      console.warn('EMR API module is not installed. Visit location will not be restricted by location tag.');
    }
  }, [config.restrictByVisitLocationTag, isEmrApiModuleInstalled]);

  return (
    <section data-testid="combo">
      <div className={styles.sectionTitle}>{t('visitLocation', 'Visit Location')}</div>
      <div className={classNames(styles.selectContainer, styles.sectionField)}>
        {!disableChangingVisitLocation ? (
          <Controller
            control={control}
            name="visitLocation"
            render={({ field: { onBlur, onChange, value } }) => (
              <ComboBox
                aria-label={t('selectLocation', 'Select a location')}
                id="location"
                invalid={!!errors.visitLocation?.uuid}
                invalidText={t('required', 'Required')}
                items={locationsToShow}
                itemToString={(location: Location) => location?.display}
                onBlur={onBlur}
                onChange={({ selectedItem }) => onChange(selectedItem)}
                onInputChange={(searchTerm) => handleSearch(searchTerm)}
                readOnly={disableChangingVisitLocation}
                selectedItem={value ?? null}
                titleText={t('selectLocation', 'Select a location')}
              />
            )}
          />
        ) : (
          <p className={styles.bodyShort02}>{defaultVisitLocation?.display ?? sessionLocation?.display ?? ''}</p>
        )}
      </div>
    </section>
  );
};

export default LocationSelector;
