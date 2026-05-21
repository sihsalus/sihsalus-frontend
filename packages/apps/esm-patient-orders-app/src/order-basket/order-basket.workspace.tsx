/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import { ActionableNotification, Button, ButtonSet, InlineLoading, InlineNotification } from '@carbon/react';
import {
  ExtensionSlot,
  showModal,
  showSnackbar,
  useConfig,
  useLayoutType,
  useSession,
  Workspace2,
} from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  getPatientUuidFromStore,
  launchPatientWorkspace,
  type OrderBasketItem,
  type PatientWorkspace2DefinitionProps,
  postOrders,
  postOrdersOnNewEncounter,
  useOrderBasket,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutatePatientOrders, useOrderEncounter } from '../api/api';
import { type ConfigObject } from '../config-schema';

import GeneralOrderType from './general-order-type/general-order-type.component';
import styles from './order-basket.scss';

interface OrderBasketWorkspaceProps {
  patientUuid?: string;
}

interface OrderBasketWindowProps {
  patientUuid?: string;
  drugOrderWorkspaceName?: string;
  labOrderWorkspaceName?: string;
  generalOrderWorkspaceName?: string;
}

type Workspace2OrderBasketProps = PatientWorkspace2DefinitionProps<OrderBasketWorkspaceProps, OrderBasketWindowProps>;
type OrderBasketProps = DefaultPatientWorkspaceProps | Workspace2OrderBasketProps;

function isWorkspace2Props(props: OrderBasketProps): props is Workspace2OrderBasketProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

const OrderBasket: React.FC<OrderBasketProps> = (props) => {
  const patientUuid = isWorkspace2Props(props)
    ? (props.groupProps?.patientUuid ??
      props.windowProps?.patientUuid ??
      props.workspaceProps?.patientUuid ??
      getPatientUuidFromStore())
    : props.patientUuid;
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const { activeVisit } = useVisitOrOfflineVisit(patientUuid);
  const { orders, clearOrders } = useOrderBasket();
  const [ordersWithErrors, setOrdersWithErrors] = useState<OrderBasketItem[]>([]);
  const {
    activeVisitRequired,
    isLoading: isLoadingEncounterUuid,
    encounterUuid,
    error: errorFetchingEncounterUuid,
    mutate: mutateEncounterUuid,
  } = useOrderEncounter(patientUuid);
  const [isSavingOrders, setIsSavingOrders] = useState(false);
  const [creatingEncounterError, setCreatingEncounterError] = useState('');
  const { mutate: mutateOrders } = useMutatePatientOrders(patientUuid);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const orderWorkspaceNames = {
    drug: isWorkspace2Props(props) ? (props.windowProps?.drugOrderWorkspaceName ?? 'add-drug-order') : 'add-drug-order',
    lab: isWorkspace2Props(props) ? (props.windowProps?.labOrderWorkspaceName ?? 'add-lab-order') : 'add-lab-order',
    general: isWorkspace2Props(props)
      ? (props.windowProps?.generalOrderWorkspaceName ?? 'orderable-concept-workspace')
      : 'orderable-concept-workspace',
  };

  const closeCurrentWorkspace = useCallback(
    async (
      options?: Parameters<DefaultPatientWorkspaceProps['closeWorkspace']>[0] & {
        discardUnsavedChanges?: boolean;
      },
    ) => {
      if (isWorkspace2Props(props)) {
        const didClose = await props.closeWorkspace({
          discardUnsavedChanges: options?.ignoreChanges || options?.discardUnsavedChanges,
        });
        if (didClose) {
          options?.onWorkspaceClose?.();
        }
        return didClose;
      }

      props.closeWorkspace(options);
      return true;
    },
    [props],
  );

  const closeWorkspaceWithSavedChanges = useCallback(async () => {
    if (isWorkspace2Props(props)) {
      return props.closeWorkspace({ discardUnsavedChanges: true });
    }

    props.closeWorkspaceWithSavedChanges();
    return true;
  }, [props]);

  const openOrderWorkspace = useCallback(
    async (workspaceName: string, workspaceProps?: object) => {
      if (isWorkspace2Props(props)) {
        await props.launchChildWorkspace(workspaceName, workspaceProps);
        return;
      }

      props.closeWorkspace({
        ignoreChanges: true,
        onWorkspaceClose: () => launchPatientWorkspace(workspaceName, workspaceProps),
        closeWorkspaceGroup: false,
      });
    },
    [props],
  );

  useEffect(() => {
    const basketHasChanges = !!orders.length;

    if (isWorkspace2Props(props)) {
      setHasUnsavedChanges(basketHasChanges);
    } else {
      props.promptBeforeClosing(() => basketHasChanges);
    }
  }, [orders.length, props]);

  const openStartVisitDialog = useCallback(() => {
    const dispose = showModal('start-visit-dialog', {
      patientUuid,
      closeModal: () => dispose(),
    });
  }, [patientUuid]);

  const handleSave = useCallback(async () => {
    const abortController = new AbortController();
    setCreatingEncounterError('');
    const orderEncounterUuid = encounterUuid;
    setIsSavingOrders(true);
    // If there's no encounter present, create an encounter along with the orders.
    if (!orderEncounterUuid) {
      try {
        await postOrdersOnNewEncounter(
          patientUuid,
          config?.orderEncounterType,
          activeVisitRequired ? activeVisit : null,
          session?.sessionLocation?.uuid,
          abortController,
        );
        mutateEncounterUuid();
        clearOrders();
        await mutateOrders();
        await closeWorkspaceWithSavedChanges();
        showOrderSuccessToast(t, orders);
      } catch (e) {
        console.error(e);
        setCreatingEncounterError(
          e.responseBody?.error?.message ||
            t('tryReopeningTheWorkspaceAgain', 'Please try launching the workspace again'),
        );
      }
    } else {
      const erroredItems = await postOrders(orderEncounterUuid, abortController);
      clearOrders({ exceptThoseMatching: (item) => erroredItems.map((e) => e.display).includes(item.display) });
      await mutateOrders();
      if (erroredItems.length === 0) {
        await closeWorkspaceWithSavedChanges();
        showOrderSuccessToast(t, orders);
      } else {
        setOrdersWithErrors(erroredItems);
      }
    }
    setIsSavingOrders(false);
    return () => abortController.abort();
  }, [
    activeVisit,
    activeVisitRequired,
    clearOrders,
    closeWorkspaceWithSavedChanges,
    config,
    encounterUuid,
    mutateEncounterUuid,
    mutateOrders,
    orders,
    patientUuid,
    session,
    t,
  ]);

  const handleCancel = useCallback(() => {
    void closeCurrentWorkspace({ onWorkspaceClose: clearOrders });
  }, [clearOrders, closeCurrentWorkspace]);

  const content = (
    <>
      <div className={styles.container}>
        <div className={styles.orderBasketContainer}>
          <ExtensionSlot
            className={classNames(styles.orderBasketSlot, {
              [styles.orderBasketSlotTablet]: isTablet,
            })}
            name="order-basket-slot"
            state={{
              launchAddDrugOrder: (order?: OrderBasketItem) =>
                openOrderWorkspace(orderWorkspaceNames.drug, order ? { order } : {}),
              launchAddLabOrder: (orderTypeUuid: string, order?: OrderBasketItem) =>
                openOrderWorkspace(orderWorkspaceNames.lab, {
                  orderTypeUuid,
                  ...(order ? { order } : {}),
                }),
            }}
          />
          {config?.orderTypes?.length > 0 &&
            config.orderTypes.map((orderType) => (
              <div className={styles.orderPanel} key={orderType.orderTypeUuid}>
                <GeneralOrderType
                  key={orderType.orderTypeUuid}
                  orderTypeUuid={orderType.orderTypeUuid}
                  label={orderType.label}
                  orderableConceptSets={orderType.orderableConceptSets}
                  launchOrderableConceptWorkspace={(orderTypeUuid, order) =>
                    void openOrderWorkspace(orderWorkspaceNames.general, {
                      orderTypeUuid,
                      ...(order ? { order } : {}),
                    })
                  }
                />
              </div>
            ))}
        </div>

        <div>
          {(creatingEncounterError || errorFetchingEncounterUuid) && (
            <InlineNotification
              kind="error"
              title={t('tryReopeningTheWorkspaceAgain', 'Please try launching the workspace again')}
              subtitle={creatingEncounterError}
              lowContrast={true}
              className={styles.inlineNotification}
            />
          )}
          {ordersWithErrors.map((order) => (
            <InlineNotification
              key={order.uuid}
              lowContrast
              kind="error"
              title={t('saveDrugOrderFailed', 'Error ordering {{orderName}}', { orderName: order.display })}
              subtitle={order.extractedOrderError?.fieldErrors?.join(', ')}
              className={styles.inlineNotification}
            />
          ))}
          <ButtonSet className={styles.buttonSet}>
            <Button className={styles.actionButton} kind="secondary" onClick={handleCancel}>
              {t('cancel', 'Cancel')}
            </Button>
            <Button
              className={styles.actionButton}
              kind="primary"
              onClick={handleSave}
              disabled={
                isSavingOrders ||
                !orders?.length ||
                isLoadingEncounterUuid ||
                (activeVisitRequired && !activeVisit) ||
                orders?.some(({ isOrderIncomplete }) => isOrderIncomplete)
              }
            >
              {isSavingOrders ? (
                <InlineLoading description={t('saving', 'Saving') + '...'} />
              ) : (
                <span>{t('signAndClose', 'Sign and close')}</span>
              )}
            </Button>
          </ButtonSet>
        </div>
      </div>
      {activeVisitRequired && !activeVisit && (
        <ActionableNotification
          kind="error"
          actionButtonLabel={t('startVisit', 'Start visit')}
          onActionButtonClick={openStartVisitDialog}
          title={t('startAVisitToRecordOrders', 'Start a visit to order')}
          subtitle={t('activeVisitRequired', 'An active visit is required to make orders')}
          lowContrast={true}
          inline
          className={styles.actionNotification}
          hasFocus
        />
      )}
    </>
  );

  if (isWorkspace2Props(props)) {
    return (
      <Workspace2 title={t('orderBasketWorkspaceTitle', 'Order Basket')} hasUnsavedChanges={hasUnsavedChanges}>
        {content}
      </Workspace2>
    );
  }

  return content;
};

function showOrderSuccessToast(t: TFunction, patientOrderItems: OrderBasketItem[]) {
  const orderedString = patientOrderItems
    .filter((item) => ['NEW', 'RENEW'].includes(item.action))
    .map((item) => item.display)
    .join(', ');
  const updatedString = patientOrderItems
    .filter((item) => item.action === 'REVISE')
    .map((item) => item.display)
    .join(', ');
  const discontinuedString = patientOrderItems
    .filter((item) => item.action === 'DISCONTINUE')
    .map((item) => item.display)
    .join(', ');

  showSnackbar({
    isLowContrast: true,
    kind: 'success',
    title: t('orderCompleted', 'Placed orders'),
    subtitle:
      (orderedString && `${t('ordered', 'Placed order for')} ${orderedString}. `) +
      (updatedString && `${t('updated', 'Updated')} ${updatedString}. `) +
      (discontinuedString && `${t('discontinued', 'Discontinued')} ${discontinuedString}.`),
  });
}

export default OrderBasket;
