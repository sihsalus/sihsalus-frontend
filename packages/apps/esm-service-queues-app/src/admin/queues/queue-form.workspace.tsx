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
  TextArea,
  TextInput,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getUserFacingErrorMessage,
  restBaseUrl,
  showSnackbar,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import type { TFunction } from 'i18next';
import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { z } from 'zod';
import { useQueueLocations } from '../../create-queue-entry/hooks/useQueueLocations';
import type { Queue } from '../../types';
import { saveQueue, updateQueue, useQueueConceptSets, useServiceConcepts } from './queue.resource';
import styles from './queue-form.scss';

const createQueueSchema = (t: TFunction) =>
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
        required_error: t('queueLocationRequired', 'Queue UPSS is required'),
      })
      .trim()
      .min(1, t('queueLocationRequired', 'Queue UPSS is required')),
    description: z.string().optional(),
  });

type QueueFormData = z.infer<ReturnType<typeof createQueueSchema>>;

interface QueueWorkspaceProps {
  queue?: Queue;
}

const QueueForm: React.FC<Workspace2DefinitionProps<QueueWorkspaceProps>> = ({ closeWorkspace, workspaceProps }) => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const { queueConcepts } = useServiceConcepts();
  const { priorityConceptSet, statusConceptSet } = useQueueConceptSets();
  const { queueLocations } = useQueueLocations();
  const queueToEdit = workspaceProps?.queue;
  const isEditMode = !!queueToEdit;

  const QueueSchema = createQueueSchema(t);

  const {
    control,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<QueueFormData>({
    resolver: zodResolver(QueueSchema),
    defaultValues: {
      queueName: queueToEdit?.name || '',
      queueServiceType: queueToEdit?.service?.uuid || '',
      priorityConceptSet: queueToEdit?.priorityConceptSet?.uuid || '',
      statusConceptSet: queueToEdit?.statusConceptSet?.uuid || '',
      userLocation: queueToEdit?.location?.uuid || '',
      description: queueToEdit?.description || '',
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

  const handleSaveQueue = async (data: QueueFormData) => {
    try {
      if (isEditMode) {
        await updateQueue(
          queueToEdit.uuid,
          data.queueName,
          data.queueServiceType,
          data.priorityConceptSet,
          data.statusConceptSet,
          data.description,
          data.userLocation,
        );
        showSnackbar({
          title: t('queueUpdated', 'Queue updated'),
          kind: 'success',
          subtitle: `${data.queueName}`,
        });
      } else {
        await saveQueue(
          data.queueName,
          data.queueServiceType,
          data.priorityConceptSet,
          data.statusConceptSet,
          data.description,
          data.userLocation,
        );
        showSnackbar({
          title: t('queueCreated', 'Queue created'),
          kind: 'success',
          subtitle: `${data.queueName}`,
        });
      }

      closeWorkspace();
      await mutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/queue?`));
    } catch (error) {
      showSnackbar({
        title: isEditMode
          ? t('errorUpdatingQueue', 'Error updating queue')
          : t('errorCreatingQueue', 'Error creating queue'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t('queueOperationErrorMessage', 'The queue operation could not be completed. Please try again.'),
          { logContext: isEditMode ? 'Update queue' : 'Create queue' },
        ),
      });
    }
  };

  return (
    <Workspace2 title={isEditMode ? t('editQueue', 'Edit queue') : t('addNewQueue', 'Add new queue')}>
      <Form onSubmit={handleSubmit(handleSaveQueue)} className={styles.form}>
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
                    labelText={t('selectALocation', 'Select a UPSS')}
                  >
                    <SelectItem text={t('selectALocation', 'Select a UPSS')} value="" />
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
                    {queueToEdit?.priorityConceptSet &&
                    queueToEdit.priorityConceptSet.uuid !== priorityConceptSet?.uuid ? (
                      <SelectItem
                        key={queueToEdit.priorityConceptSet.uuid}
                        text={queueToEdit.priorityConceptSet.display}
                        value={queueToEdit.priorityConceptSet.uuid}
                      >
                        {queueToEdit.priorityConceptSet.display}
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
                    {queueToEdit?.statusConceptSet && queueToEdit.statusConceptSet.uuid !== statusConceptSet?.uuid ? (
                      <SelectItem
                        key={queueToEdit.statusConceptSet.uuid}
                        text={queueToEdit.statusConceptSet.display}
                        value={queueToEdit.statusConceptSet.uuid}
                      >
                        {queueToEdit.statusConceptSet.display}
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
                name="description"
                control={control}
                render={({ field }) => (
                  <TextArea
                    {...field}
                    id="description"
                    labelText={t('description', 'Description')}
                    invalid={!!errors.description}
                    invalidText={errors.description?.message}
                  />
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
    </Workspace2>
  );
};

export default QueueForm;
