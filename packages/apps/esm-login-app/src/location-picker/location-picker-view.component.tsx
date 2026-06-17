import { Button, Checkbox, InlineLoading } from '@carbon/react';
import {
  getCoreTranslation,
  LocationPicker,
  navigate,
  setSessionLocation,
  useConfig,
  useConnectivity,
  useSession,
} from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Location, useLocation, useSearchParams } from 'react-router-dom';

import type { ConfigSchema } from '../config-schema';
import type { LoginReferrer } from '../login/login.component';

import { useDefaultLocation, useLocationCount } from './location-picker.resource';
import styles from './location-picker.scss';

interface LocationPickerProps {
  hideWelcomeMessage?: boolean;
  currentLocationUuid?: string;
}

const LocationPickerView: React.FC<LocationPickerProps> = ({ hideWelcomeMessage, currentLocationUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigSchema>();
  const { chooseLocation } = config;
  const isLoginEnabled = useConnectivity();
  const [searchParams] = useSearchParams();
  const checkboxId = useId();
  const isUpdateFlow = useMemo(() => searchParams.get('update') === 'true', [searchParams]);
  const { defaultLocation, updateDefaultLocation, savePreference, setSavePreference } =
    useDefaultLocation(isUpdateFlow);
  const {
    isLoading: isLoadingLocationCount,
    locationCount,
    firstLocation,
  } = useLocationCount(chooseLocation.useLoginLocationTag);
  const firstLocationResourceId = firstLocation?.resource?.id;

  const { user, sessionLocation } = useSession();
  const { currentUser, userProperties } = useMemo(
    () => ({
      currentUser: user?.display,
      userProperties: user?.userProperties,
    }),
    [user],
  );
  const loginImageAvifSrc = `${globalThis.getOpenmrsSpaBase()}login.avif`;
  const loginImageSrc = `${globalThis.getOpenmrsSpaBase()}login.png`;

  const [activeLocation, setActiveLocation] = useState(() => {
    if (currentLocationUuid && hideWelcomeMessage) {
      return currentLocationUuid;
    }
    return sessionLocation?.uuid ?? defaultLocation;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const { state } = useLocation() as unknown as Omit<Location, 'state'> & {
    state: LoginReferrer;
  };

  const changeLocation = useCallback(
    (locationUuid?: string, saveUserPreference?: boolean) => {
      setIsSubmitting(true);

      const referrer = state?.referrer;
      const returnToUrl = searchParams.get('returnToUrl');

      const sessionDefined = setSessionLocation(locationUuid, new AbortController());

      updateDefaultLocation(locationUuid, saveUserPreference);
      sessionDefined.then(() => {
        if (referrer && !['/', '/login', '/login/location'].includes(referrer)) {
          navigate({ to: '${openmrsSpaBase}' + referrer });
          return;
        }
        if (returnToUrl && returnToUrl !== '/') {
          navigate({ to: returnToUrl });
        } else {
          navigate({ to: config.links.loginSuccess });
        }
      });
    },
    [state?.referrer, config.links.loginSuccess, updateDefaultLocation, searchParams],
  );

  // Handle cases where the location picker is disabled, there is only one location, or there are no locations.
  useEffect(() => {
    if (isLoadingLocationCount) return;

    if (locationCount === 0) {
      changeLocation();
    } else if (locationCount === 1 || !chooseLocation.enabled) {
      if (firstLocationResourceId) {
        changeLocation(firstLocationResourceId, true);
      } else {
        console.error('Expected location data is missing', { firstLocationResourceId, locationCount });
      }
    }
  }, [changeLocation, chooseLocation.enabled, firstLocationResourceId, isLoadingLocationCount, locationCount]);

  // Handle cases where the login location is present in the userProperties.
  useEffect(() => {
    if (isUpdateFlow) {
      return;
    }
    if (defaultLocation && !isSubmitting) {
      setActiveLocation(defaultLocation);
      changeLocation(defaultLocation, true);
    }
  }, [changeLocation, isSubmitting, defaultLocation, isUpdateFlow]);

  const handleSubmit = useCallback(
    (evt: React.FormEvent<HTMLFormElement>) => {
      evt.preventDefault();

      if (!activeLocation) {
        return;
      }

      changeLocation(activeLocation, savePreference);
    },
    [activeLocation, changeLocation, savePreference],
  );

  return (
    <div className={styles.locationPickerContainer}>
      <picture className={styles.backgroundMedia} aria-hidden="true">
        <source srcSet={loginImageAvifSrc} type="image/avif" />
        <img src={loginImageSrc} alt="" width="1672" height="941" />
      </picture>
      <form className={styles.locationPickerForm} onSubmit={handleSubmit}>
        <div className={styles.locationCard}>
          <div className={styles.paddedContainer}>
            <p className={styles.welcomeTitle}>
              {t('welcome', 'Welcome')} {currentUser}
            </p>
            <p className={styles.welcomeMessage}>
              {t(
                'selectYourLocation',
                'Select your location from the list below. Use the search bar to find your location.',
              )}
            </p>
          </div>
          <LocationPicker
            selectedLocationUuid={activeLocation}
            defaultLocationUuid={userProperties?.defaultLocation}
            locationTag={chooseLocation.useLoginLocationTag && 'Login Location'}
            onChange={(locationUuid) => setActiveLocation(locationUuid)}
          />
          <div className={styles.footerContainer}>
            <Checkbox
              className={styles.savePreferenceCheckbox}
              checked={savePreference}
              id={checkboxId}
              labelText={t('rememberLocationForFutureLogins', 'Remember my location for future logins')}
              onChange={(_, { checked }) => setSavePreference(checked)}
            />
            <Button
              className={styles.confirmButton}
              kind="primary"
              type="submit"
              disabled={!activeLocation || !isLoginEnabled || isSubmitting}
            >
              {isSubmitting ? (
                <InlineLoading className={styles.loader} description={t('submitting', 'Submitting')} />
              ) : (
                <span>{getCoreTranslation('confirm')}</span>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default LocationPickerView;
