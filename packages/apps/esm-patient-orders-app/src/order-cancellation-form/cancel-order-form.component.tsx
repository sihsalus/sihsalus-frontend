/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import {
  Button,
  ButtonSet,
  Column,
  DatePicker,
  DatePickerInput,
  Form,
  InlineLoading,
  InlineNotification,
  Stack,
  TextArea,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { showSnackbar, useConfig, useLayoutType, Workspace2 } from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  type Order,
  type PatientWorkspace2DefinitionProps,
  usePatientOrders,
} from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, type FieldErrors, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { ConfigObject } from '../config-schema';
import { cancelOrder } from './cancel-order.resource';
import styles from './cancel-order-form.scss';

interface OrderCancellationFormWorkspaceProps {
  order: Order;
}

type LegacyOrderCancellationFormProps = DefaultPatientWorkspaceProps & OrderCancellationFormWorkspaceProps;
type Workspace2OrderCancellationFormProps = PatientWorkspace2DefinitionProps<
  OrderCancellationFormWorkspaceProps,
  object
>;
type OrderCancellationFormProps = LegacyOrderCancellationFormProps | Workspace2OrderCancellationFormProps;

function isWorkspace2Props(props: OrderCancellationFormProps): props is Workspace2OrderCancellationFormProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

const OrderCancellationForm: React.FC<OrderCancellationFormProps> = (props) => {
  const isWorkspace2 = isWorkspace2Props(props);
  const order = isWorkspace2 ? props.workspaceProps.order : props.order;
  const patientUuid = isWorkspace2 ? props.groupProps.patientUuid : props.patientUuid;
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { careSettingUuid } = useConfig<ConfigObject>();
  const { mutate } = usePatientOrders(patientUuid, undefined, undefined, undefined, undefined, careSettingUuid);

  const cancelOrderSchema = useMemo(() => {
    return z.object({
      cancellationDate: z
        .date({
          required_error: t('cancellationDateRequired', 'Cancellation date is required'),
        })
        .refine((date) => date >= dayjs().startOf('day').toDate(), {
          message: t('dateCannotBeBeforeToday', 'Date cannot be before today'),
        }),
      reasonForCancellation: z.string({
        required_error: t('reasonForCancellationRequired', 'Reason for cancellation is required'),
      }),
    });
  }, [t]);

  type CancelOrderFormData = z.infer<typeof cancelOrderSchema>;

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CancelOrderFormData>({
    mode: 'all',
    resolver: zodResolver(cancelOrderSchema),
  });

  function onError(err: FieldErrors<CancelOrderFormData>) {
    if (Object.keys(err).length > 0) {
      setShowErrorNotification(true);
    }
  }

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

  useEffect(() => {
    if (isWorkspace2) {
      setHasUnsavedChanges(isDirty);
    } else {
      props.promptBeforeClosing(() => isDirty);
    }
  }, [isDirty, isWorkspace2, props]);

  const cancelOrderRequest = useCallback(
    (data: CancelOrderFormData) => {
      const formData = data;
      setShowErrorNotification(false);

      const payload = {
        fulfillerStatus: 'DECLINED',
        fulfillerComment: formData.reasonForCancellation,
      };

      cancelOrder(order, payload).then(
        () => {
          closeCurrentWorkspace(true);
          mutate();

          showSnackbar({
            title: t('orderCancelled', 'Order cancelled'),
            kind: 'success',
            subtitle: t('successfullyCancelledOrder', 'Order {{orderNumber}} has been cancelled successfully', {
              orderNumber: order?.orderNumber,
            }),
          });
        },
        (err) => {
          showSnackbar({
            isLowContrast: true,
            title: t('errorCancellingOrder', 'Error cancelling order'),
            kind: 'error',
            subtitle: err?.message,
          });
        },
      );
    },
    [closeCurrentWorkspace, mutate, order, t],
  );

  const content = (
    <Form className={styles.form}>
      <div className={styles.grid}>
        <Stack>
          <section>
            <h4 className={styles.orderDisplay}>{order?.display}</h4>
          </section>
          <section>
            <Controller
              name="cancellationDate"
              control={control}
              render={({ field: { onChange, value } }) => (
                <div className={styles.row}>
                  <DatePicker
                    minDate={dayjs().startOf('day').toDate()}
                    dateFormat="d/m/Y"
                    datePickerType="single"
                    value={value}
                    onChange={([date]) => onChange(date)}
                  >
                    <DatePickerInput
                      id="date-picker-calendar-id"
                      placeholder="dd/mm/yyyy"
                      labelText={t('cancellationDate', 'Cancellation date')}
                      type="text"
                      invalid={!!errors['cancellationDate']}
                      invalidText={!!errors['cancellationDate'] && errors['cancellationDate'].message}
                    />
                  </DatePicker>
                </div>
              )}
            />
          </section>
          <section>
            <Controller
              name="reasonForCancellation"
              control={control}
              render={({ field: { onChange, value } }) => (
                <div className={styles.row}>
                  <TextArea
                    id="reasonForCancellation"
                    labelText={t('reasonForCancellation', 'Reason for cancellation')}
                    value={value}
                    onChange={(evt) => onChange(evt.target.value)}
                    invalid={!!errors['reasonForCancellation']}
                    invalidText={!!errors['reasonForCancellation'] && errors['reasonForCancellation'].message}
                  />
                </div>
              )}
            />
          </section>
        </Stack>
      </div>

      {showErrorNotification && (
        <Column className={styles.errorContainer}>
          <InlineNotification
            lowContrast
            title={t('error', 'Error')}
            subtitle={t('pleaseFillRequiredFields', 'Please fill all the required fields') + '.'}
            onClose={() => setShowErrorNotification(false)}
          />
        </Column>
      )}

      <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
        <Button className={styles.button} kind="secondary" onClick={() => closeCurrentWorkspace()}>
          {t('discard', 'Discard')}
        </Button>
        <Button
          className={styles.button}
          kind="primary"
          onClick={handleSubmit(cancelOrderRequest, onError)}
          disabled={isSubmitting}
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
      <Workspace2 title={t('orderCancellation', 'Order cancellation')} hasUnsavedChanges={hasUnsavedChanges}>
        {content}
      </Workspace2>
    );
  }

  return content;
};

export default OrderCancellationForm;
