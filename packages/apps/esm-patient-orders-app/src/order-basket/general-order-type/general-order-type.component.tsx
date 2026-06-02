import { Button, Tile } from '@carbon/react';
import { ImageMedical, Medication, UserFollow } from '@carbon/react/icons';
import { AddIcon, ChevronDownIcon, ChevronUpIcon, MaybeIcon } from '@openmrs/esm-framework';
import { type OrderBasketItem, useOrderBasket, useOrderType } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type OrderTypeDefinition } from '../../config-schema';

import styles from './general-order-panel.scss';
import OrderBasketItemTile from './order-basket-item-tile.component';
import { prepOrderPostData } from './resources';

interface GeneralOrderTypeProps extends OrderTypeDefinition {
  launchOrderableConceptWorkspace: (orderTypeUuid: string, order?: OrderBasketItem) => void;
  canCreateOrders: boolean;
  onMissingActiveVisit: () => void;
}

const iconAliases: Record<string, string> = {
  Syringe: 'omrs-icon-syringe',
  'User--follow': 'omrs-icon-user-follow',
  UserFollow: 'omrs-icon-user-follow',
  ImageMedical: 'omrs-icon-image-medical',
  Report: 'omrs-icon-report',
  UserXray: 'omrs-icon-user-xray',
  ReferralOrder: 'omrs-icon-referral-order',
};

function normalizeOrderTypeLabel(label?: string) {
  return (label ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}

function getOrderTypeIcon(icon?: string, label?: string, orderTypeUuid?: string) {
  const normalizedLabel = normalizeOrderTypeLabel(label);

  if (
    orderTypeUuid === 'f9c5d0b8-8b5a-11e5-8e9b-12345678a01a' ||
    normalizedLabel.includes('radiolog') ||
    normalizedLabel.includes('imagen')
  ) {
    return 'omrs-icon-image-medical';
  }

  if (
    orderTypeUuid === 'e1f95924-697a-11e3-bd76-0800271c1b75' ||
    normalizedLabel.includes('inmuniz') ||
    normalizedLabel.includes('immuniz') ||
    normalizedLabel.includes('vacun')
  ) {
    return 'omrs-icon-syringe';
  }

  if (
    orderTypeUuid === 'f3c2e4b6-8b5a-11e5-8e9b-12345678901b' ||
    normalizedLabel.includes('interconsulta') ||
    normalizedLabel.includes('referral') ||
    normalizedLabel.includes('refer')
  ) {
    return 'omrs-icon-referral-order';
  }

  const configuredIcon = icon ? (iconAliases[icon] ?? icon) : '';

  if (configuredIcon && configuredIcon !== 'omrs-icon-generic-order-type') {
    return configuredIcon;
  }

  return 'omrs-icon-generic-order-type';
}

function getOrderTypeIconComponent(icon: string) {
  switch (icon) {
    case 'omrs-icon-image-medical':
      return ImageMedical;
    case 'omrs-icon-syringe':
      return Medication;
    case 'omrs-icon-referral-order':
      return UserFollow;
    default:
      return null;
  }
}

const GeneralOrderType: React.FC<GeneralOrderTypeProps> = ({
  orderTypeUuid,
  label,
  icon,
  launchOrderableConceptWorkspace,
  canCreateOrders,
  onMissingActiveVisit,
}) => {
  const { t } = useTranslation();
  const { orderType, isLoadingOrderType } = useOrderType(orderTypeUuid);

  const { orders, setOrders } = useOrderBasket<OrderBasketItem>(orderTypeUuid, prepOrderPostData);
  const [isExpanded, setIsExpanded] = useState(orders.length > 0);
  const {
    incompleteOrderBasketItems,
    newOrderBasketItems,
    renewedOrderBasketItems,
    revisedOrderBasketItems,
    discontinuedOrderBasketItems,
  } = useMemo(() => {
    const incompleteOrderBasketItems: Array<OrderBasketItem> = [];
    const newOrderBasketItems: Array<OrderBasketItem> = [];
    const renewedOrderBasketItems: Array<OrderBasketItem> = [];
    const revisedOrderBasketItems: Array<OrderBasketItem> = [];
    const discontinuedOrderBasketItems: Array<OrderBasketItem> = [];

    orders.forEach((order) => {
      if (order?.isOrderIncomplete) {
        incompleteOrderBasketItems.push(order);
      } else if (order.action === 'NEW') {
        newOrderBasketItems.push(order);
      } else if (order.action === 'RENEW') {
        renewedOrderBasketItems.push(order);
      } else if (order.action === 'REVISE') {
        revisedOrderBasketItems.push(order);
      } else if (order.action === 'DISCONTINUE') {
        discontinuedOrderBasketItems.push(order);
      }
    });

    return {
      incompleteOrderBasketItems,
      newOrderBasketItems,
      renewedOrderBasketItems,
      revisedOrderBasketItems,
      discontinuedOrderBasketItems,
    };
  }, [orders]);

  const openConceptSearch = () => {
    if (!canCreateOrders) {
      onMissingActiveVisit();
      return;
    }

    launchOrderableConceptWorkspace(orderTypeUuid);
  };

  const openOrderForm = (order: OrderBasketItem) => {
    if (!canCreateOrders) {
      onMissingActiveVisit();
      return;
    }

    launchOrderableConceptWorkspace(orderTypeUuid, order);
  };

  const removeOrder = useCallback(
    (order: OrderBasketItem) => {
      const newOrders = [...orders];
      newOrders.splice(orders.indexOf(order), 1);
      setOrders(newOrders);
    },
    [orders, setOrders],
  );

  useEffect(() => {
    setIsExpanded(orders.length > 0);
  }, [orders]);

  if (isLoadingOrderType) {
    return null;
  }

  const orderTypeDisplay = label ? t(label, { defaultValue: label }) : (orderType?.display ?? t('order', 'Order'));
  const orderTypeIcon = getOrderTypeIcon(
    icon,
    `${label ?? ''} ${orderTypeDisplay} ${orderType?.display ?? ''}`,
    orderTypeUuid,
  );
  const CarbonOrderTypeIcon = getOrderTypeIconComponent(orderTypeIcon);

  const getOrderBasketItemKey = (item: OrderBasketItem) =>
    item?.uuid ??
    item?.orderNumber ??
    `${item?.action ?? 'unknown'}-${item?.concept?.uuid ?? item?.concept?.display ?? 'concept'}-${item?.orderType ?? 'type'}`;

  return (
    <Tile className={classNames(styles.desktopTile, { [styles.collapsedTile]: !isExpanded })}>
      <div className={styles.container}>
        <div className={styles.iconAndLabel}>
          {CarbonOrderTypeIcon ? (
            <CarbonOrderTypeIcon aria-hidden="true" className={styles.orderTypeIcon} size={24} />
          ) : (
            <MaybeIcon icon={orderTypeIcon} size={24} />
          )}
          <h4 className={styles.heading}>{`${orderTypeDisplay} (${orders.length})`}</h4>
        </div>
        <div className={styles.buttonContainer}>
          <Button
            className={styles.addButton}
            kind="ghost"
            renderIcon={(props: ComponentProps<typeof AddIcon>) => <AddIcon size={16} {...props} />}
            iconDescription={t('addOrder', 'Add order')}
            onClick={openConceptSearch}
            disabled={!canCreateOrders}
            size="sm"
          >
            {t('add', 'Add')}
          </Button>
          <Button
            className={styles.chevron}
            hasIconOnly
            kind="ghost"
            renderIcon={(props: ComponentProps<typeof ChevronUpIcon>) =>
              isExpanded ? <ChevronUpIcon size={16} {...props} /> : <ChevronDownIcon size={16} {...props} />
            }
            iconDescription={isExpanded ? t('collapseOrders', 'Collapse orders') : t('expandOrders', 'Expand orders')}
            disabled={orders.length === 0}
            onClick={() => setIsExpanded(!isExpanded)}
          />
        </div>
      </div>
      {isExpanded && (
        <>
          {incompleteOrderBasketItems.length > 0 && (
            <>
              {incompleteOrderBasketItems.map((order) => (
                <OrderBasketItemTile
                  key={getOrderBasketItemKey(order)}
                  orderBasketItem={order}
                  onItemClick={() => openOrderForm(order)}
                  onRemoveClick={() => removeOrder(order)}
                />
              ))}
            </>
          )}
          {newOrderBasketItems.length > 0 && (
            <>
              {newOrderBasketItems.map((order) => (
                <OrderBasketItemTile
                  key={getOrderBasketItemKey(order)}
                  orderBasketItem={order}
                  onItemClick={() => openOrderForm(order)}
                  onRemoveClick={() => removeOrder(order)}
                />
              ))}
            </>
          )}

          {renewedOrderBasketItems.length > 0 && (
            <>
              {renewedOrderBasketItems.map((item) => (
                <OrderBasketItemTile
                  key={getOrderBasketItemKey(item)}
                  orderBasketItem={item}
                  onItemClick={() => openOrderForm(item)}
                  onRemoveClick={() => removeOrder(item)}
                />
              ))}
            </>
          )}

          {revisedOrderBasketItems.length > 0 && (
            <>
              {revisedOrderBasketItems.map((item) => (
                <OrderBasketItemTile
                  key={getOrderBasketItemKey(item)}
                  orderBasketItem={item}
                  onItemClick={() => openOrderForm(item)}
                  onRemoveClick={() => removeOrder(item)}
                />
              ))}
            </>
          )}

          {discontinuedOrderBasketItems.length > 0 && (
            <>
              {discontinuedOrderBasketItems.map((item) => (
                <OrderBasketItemTile
                  key={getOrderBasketItemKey(item)}
                  orderBasketItem={item}
                  onItemClick={() => openOrderForm(item)}
                  onRemoveClick={() => removeOrder(item)}
                />
              ))}
            </>
          )}
        </>
      )}
    </Tile>
  );
};

export default GeneralOrderType;
