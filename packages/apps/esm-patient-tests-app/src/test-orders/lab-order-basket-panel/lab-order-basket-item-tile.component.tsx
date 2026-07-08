import { ClickableTile, IconButton, Tile } from '@carbon/react';
import {
  formatDate,
  parseDate,
  TrashCanIcon,
  useConfig,
  useLayoutType,
  usePatient,
  WarningIcon,
} from '@openmrs/esm-framework';
import { usePatientOrders } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../config-schema';
import type { TestOrderBasketItem } from '../../types';

import styles from './lab-order-basket-item-tile.scss';

export interface OrderBasketItemTileProps {
  orderBasketItem: TestOrderBasketItem;
  onItemClick: () => void;
  onRemoveClick: () => void;
}

export function LabOrderBasketItemTile({ orderBasketItem, onItemClick, onRemoveClick }: OrderBasketItemTileProps) {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { patientUuid } = usePatient();
  const config = useConfig<ConfigObject>();

  const { data: existingOrders } = usePatientOrders(
    patientUuid,
    'any',
    null,
    null,
    null,
    config.orders.careSettingUuid,
  );

  const hasRecentOrder = useMemo(() => {
    if (!existingOrders || !orderBasketItem.testType?.conceptUuid) return false;
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    return existingOrders.some(
      (existing) =>
        existing.concept?.uuid === orderBasketItem.testType.conceptUuid &&
        new Date(existing.dateActivated).getTime() >= oneHourAgo &&
        existing.action !== 'DISCONTINUE',
    );
  }, [existingOrders, orderBasketItem.testType?.conceptUuid]);

  // This here is really dirty, but required.
  // If the ref's value is false, we won't react to the ClickableTile's handleClick function.
  // Why is this necessary?
  // The "Remove" button is nested inside the ClickableTile. If the button's clicked, the tile also raises the
  // handleClick event later. Not sure if this is a bug, but this shouldn't be possible in our flows.
  // Hence, we manually prevent the handleClick callback from being invoked as soon as the button is pressed once.
  const shouldOnClickBeCalled = useRef(true);

  const labTile = (
    <div>
      <div className={styles.orderBasketItemTile}>
        <div className={styles.clipTextWithEllipsis}>
          <OrderActionLabel orderBasketItem={orderBasketItem} />
          <OrderPriorityLabel orderBasketItem={orderBasketItem} />
          <br />
          <span className={styles.name}>{orderBasketItem.testType?.label}</span>
          {hasRecentOrder && (
            <>
              <br />
              <span className={styles.orderWarningText}>
                <WarningIcon size={16} />
                &nbsp;
                <span className={styles.label01}>
                  {t('recentOrderWarning', 'La orden {{orderName}} fue realizada recientemente', {
                    orderName: orderBasketItem.testType?.label,
                  })}
                </span>
              </span>
            </>
          )}
          <span className={styles.label01}>
            {!!orderBasketItem.orderError && (
              <>
                <br />
                <span className={styles.orderErrorText}>
                  <WarningIcon size={16} />
                  &nbsp;
                  <span className={styles.label01}>{t('error', 'Error').toUpperCase()}</span> &nbsp;
                  {orderBasketItem.orderError.responseBody?.error?.message ?? orderBasketItem.orderError.message}
                </span>
              </>
            )}
          </span>
        </div>
        <IconButton
          size={isTablet ? 'lg' : 'sm'}
          kind="ghost"
          label={t('removeFromBasket', 'Remove from basket')}
          onClick={() => {
            shouldOnClickBeCalled.current = false;
            onRemoveClick();
          }}
          align="left"
        >
          <TrashCanIcon size={16} className={styles.removeButton} />
        </IconButton>
      </div>
    </div>
  );

  return orderBasketItem.action === 'DISCONTINUE' ? (
    <Tile>{labTile}</Tile>
  ) : (
    <ClickableTile
      role="listitem"
      className={classNames({
        [styles.clickableTileTablet]: isTablet,
        [styles.clickableTileDesktop]: !isTablet,
      })}
      onClick={() => shouldOnClickBeCalled.current && onItemClick()}
    >
      {labTile}
    </ClickableTile>
  );
}

function OrderActionLabel({ orderBasketItem }: { orderBasketItem: TestOrderBasketItem }) {
  const { t } = useTranslation();

  if (orderBasketItem.isOrderIncomplete) {
    return (
      <span
        className={styles.orderActionIncompleteLabel}
        role="status"
        aria-atomic
        aria-label={t('orderActionIncomplete', 'Incomplete')}
      >
        {t('orderActionIncomplete', 'Incomplete')}
      </span>
    );
  }

  switch (orderBasketItem.action) {
    case 'NEW':
      return (
        <span className={styles.orderActionNewLabel} role="status" aria-atomic aria-label={t('orderActionNew', 'New')}>
          {t('orderActionNew', 'New')}
        </span>
      );
    case 'RENEW':
      return (
        <span
          className={styles.orderActionRenewLabel}
          role="status"
          aria-atomic
          aria-label={t('orderActionRenew', 'Renew')}
        >
          {t('orderActionRenew', 'Renew')}
        </span>
      );
    case 'REVISE':
      return (
        <span
          className={styles.orderActionReviseLabel}
          role="status"
          aria-atomic
          aria-label={t('orderActionRevise', 'Modify')}
        >
          {t('orderActionRevise', 'Modify')}
        </span>
      );
    case 'DISCONTINUE':
      return (
        <span
          className={styles.orderActionDiscontinueLabel}
          role="status"
          aria-atomic
          aria-label={t('orderActionDiscontinue', 'Discontinue')}
        >
          {t('orderActionDiscontinue', 'Discontinue')}
        </span>
      );
    default:
      return <></>;
  }
}

function OrderPriorityLabel({ orderBasketItem }: { orderBasketItem: TestOrderBasketItem }) {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();

  if (!orderBasketItem.urgency) {
    return null;
  }

  const priorityConfig = config.priorityConfigs?.find((p) => p.conceptUuid === orderBasketItem.urgency);
  const priorityLabel = priorityConfig
    ? t(priorityConfig.label, { defaultValue: priorityConfig.label })
    : orderBasketItem.urgencyCode;

  const hasScheduledDate = priorityConfig?.requiresScheduledDate && orderBasketItem.scheduledDate;
  const dateStr = hasScheduledDate
    ? ` (${formatDate(
        typeof orderBasketItem.scheduledDate === 'string'
          ? parseDate(orderBasketItem.scheduledDate)
          : orderBasketItem.scheduledDate,
      )})`
    : '';

  return (
    <span className={styles.priorityLabel} role="status">
      {priorityLabel}
      {dateStr}
    </span>
  );
}
