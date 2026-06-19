import { Button, ButtonSet, Form, InlineLoading, InlineNotification, Stack } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { restBaseUrl, showSnackbar, useAbortController, useLayoutType, Workspace2 } from '@openmrs/esm-framework';
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
  createObservationPayload,
  isCoded,
  isNumeric,
  isPanel,
  isText,
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
    formState: { errors, isDirty, isSubmitting },
    setValue,
    handleSubmit,
  } = useForm<Record<string, unknown>>({
    defaultValues: {},
    resolver: zodResolver(schema),
    mode: 'all',
  });

  useEffect(() => {
    if (concept && completeLabResult && order?.fulfillerStatus === 'COMPLETED') {
      if (isCoded(concept) && completeLabResult?.value?.uuid) {
        setValue(concept.uuid, completeLabResult.value.uuid);
      } else if (isNumeric(concept) && completeLabResult?.value) {
        setValue(concept.uuid, parseFloat(String(completeLabResult.value)));
      } else if (isText(concept) && completeLabResult?.value) {
        setValue(concept.uuid, completeLabResult.value);
      } else if (isPanel(concept)) {
        concept.setMembers.forEach((member) => {
          const obs = completeLabResult.groupMembers.find((v) => v.concept.uuid === member.uuid);
          let value: unknown;
          if (isCoded(member)) {
            value = obs?.value?.uuid;
          } else if (isNumeric(member)) {
            value = obs?.value ? parseFloat(String(obs.value)) : undefined;
          } else if (isText(member)) {
            value = obs?.value;
          }
          if (value) {
            setValue(member.uuid, value);
          }
        });
      }
    }
  }, [concept, completeLabResult, order, setValue]);

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

    // Handle update operation for completed lab order results
    if (order.fulfillerStatus === 'COMPLETED') {
      const updateTasks = Object.entries(formValues).map(([conceptUuid, value]) => {
        const obs = completeLabResult?.groupMembers?.find((v) => v.concept.uuid === conceptUuid) ?? completeLabResult;
        return updateObservation(obs?.uuid, { value });
      });
      const updateResults = await Promise.allSettled(updateTasks);
      const failedObsconceptUuids = updateResults.reduce<Array<string | undefined>>((prev, curr, index) => {
        if (curr.status === 'rejected') {
          const conceptUuid = Object.keys(formValues).at(index);
          prev.push(conceptUuid);
        }
        return prev;
      }, []);

      if (failedObsconceptUuids.length) {
        showNotification('error', 'Could not save obs with concept uuids ' + failedObsconceptUuids.join(', '));
      } else {
        closeCurrentWorkspaceWithSavedChanges();
        showNotification(
          'success',
          t('successfullySavedLabResults', 'Lab results for {{orderNumber}} have been successfully updated', {
            orderNumber: order?.orderNumber,
          }),
        );
      }
      void mutateResults();
      return setShowEmptyFormErrorNotification(false);
    }

    // Handle Creation logic

    // Set the observation status to 'FINAL' as we're not capturing it in the form
    const obsPayload = createObservationPayload(concept, order, formValues, 'FINAL');
    const orderDiscontinuationPayload = {
      previousOrder: order.uuid,
      type: 'testorder',
      action: 'DISCONTINUE',
      careSetting: order.careSetting.uuid,
      encounter: order.encounter.uuid,
      patient: order.patient.uuid,
      concept: order.concept.uuid,
      orderer: order.orderer,
    };
    const resultsStatusPayload = {
      fulfillerStatus: 'COMPLETED',
      fulfillerComment: 'Test Results Entered',
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
      showNotification(
        'error',
        err instanceof Error ? err.message : t('errorSavingLabResults', 'Error saving lab results'),
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
              <ResultFormField defaultValue={completeLabResult} concept={concept} control={control} errors={errors} />
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
