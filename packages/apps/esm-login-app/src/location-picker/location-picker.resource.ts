import {
  type FetchResponse,
  openmrsFetch,
  setUserProperties,
  showSnackbar,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSwrImmutable from 'swr/immutable';

import { useValidateLocationUuid } from '../login.resource';
import { type LocationResponse } from '../types';

const userPropertiesWritePrivileges = ['Edit Users', 'Manage Users', 'Edit User Properties'];

export function useDefaultLocation(isUpdateFlow: boolean, requireLoginLocationTag = false) {
  const { t } = useTranslation();
  const { user } = useSession();
  const { userUuid, userProperties } = useMemo(
    () => ({
      userUuid: user?.uuid,
      userProperties: user?.userProperties,
    }),
    [user],
  );
  const [savePreference, setSavePreference] = useState(false);
  const canSavePreference = useMemo(
    () => Boolean(user && userPropertiesWritePrivileges.some((privilege) => userHasAccess(privilege, user))),
    [user],
  );

  const defaultLocation = useMemo(() => userProperties?.defaultLocation, [userProperties?.defaultLocation]);

  const { isLocationValid, defaultLocation: defaultLocationFhir } = useValidateLocationUuid(
    defaultLocation,
    requireLoginLocationTag,
  );

  useEffect(() => {
    if (defaultLocation) {
      setSavePreference(true);
    }
  }, [defaultLocation]);

  const updateUserPropsWithDefaultLocation = useCallback(
    async (locationUuid: string, saveDefaultLocation: boolean) => {
      if (!canSavePreference || !userUuid) {
        return false;
      }

      if (saveDefaultLocation) {
        // If the user checks the checkbox for saving the preference
        const updatedUserProperties = {
          ...userProperties,
          defaultLocation: locationUuid,
        };
        await setUserProperties(userUuid, updatedUserProperties);
        return true;
      } else if (userProperties?.defaultLocation) {
        // If the user doesn't want to save the preference,
        // the old preference should be deleted
        const updatedUserProperties = { ...userProperties };
        delete updatedUserProperties.defaultLocation;
        await setUserProperties(userUuid, updatedUserProperties);
        return true;
      }

      return false;
    },
    [canSavePreference, userProperties, userUuid],
  );

  const updateDefaultLocation = useCallback(
    async (locationUuid: string, saveDefaultLocation: boolean) => {
      if (savePreference && locationUuid === defaultLocation) {
        return;
      }

      try {
        const preferenceUpdated = await updateUserPropsWithDefaultLocation(locationUuid, saveDefaultLocation);
        if (!preferenceUpdated) {
          return;
        }

        if (saveDefaultLocation) {
          showSnackbar({
            title: !isUpdateFlow ? t('locationSaved', 'Location saved') : t('locationUpdated', 'Location updated'),
            subtitle: !isUpdateFlow
              ? t('locationSaveMessage', 'Your preferred location has been saved for future logins')
              : t('locationUpdateMessage', 'Your preferred login location has been updated'),
            kind: 'success',
            isLowContrast: true,
          });
        } else if (defaultLocation) {
          showSnackbar({
            title: t('locationPreferenceRemoved', 'Location preference removed'),
            subtitle: t('locationPreferenceRemovedMessage', 'You will need to select a location on each login'),
            kind: 'success',
            isLowContrast: true,
          });
        }
      } catch (error) {
        console.error('Failed to update the preferred login location', error);
        showSnackbar({
          title: t('locationPreferenceSaveFailed', 'Could not save the preferred location'),
          subtitle: t(
            'locationPreferenceSaveFailedMessage',
            'You can continue using this UPSS for the current session.',
          ),
          kind: 'warning',
          isLowContrast: true,
        });
      }
    },
    [savePreference, defaultLocation, updateUserPropsWithDefaultLocation, t, isUpdateFlow],
  );

  return {
    defaultLocationFhir,
    defaultLocation: isLocationValid ? defaultLocation : null,
    canSavePreference,
    updateDefaultLocation,
    savePreference,
    setSavePreference,
  };
}

export function useLocationCount(useLoginLocationTag: boolean) {
  const url = `/ws/fhir2/R4/Location?_count=1${useLoginLocationTag ? '&_tag=Login%20Location' : ''}`;
  const { data, error, isLoading } = useSwrImmutable<FetchResponse<LocationResponse>>(url, openmrsFetch, {
    shouldRetryOnError(err) {
      if (err?.response?.status) {
        return err.response.status >= 500;
      }
      return false;
    },
  });

  return useMemo(
    () => ({
      locationCount: data?.data?.total,
      firstLocation: data?.data?.entry ? data.data.entry[0] : null,
      error,
      isLoading,
    }),
    [data, isLoading, error],
  );
}
