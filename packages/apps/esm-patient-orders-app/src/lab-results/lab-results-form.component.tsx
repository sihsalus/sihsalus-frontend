import { Button, ButtonSet, Form, InlineLoading, InlineNotification, Stack } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getUserFacingErrorMessage,
  restBaseUrl,
  showSnackbar,
  useAbortController,
  useLayoutType,
  Workspace2,
} from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  type Order,
  type PatientWorkspace2DefinitionProps,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import {
  completeOrderResult,
  createObservationPayload,
  flattenLeafConcepts,
  isCoded,
  isNumeric,
  isPanel,
  isText,
  LabResultCompletionError,
  updateObservation,
  updateOrderResult,
  useCompletedLabResults,
  useOrderConceptByUuid,
} from './lab-results.resource';
import styles from './lab-results-form.scss';
import ResultFormField from './lab-results-form-field.component';
import { useLabResultsFormSchema } from './useLabResultsFormSchema';

export interface LabResultsFormWorkspaceProps {
  order: Order;
  invalidateLabOrders?: () => void;
}

type LegacyLabResultsFormProps = DefaultPatientWorkspaceProps & LabResultsFormWorkspaceProps;
type Workspace2LabResultsFormProps = PatientWorkspace2DefinitionProps<LabResultsFormWorkspaceProps, object>;
export type LabResultsFormProps = LegacyLabResultsFormProps | Workspace2LabResultsFormProps;

function isWorkspace2Props(props: LabResultsFormProps): props is Workspace2LabResultsFormProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

const LabResultsForm: React.FC<LabResultsFormProps> = (props) => {
  const isWorkspace2 = isWorkspace2Props(props);
  const {
    order,
    /* Callback to refresh lab orders in the Laboratory app after results are saved.
     * This ensures the orders list stays in sync across the different tabs in the Laboratory app.
     * @see https://github.com/openmrs/openmrs-esm-laboratory-app/pull/117
     */
    invalidateLabOrders,
  } = isWorkspace2 ? props.workspaceProps : props;
  const { t } = useTranslation();
  const abortController = useAbortController();
  const isTablet = useLayoutType() === 'tablet';
  const { concept, isLoading: isLoadingConcepts } = useOrderConceptByUuid(order.concept.uuid);
  const [showEmptyFormErrorNotification, setShowEmptyFormErrorNotification] = useState(false);
  const [needsOrderCompletion, setNeedsOrderCompletion] = useState(false);
  const schema = useLabResultsFormSchema(order.concept.uuid);
  const { completeLabResult, isLoading, mutate: mutateResults } = useCompletedLabResults(order);
  const invalidateLabOrdersRef = useRef(invalidateLabOrders);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    invalidateLabOrdersRef.current = invalidateLabOrders;
  }, [invalidateLabOrders]);

  const mutateOrderData = useCallback(() => {
    mutate(
      (key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?patient=${order.patient.uuid}`),
      undefined,
      { revalidate: true },
    );
  }, [order.patient.uuid]);

  const {
    control,
    formState: { dirtyFields, errors, isDirty, isSubmitting },
    setValue,
    handleSubmit,
  } = useForm<Record<string, unknown>>({
    defaultValues: {},
    resolver: zodResolver(schema),
    mode: 'all',
  });

  useEffect(() => {
    if (concept && completeLabResult) {
      if (isCoded(concept) && completeLabResult?.value?.uuid) {
        setValue(concept.uuid, completeLabResult.value.uuid);
        if (completeLabResult.comment) {
          setValue(`${concept.uuid}-comment`, completeLabResult.comment);
        }
      } else if (isNumeric(concept) && completeLabResult?.value) {
        setValue(concept.uuid, parseFloat(String(completeLabResult.value)));
        if (completeLabResult.comment) {
          setValue(`${concept.uuid}-comment`, completeLabResult.comment);
        }
      } else if (isText(concept) && completeLabResult?.value) {
        setValue(concept.uuid, completeLabResult.value);
        if (completeLabResult.comment) {
          setValue(`${concept.uuid}-comment`, completeLabResult.comment);
        }
      } else if (isPanel(concept)) {
        const leafConcepts = flattenLeafConcepts(concept);
        // biome-ignore lint/suspicious/noExplicitAny: observation group members array representation
        const findObs = (members: Array<any> | undefined, conceptUuid: string): any => {
          if (!members) return undefined;
          for (const m of members) {
            if (m.concept?.uuid === conceptUuid) return m;
            if (m.groupMembers && m.groupMembers.length > 0) {
              const f = findObs(m.groupMembers, conceptUuid);
              if (f) return f;
            }
          }
          return undefined;
        };

        leafConcepts.forEach((member) => {
          const obs = findObs(completeLabResult.groupMembers, member.uuid);
          let value: unknown;
          if (isCoded(member)) {
            value = obs?.value?.uuid;
          } else if (isNumeric(member)) {
            value = obs?.value ? parseFloat(String(obs.value)) : undefined;
          } else if (isText(member)) {
            value = obs?.value;
          }
          if (value !== undefined && value !== null) {
            setValue(member.uuid, value);
          }
          if (obs?.comment) {
            setValue(`${member.uuid}-comment`, obs.comment);
          }
        });
        if (completeLabResult.comment) {
          setValue('order-comment', completeLabResult.comment);
        }
      }
    }
  }, [concept, completeLabResult, setValue]);

  useEffect(() => {
    if (isWorkspace2) {
      setHasUnsavedChanges(isDirty);
    } else {
      props.promptBeforeClosing(() => isDirty);
    }
  }, [isDirty, isWorkspace2, props]);

  const closeCurrentWorkspace = useCallback(
    (discardUnsavedChanges = false) => {
      if (isWorkspace2) {
        void props.closeWorkspace({ discardUnsavedChanges });
        return;
      }

      props.closeWorkspace({ ignoreChanges: discardUnsavedChanges });
    },
    [isWorkspace2, props],
  );

  const closeCurrentWorkspaceWithSavedChanges = useCallback(() => {
    if (isWorkspace2) {
      void props.closeWorkspace({ discardUnsavedChanges: true });
      return;
    }

    props.closeWorkspaceWithSavedChanges();
  }, [isWorkspace2, props]);

  if (isLoadingConcepts) {
    const loadingContent = (
      <div className={styles.loaderContainer}>
        <InlineLoading
          className={styles.loader}
          description={t('loadingTestDetails', 'Loading test details') + '...'}
          iconDescription={t('loading', 'Loading')}
          status="active"
        />
      </div>
    );

    if (isWorkspace2) {
      return (
        <Workspace2 title={t('enterTestResults', 'Enter test results')} hasUnsavedChanges={hasUnsavedChanges}>
          {loadingContent}
        </Workspace2>
      );
    }

    return loadingContent;
  }

  const saveLabResults = async (formValues: Record<string, unknown>) => {
    const isEmptyForm = Object.values(formValues).every(
      (value) => value === '' || value === null || value === undefined,
    );
    if (isEmptyForm) {
      setShowEmptyFormErrorNotification(true);
      return;
    }

    const showNotification = (kind: 'error' | 'success', message: string) => {
      showSnackbar({
        title:
          kind === 'success'
            ? t('saveLabResults', 'Save lab results')
            : t('errorSavingLabResults', 'Error saving lab results'),
        kind: kind,
        subtitle: message,
      });
    };

    const resultsStatusPayload = {
      fulfillerStatus: 'COMPLETED',
      fulfillerComment: 'Test Results Entered',
    };

    // If the observation succeeded but the fulfiller-status request failed, retry only
    // the idempotent status transition. Never create a duplicate observation.
    if (needsOrderCompletion || (completeLabResult?.uuid && order.fulfillerStatus !== 'COMPLETED')) {
      try {
        await completeOrderResult(order.uuid, resultsStatusPayload, abortController);
        setNeedsOrderCompletion(false);
        closeCurrentWorkspaceWithSavedChanges();
        void mutateOrderData();
        void mutateResults();
        invalidateLabOrdersRef.current?.();
        showNotification(
          'success',
          t('successfullySavedLabResults', 'Lab results for {{orderNumber}} have been successfully updated', {
            orderNumber: order?.orderNumber,
          }),
        );
      } catch (err) {
        showNotification(
          'error',
          getUserFacingErrorMessage(
            err,
            t(
              'errorCompletingLabOrderMessage',
              'The result is already saved, but the order is still pending. Try completing the order again.',
            ),
            { logContext: 'Complete laboratory order after saving result' },
          ),
        );
      }
      return setShowEmptyFormErrorNotification(false);
    }

    // Handle update operation for completed lab order results. Updating several Obs
    // through separate REST calls can leave a panel partially changed, so this flow
    // permits exactly one observation revision per submission.
    if (order.fulfillerStatus === 'COMPLETED') {
      // biome-ignore lint/suspicious/noExplicitAny: observation group members array representation
      const findObs = (members: Array<any> | undefined, conceptUuid: string): any => {
        if (!members) return undefined;
        for (const m of members) {
          if (m.concept?.uuid === conceptUuid) return m;
          if (m.groupMembers && m.groupMembers.length > 0) {
            const f = findObs(m.groupMembers, conceptUuid);
            if (f) return f;
          }
        }
        return undefined;
      };

      const dirtyKeys = Object.keys(dirtyFields);
      const updates = new Map<string, Record<string, unknown>>();
      const missingConceptUuids = new Set<string>();

      for (const dirtyKey of dirtyKeys) {
        const isOrderComment = dirtyKey === 'order-comment';
        const conceptUuid = isOrderComment ? concept.uuid : dirtyKey.replace(/-comment$/, '');
        const obs = isOrderComment
          ? completeLabResult
          : completeLabResult?.concept?.uuid === conceptUuid
            ? completeLabResult
            : findObs(completeLabResult?.groupMembers, conceptUuid);

        if (!obs?.uuid) {
          missingConceptUuids.add(conceptUuid);
          continue;
        }

        const update = updates.get(obs.uuid) ?? { obsDatetime: new Date().toISOString() };
        if (dirtyKey.endsWith('-comment') || isOrderComment) {
          update.comment = String(formValues[dirtyKey] ?? '');
        } else {
          const value = formValues[dirtyKey];
          update.value =
            typeof value === 'string' && value.length === 36 && value.includes('-') ? { uuid: value } : value;
        }
        updates.set(obs.uuid, update);
      }

      if (missingConceptUuids.size > 0) {
        showNotification(
          'error',
          t(
            'labResultObservationMissing',
            'The original observation was not found for: {{conceptUuids}}. No changes were made.',
            { conceptUuids: [...missingConceptUuids].join(', ') },
          ),
        );
        return setShowEmptyFormErrorNotification(false);
      }

      if (updates.size > 1) {
        showNotification(
          'error',
          t('editOneLabResultAtATime', 'For safety, edit only one panel result at a time. No changes were made.'),
        );
        return setShowEmptyFormErrorNotification(false);
      }

      if (updates.size === 0) {
        closeCurrentWorkspace();
        return setShowEmptyFormErrorNotification(false);
      }

      const [[observationUuid, payload]] = [...updates.entries()];
      try {
        await updateObservation(observationUuid, payload);
        closeCurrentWorkspaceWithSavedChanges();
        showNotification(
          'success',
          t('successfullySavedLabResults', 'Lab results for {{orderNumber}} have been successfully updated', {
            orderNumber: order?.orderNumber,
          }),
        );
      } catch (err) {
        showNotification(
          'error',
          getUserFacingErrorMessage(
            err,
            t('errorSavingLabResultsMessage', 'No se pudieron guardar los resultados. Intente nuevamente.'),
            { logContext: 'Update laboratory result observation' },
          ),
        );
      }
      void mutateResults();
      return setShowEmptyFormErrorNotification(false);
    }

    // Handle Creation logic

    // Set the observation status to 'FINAL' as we're not capturing it in the form
    const obsPayload = createObservationPayload(concept, order, formValues, 'FINAL');
    const orderDiscontinuationPayload = {
      previousOrder: order?.uuid,
      type: 'testorder',
      action: 'DISCONTINUE',
      careSetting: order?.careSetting?.uuid,
      encounter: order?.encounter?.uuid,
      patient: order?.patient?.uuid,
      concept: order?.concept?.uuid,
      orderer: order?.orderer,
    };
    try {
      await updateOrderResult(
        order.uuid,
        order.encounter.uuid,
        obsPayload,
        resultsStatusPayload,
        orderDiscontinuationPayload,
        abortController,
      );

      closeCurrentWorkspaceWithSavedChanges();
      void mutateOrderData();
      void mutateResults();
      invalidateLabOrdersRef.current?.();

      showNotification(
        'success',
        t('successfullySavedLabResults', 'Lab results for {{orderNumber}} have been successfully updated', {
          orderNumber: order?.orderNumber,
        }),
      );
    } catch (err) {
      if (err instanceof LabResultCompletionError) {
        setNeedsOrderCompletion(true);
        void mutateResults();
        showNotification(
          'error',
          t(
            'labResultSavedOrderPending',
            'The result was saved, but the order could not be marked as completed. Try again to complete only the order.',
          ),
        );
        return;
      }
      showNotification(
        'error',
        getUserFacingErrorMessage(
          err,
          t('errorSavingLabResultsMessage', 'No se pudieron guardar los resultados. Intente nuevamente.'),
          { logContext: 'Save laboratory results' },
        ),
      );
    } finally {
      setShowEmptyFormErrorNotification(false);
    }
  };

  const content = (
    <Form className={styles.form} onSubmit={handleSubmit(saveLabResults)}>
      <div className={styles.grid}>
        {concept.setMembers.length > 0 && <p className={styles.heading}>{concept.display}</p>}
        {concept && (
          <Stack gap={5}>
            {!isLoading ? (
              <>
                <ResultFormField defaultValue={completeLabResult} concept={concept} control={control} errors={errors} />
              </>
            ) : (
              <InlineLoading description={t('loadingInitialValues', 'Loading initial values') + '...'} />
            )}
          </Stack>
        )}
        {showEmptyFormErrorNotification && (
          <InlineNotification
            className={styles.emptyFormError}
            lowContrast
            title={t('error', 'Error')}
            subtitle={t('pleaseFillField', 'Please fill at least one field') + '.'}
          />
        )}
      </div>
      <ButtonSet
        className={classNames({
          [styles.tablet]: isTablet,
          [styles.desktop]: !isTablet,
        })}
      >
        <Button
          className={styles.button}
          kind="secondary"
          disabled={isSubmitting}
          onClick={() => closeCurrentWorkspace()}
        >
          {t('discard', 'Discard')}
        </Button>
        <Button
          className={styles.button}
          kind="primary"
          disabled={isSubmitting || Object.keys(errors).length > 0}
          type="submit"
        >
          {isSubmitting ? (
            <InlineLoading description={t('saving', 'Saving') + '...'} />
          ) : (
            t('saveAndClose', 'Save and close')
          )}
        </Button>
      </ButtonSet>
    </Form>
  );

  if (isWorkspace2) {
    return (
      <Workspace2 title={t('enterTestResults', 'Enter test results')} hasUnsavedChanges={hasUnsavedChanges}>
        {content}
      </Workspace2>
    );
  }

  return content;
};

export default LabResultsForm;
