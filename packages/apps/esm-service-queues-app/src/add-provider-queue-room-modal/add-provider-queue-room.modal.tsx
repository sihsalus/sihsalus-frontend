import {
  Button,
  Checkbox,
  Dropdown,
  Form,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Stack,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { getCoreTranslation, showSnackbar } from '@openmrs/esm-framework';
import type { TFunction } from 'i18next';
import React, { useCallback } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useQueueLocations } from '../create-queue-entry/hooks/useQueueLocations';
import useQueueServices from '../hooks/useQueueService';
import {
  updateIsPermanentProviderQueueRoom,
  updateSelectedQueueLocationName,
  updateSelectedQueueLocationUuid,
  updateSelectedQueueRoomTimestamp,
  updateSelectedService,
  useServiceQueuesStore,
} from '../store/store';

import {
  addProviderToQueueRoom,
  updateProviderToQueueRoom,
  useProvidersQueueRoom,
  useQueueRooms,
} from './add-provider-queue-room.resource';
import styles from './add-provider-queue-room.scss';

interface AddProviderQueueRoomModalProps {
  closeModal: () => void;
  providerUuid: string;
}

const createProviderQueueRoomSchema = (t: TFunction) =>
  z.object({
    queueLocationUuid: z
      .string({
        required_error: t('queueLocationIsRequired', 'Queue location is required'),
      })
      .trim()
      .min(1, t('queueLocationIsRequired', 'Queue location is required')),
    queueProviderMapUuid: z.string(),
    queueRoomUuid: z
      .string({
        required_error: t('queueRoomIsRequired', 'Queue room is required'),
      })
      .trim()
      .min(1, t('queueRoomIsRequired', 'Queue room is required')),
    currentIsPermanentProviderQueueRoom: z.boolean(),
  });

type ProviderQueueRoomData = z.infer<ReturnType<typeof createProviderQueueRoomSchema>>;

const AddProviderQueueRoomModal: React.FC<AddProviderQueueRoomModalProps> = ({ closeModal, providerUuid }) => {
  const { t } = useTranslation();
  const { providerRoom, mutate } = useProvidersQueueRoom(providerUuid);
  const { isPermanentProviderQueueRoom, selectedQueueLocationUuid, selectedServiceDisplay, selectedServiceUuid } =
    useServiceQueuesStore();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<ProviderQueueRoomData>({
    mode: 'all',
    resolver: zodResolver(createProviderQueueRoomSchema(t)),
    defaultValues: {
      queueLocationUuid: selectedQueueLocationUuid ?? '',
      queueProviderMapUuid: providerRoom?.[0]?.uuid ?? '',
      queueRoomUuid: providerRoom?.[0]?.queueRoom?.uuid ?? '',
      currentIsPermanentProviderQueueRoom: isPermanentProviderQueueRoom,
    },
  });

  const { queueLocations } = useQueueLocations();
  const { rooms, error: errorFetchingQueueRooms } = useQueueRooms(selectedQueueLocationUuid, selectedServiceUuid);
  const { services } = useQueueServices();

  const handleServiceChange = useCallback(({ selectedItem }) => {
    if (!selectedItem) {
      return;
    }

    localStorage.setItem('queueServiceName', selectedItem.display);
    localStorage.setItem('queueService', selectedItem.uuid);
    updateSelectedService(selectedItem.uuid, selectedItem.display);
  }, []);

  const handleQueueLocationChange = useCallback(
    ({ selectedItem }) => {
      if (!selectedItem) {
        return;
      }

      localStorage.setItem('queueLocationUuid', selectedItem.id);
      localStorage.setItem('queueLocationName', selectedItem.name);
      updateSelectedQueueLocationName(selectedItem.name);
      updateSelectedQueueLocationUuid(selectedItem.id);
      setValue('queueLocationUuid', selectedItem.id);
    },
    [setValue],
  );

  const handleRetainLocation = useCallback((isChecked: boolean) => {
    localStorage.setItem('isPermanentProviderQueueRoom', String(isChecked));
    updateIsPermanentProviderQueueRoom(isChecked);
  }, []);

  const onSubmit = useCallback(
    async (data: ProviderQueueRoomData) => {
      try {
        if (providerRoom?.length) {
          await updateProviderToQueueRoom(data.queueProviderMapUuid, data.queueRoomUuid, providerUuid);
          showSnackbar({
            isLowContrast: true,
            title: t('queueRoomUpdated', 'Queue room updated'),
            kind: 'success',
            subtitle: t('queueRoomUpdatedSuccessfully', 'Queue room updated successfully'),
          });
        } else {
          await addProviderToQueueRoom(data.queueRoomUuid, providerUuid);
          showSnackbar({
            isLowContrast: true,
            title: t('queueRoomAdded', 'Queue room added'),
            kind: 'success',
            subtitle: t('queueRoomAddedSuccessfully', 'Queue room added successfully'),
          });
        }

        const timestamp = new Date().toString();
        localStorage.setItem('lastUpdatedQueueRoomTimestamp', timestamp);
        updateSelectedQueueRoomTimestamp(new Date());
        await mutate();
        closeModal();
      } catch (error) {
        showSnackbar({
          title: t('queueRoomAddFailed', 'Error adding queue room'),
          kind: 'error',
          isLowContrast: false,
          subtitle: error?.message,
        });
      }
    },
    [closeModal, mutate, providerUuid, providerRoom, t],
  );

  return (
    <div>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <ModalHeader
          className={styles.modalHeader}
          closeModal={closeModal}
          title={t('addAProviderQueueRoom', 'Add provider queue room')}
        />
        <ModalBody>
          <Stack gap={4}>
            <section>
              <Controller
                control={control}
                name="queueLocationUuid"
                render={({ field }) => (
                  <Dropdown
                    {...field}
                    aria-label={t('queueLocation', 'Queue location')}
                    id="queueLocation"
                    initialSelectedItem={queueLocations?.find((location) => location.id === selectedQueueLocationUuid)}
                    invalid={!!errors.queueLocationUuid}
                    invalidText={errors.queueLocationUuid?.message}
                    items={queueLocations ?? []}
                    itemToString={(item) => item?.name ?? ''}
                    label={t('queueLocation', 'Queue location')}
                    onChange={(e) => {
                      if (!e.selectedItem) {
                        return;
                      }
                      field.onChange(e.selectedItem?.id);
                      handleQueueLocationChange(e);
                    }}
                    titleText={t('queueLocation', 'Queue location')}
                  />
                )}
              />
            </section>

            <section>
              <Controller
                control={control}
                name="queueProviderMapUuid"
                render={({ field }) => (
                  <Dropdown
                    {...field}
                    aria-label={t('queueService', 'Queue service')}
                    id="queueService"
                    initialSelectedItem={
                      services?.find((service) => service.uuid === selectedServiceUuid) ??
                      (selectedServiceUuid
                        ? {
                            display: selectedServiceDisplay,
                            uuid: selectedServiceUuid,
                          }
                        : undefined)
                    }
                    itemToString={(item) => item?.display ?? ''}
                    items={services ?? []}
                    label={t('queueService', 'Queue service')}
                    onChange={({ selectedItem }) => {
                      const value = selectedItem?.uuid ?? '';
                      field.onChange(value);
                      handleServiceChange({ selectedItem });
                    }}
                    titleText={t('queueService', 'Queue service')}
                  />
                )}
              />
            </section>

            <section>
              <Controller
                control={control}
                name="queueRoomUuid"
                render={({ field }) => (
                  <Select
                    {...field}
                    disabled={Boolean(errorFetchingQueueRooms)}
                    id="queueRoom"
                    invalid={!!errors.queueRoomUuid}
                    invalidText={errors.queueRoomUuid?.message}
                    labelText={t('queueRoom', 'Queue room')}
                    onChange={(event) => field.onChange(event.target.value)}
                  >
                    <SelectItem text={t('selectQueueRoom', 'Select a queue room')} value="" />
                    {rooms?.map((room) => (
                      <SelectItem key={room.uuid} text={room.display} value={room.uuid} />
                    ))}
                  </Select>
                )}
              />
              {errorFetchingQueueRooms && (
                <InlineNotification
                  className={styles.errorNotification}
                  kind="error"
                  onClick={() => {}}
                  subtitle={errorFetchingQueueRooms}
                  title={t('errorFetchingQueueRooms', 'Error fetching queue rooms')}
                />
              )}
            </section>

            <section>
              <Controller
                control={control}
                name="currentIsPermanentProviderQueueRoom"
                render={({ field }) => (
                  <Checkbox
                    checked={Boolean(field.value)}
                    className={styles.checkbox}
                    id="permanentLocation"
                    labelText={t('retainLocation', 'Retain location')}
                    onChange={(_, { checked }) => {
                      field.onChange(checked);
                      handleRetainLocation(checked);
                    }}
                  />
                )}
              />
            </section>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={closeModal}>
            {getCoreTranslation('cancel', 'Cancel')}
          </Button>
          <Button disabled={isSubmitting} kind="primary" type="submit">
            {isSubmitting ? (
              <InlineLoading description={t('saving', 'Saving') + '...'} />
            ) : (
              <span>{getCoreTranslation('save', 'Save')}</span>
            )}
          </Button>
        </ModalFooter>
      </Form>
    </div>
  );
};

export default AddProviderQueueRoomModal;
