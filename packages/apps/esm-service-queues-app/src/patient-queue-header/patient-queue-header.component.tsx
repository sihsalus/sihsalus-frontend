import { Dropdown, DropdownSkeleton, InlineNotification, type OnChangeData } from '@carbon/react';
import { PageHeader, PageHeaderContent, ServiceQueuesPictogram, useConfig, useSession } from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useQueueLocations } from '../create-queue-entry/hooks/useQueueLocations';
import { useQueues } from '../hooks/useQueues';
import {
  updateSelectedQueueLocationName,
  updateSelectedQueueLocationUuid,
  updateSelectedService,
  useServiceQueuesStore,
} from '../store/store';
import styles from './patient-queue-header.scss';

interface PatientQueueHeaderProps {
  title?: string | JSX.Element;
  showFilters?: boolean;
  showLocationDropdown?: boolean;
  actions?: React.ReactNode;
}

type QueueLocationOption = { id?: string; name?: string };
type ServiceOption = { id: string; name: string };

const PatientQueueHeader: React.FC<PatientQueueHeaderProps> = ({
  title,
  showFilters,
  showLocationDropdown,
  actions,
}) => {
  const { t } = useTranslation();
  const { queueLocations, isLoading, error } = useQueueLocations();
  const { dashboardTitle } = useConfig<ConfigObject>();
  const userSession = useSession();
  const {
    selectedQueueLocationName,
    selectedQueueLocationUuid,
    selectedServiceDisplay,
    selectedServiceUuid,
  } = useServiceQueuesStore();
  const { queues, isLoading: isLoadingQueues, error: queuesError } = useQueues(selectedQueueLocationUuid);
  const availableQueues = queues ?? [];
  const shouldShowFilters = showFilters ?? showLocationDropdown ?? false;
  const shouldShowLocationDropdown = shouldShowFilters && queueLocations.length > 1;
  const showServiceDropdown = shouldShowFilters;

  const availableServiceOptions = useMemo(() => {
    return availableQueues
      .filter((queue) => queue.service?.uuid && queue.service.display)
      .map((queue) => ({ id: queue.service.uuid, name: queue.service.display }))
      .reduce<Array<ServiceOption>>((acc, curr) => {
        if (!acc.some((option) => option.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);
  }, [availableQueues]);

  const serviceOptions = useMemo(() => {
    const allServicesOption = { id: 'all', name: t('all', 'All') };
    const selectedServiceIsAvailable = availableServiceOptions.some(
      (option) => option.id === selectedServiceUuid,
    );
    const persistedServiceOption =
      selectedServiceUuid && !selectedServiceIsAvailable && (isLoadingQueues || queuesError)
        ? { id: selectedServiceUuid, name: selectedServiceDisplay ?? t('service', 'Service') }
        : null;

    return [allServicesOption, ...(persistedServiceOption ? [persistedServiceOption] : []), ...availableServiceOptions];
  }, [availableServiceOptions, isLoadingQueues, queuesError, selectedServiceDisplay, selectedServiceUuid, t]);

  const selectedService = selectedServiceUuid
    ? serviceOptions.find((option) => option.id === selectedServiceUuid) ?? serviceOptions[0]
    : serviceOptions[0];

  useEffect(() => {
    if (!selectedServiceUuid || isLoadingQueues || queuesError) {
      return;
    }

    const serviceIsAvailable = availableServiceOptions.some((option) => option.id === selectedServiceUuid);
    if (!serviceIsAvailable) {
      updateSelectedService(null, t('all', 'All'));
    }
  }, [availableServiceOptions, isLoadingQueues, queuesError, selectedServiceUuid, t]);

  const handleQueueLocationChange = useCallback(
    ({ selectedItem }: OnChangeData<QueueLocationOption>) => {
      if (!selectedItem?.id) {
        return;
      }

      if (selectedItem.id === 'all') {
        updateSelectedQueueLocationUuid(null);
        updateSelectedQueueLocationName(null);
      } else {
        updateSelectedQueueLocationUuid(selectedItem.id);
        updateSelectedQueueLocationName(selectedItem.name);
        updateSelectedService(null, t('all', 'All'));
      }
    },
    [t],
  );

  const handleServiceChange = useCallback(
    (data: OnChangeData<ServiceOption>) => {
      const selectedItem = data.selectedItem;
      if (selectedItem) {
        if (selectedItem.id === 'all') {
          updateSelectedService(null, t('all', 'All'));
        } else {
          updateSelectedService(selectedItem.id, selectedItem.name);
        }
      }
    },
    [t],
  );

  useEffect(() => {
    if (isLoading || error || selectedQueueLocationUuid) {
      return;
    }

    if (queueLocations.length === 1) {
      handleQueueLocationChange({ selectedItem: queueLocations[0] });
      return;
    }

    const sessionQueueLocation = queueLocations.find((location) => location.id === userSession?.sessionLocation?.uuid);
    if (sessionQueueLocation) {
      handleQueueLocationChange({ selectedItem: sessionQueueLocation });
    }
  }, [
    selectedQueueLocationUuid,
    error,
    handleQueueLocationChange,
    isLoading,
    queueLocations,
    userSession?.sessionLocation?.uuid,
  ]);

  return (
    <PageHeader className={styles.header} data-testid="patient-queue-header">
      <PageHeaderContent
        title={title ? title : t(dashboardTitle.key, dashboardTitle.value)}
        illustration={<ServiceQueuesPictogram />}
      />
      <div className={styles.dropdownContainer}>
        {isLoading ? (
          <div className={styles.dropdownSkeletonContainer}>
            <DropdownSkeleton />
          </div>
        ) : error ? (
          <div className={styles.errorContainer}>
            <InlineNotification
              kind="error"
              title={t('failedToLoadLocations', 'Failed to load locations')}
              hideCloseButton
            />
          </div>
        ) : (
          shouldShowLocationDropdown && (
            <Dropdown
              aria-label={t('selectQueueLocation', 'Select a queue location')}
              className={styles.dropdown}
              id="queueLocationDropdown"
              label={selectedQueueLocationName ?? t('all', 'All')}
              items={
                queueLocations.length !== 1 ? [{ id: 'all', name: t('all', 'All') }, ...queueLocations] : queueLocations
              }
              itemToString={(item: QueueLocationOption | null) => item?.name ?? ''}
              titleText={t('location', 'Location')}
              type="inline"
              onChange={handleQueueLocationChange}
            />
          )
        )}
        {showServiceDropdown && (
          <Dropdown
            aria-label={t('selectService', 'Select a service')}
            className={styles.dropdown}
            disabled={isLoadingQueues || Boolean(queuesError) || availableServiceOptions.length === 0}
            id="serviceDropdown"
            label={selectedService?.name ?? t('all', 'All')}
            items={serviceOptions}
            itemToString={(item) => item?.name ?? ''}
            selectedItem={selectedService}
            titleText={t('service', 'Service')}
            type="inline"
            onChange={handleServiceChange}
          />
        )}
        {actions}
      </div>
    </PageHeader>
  );
};

export default PatientQueueHeader;
