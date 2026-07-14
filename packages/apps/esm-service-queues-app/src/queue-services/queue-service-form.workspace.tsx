import {
  Button,
  ButtonSet,
  Column,
  Form,
  InlineLoading,
  Layer,
  Select,
  SelectItem,
  Stack,
  TextInput,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type DefaultWorkspaceProps,
  getUserFacingErrorMessage,
  restBaseUrl,
  showSnackbar,
} from '@openmrs/esm-framework';
import type { TFunction } from 'i18next';
import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import { z } from 'zod';

import { useQueueLocations } from '../create-queue-entry/hooks/useQueueLocations';
import { saveQueue, useQueueConceptSets, useServiceConcepts } from './queue-service.resource';
import styles from './queue-service-form.scss';

const createQueueServiceSchema = (t: TFunction) =>
  z.object({
    queueName: z
      .string({
        required_error: t('queueNameRequired', 'Queue name is required'),
      })
      .trim()
      .min(1, t('queueNameRequired', 'Queue name is required')),
    queueServiceType: z
      .string({
        required_error: t('queueConceptRequired', 'Queue concept is required'),
      })
      .trim()
      .min(1, t('queueConceptRequired', 'Queue concept is required')),
    priorityConceptSet: z
      .string({
        required_error: t('priorityConceptSetRequired', 'Priority concept set is required'),
      })
      .trim()
      .min(1, t('priorityConceptSetRequired', 'Priority concept set is required')),
    statusConceptSet: z
      .string({
        required_error: t('statusConceptSetRequired', 'Status concept set is required'),
      })
      .trim()
      .min(1, t('statusConceptSetRequired', 'Status concept set is required')),
    userLocation: z
      .string({
        required_error: t('queueLocationRequired', 'Queue location is required'),
      })
      .trim()
      .min(1, t('queueLocationRequired', 'Queue location is required')),
  });

type QueueServiceFormData = z.infer<ReturnType<typeof createQueueServiceSchema>>;

const QueueServiceForm: React.FC<DefaultWorkspaceProps> = ({ closeWorkspace }) => {
  const { t } = useTranslation();
  const { queueConcepts } = useServiceConcepts();
  const { priorityConceptSet, statusConceptSet } = useQueueConceptSets();
  const { queueLocations } = useQueueLocations();

  const QueueServiceSchema = createQueueServiceSchema(t);

  const {
    control,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<QueueServiceFormData>({
    resolver: zodResolver(QueueServiceSchema),
    defaultValues: {
      queueName: '',
      queueServiceType: '',
      priorityConceptSet: '',
      statusConceptSet: '',
      userLocation: '',
    },
  });

  useEffect(() => {
    if (!getValues('priorityConceptSet') && priorityConceptSet?.uuid) {
      setValue('priorityConceptSet', priorityConceptSet.uuid, { shouldValidate: true });
    }
  }, [getValues, priorityConceptSet?.uuid, setValue]);

  useEffect(() => {
    if (!getValues('statusConceptSet') && statusConceptSet?.uuid) {
      setValue('statusConceptSet', statusConceptSet.uuid, { shouldValidate: true });
    }
  }, [getValues, setValue, statusConceptSet?.uuid]);

  const createQueue = async (data: QueueServiceFormData) => {
    try {
      await saveQueue(
        data.queueName,
        data.queueServiceType,
        data.priorityConceptSet,
        data.statusConceptSet,
        '',
        data.userLocation,
      );

      showSnackbar({
        title: t('queueServiceCreated', 'Queue service created'),
        kind: 'success',
        subtitle: t('queueServiceCreatedSuccessfully', 'Queue service created successfully'),
      });

      closeWorkspace();
      await Promise.all([
        mutate(`${restBaseUrl}/queue?${data.userLocation}`),
        mutate(`${restBaseUrl}/queue?location=${data.userLocation}`),
      ]);
    } catch (error) {
      showSnackbar({
        title: t('errorCreatingQueueService', 'Error creating queue service'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t('queueOperationErrorMessage', 'The queue operation could not be completed. Please try again.'),
          { logContext: 'Create queue service' },
        ),
      });
    }
  };

  return (
    <Form onSubmit={handleSubmit(createQueue)} className={styles.form}>
      <Stack gap={5} className={styles.grid}>
        <Column>
          <Layer className={styles.input}>
            <Controller
              name="queueName"
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  id="queueName"
                  invalidText={errors.queueName?.message}
                  invalid={!!errors.queueName}
                  labelText={t('queueName', 'Queue name')}
                />
              )}
            />
          </Layer>
        </Column>
        <Column>
          <Layer className={styles.input}>
            <Controller
              name="queueServiceType"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelText={t('selectServiceType', 'Select a service type')}
                  id="queueServiceType"
                  invalid={!!errors?.queueServiceType}
                  invalidText={errors?.queueServiceType?.message}
                >
                  <SelectItem text={t('selectServiceType', 'Select a service type')} value="" />
                  {queueConcepts?.length > 0 &&
                    queueConcepts.map((concept) => (
                      <SelectItem key={concept.uuid} text={concept.display} value={concept.uuid}>
                        {concept.display}
                      </SelectItem>
                    ))}
                </Select>
              )}
            />
          </Layer>
        </Column>
        <Column>
          <Layer className={styles.input}>
            <Controller
              name="userLocation"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  id="location"
                  invalid={!!errors?.userLocation}
                  invalidText={errors?.userLocation?.message}
                  labelText={t('selectALocation', 'Select a location')}
                >
                  <SelectItem text={t('selectALocation', 'Select a location')} value="" />
                  {queueLocations?.length > 0 &&
                    queueLocations.map((location) => (
                      <SelectItem key={location.id} text={location.name} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                </Select>
              )}
            />
          </Layer>
        </Column>
        <Column>
          <Layer className={styles.input}>
            <Controller
              name="priorityConceptSet"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelText={t('priorityConceptSet', 'Priority concept set')}
                  id="priorityConceptSet"
                  invalid={!!errors?.priorityConceptSet}
                  invalidText={errors?.priorityConceptSet?.message}
                >
                  <SelectItem text={t('selectPriorityConceptSet', 'Select a priority concept set')} value="" />
                  {priorityConceptSet ? (
                    <SelectItem
                      key={priorityConceptSet.uuid}
                      text={priorityConceptSet.display}
                      value={priorityConceptSet.uuid}
                    >
                      {priorityConceptSet.display}
                    </SelectItem>
                  ) : null}
                </Select>
              )}
            />
          </Layer>
        </Column>
        <Column>
          <Layer className={styles.input}>
            <Controller
              name="statusConceptSet"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelText={t('statusConceptSet', 'Status concept set')}
                  id="statusConceptSet"
                  invalid={!!errors?.statusConceptSet}
                  invalidText={errors?.statusConceptSet?.message}
                >
                  <SelectItem text={t('selectStatusConceptSet', 'Select a status concept set')} value="" />
                  {statusConceptSet ? (
                    <SelectItem
                      key={statusConceptSet.uuid}
                      text={statusConceptSet.display}
                      value={statusConceptSet.uuid}
                    >
                      {statusConceptSet.display}
                    </SelectItem>
                  ) : null}
                </Select>
              )}
            />
          </Layer>
        </Column>
      </Stack>
      <ButtonSet className={styles.buttonSet}>
        <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button className={styles.button} disabled={isSubmitting} kind="primary" type="submit">
          {isSubmitting ? (
            <InlineLoading description={t('saving', 'Saving') + '...'} />
          ) : (
            <span>{t('save', 'Save')}</span>
          )}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default QueueServiceForm;
