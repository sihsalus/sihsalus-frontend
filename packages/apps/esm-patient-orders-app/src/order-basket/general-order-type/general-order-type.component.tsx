import { Button, Tile } from '@carbon/react';
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
};

function getOrderTypeIcon(icon?: string) {
  return icon ? (iconAliases[icon] ?? icon) : 'omrs-icon-generic-order-type';
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

  return (
    <Tile className={classNames(styles.desktopTile, { [styles.collapsedTile]: !isExpanded })}>
      <div className={styles.container}>
        <div className={styles.iconAndLabel}>
          <MaybeIcon icon={getOrderTypeIcon(icon)} size={24} />
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
            iconDescription="View"
            disabled={orders.length === 0}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {t('add', 'Add')}
          </Button>
        </div>
      </div>
      {isExpanded && (
        <>
          {incompleteOrderBasketItems.length > 0 && (
            <>
              {incompleteOrderBasketItems.map((order, index) => (
                <OrderBasketItemTile
                  key={index}
                  orderBasketItem={order}
                  onItemClick={() => openOrderForm(order)}
                  onRemoveClick={() => removeOrder(order)}
                />
              ))}
            </>
          )}
          {newOrderBasketItems.length > 0 && (
            <>
              {newOrderBasketItems.map((order, index) => (
                <OrderBasketItemTile
                  key={index}
                  orderBasketItem={order}
                  onItemClick={() => openOrderForm(order)}
                  onRemoveClick={() => removeOrder(order)}
                />
              ))}
            </>
          )}

          {renewedOrderBasketItems.length > 0 && (
            <>
              {renewedOrderBasketItems.map((item, index) => (
                <OrderBasketItemTile
                  key={index}
                  orderBasketItem={item}
                  onItemClick={() => openOrderForm(item)}
                  onRemoveClick={() => removeOrder(item)}
                />
              ))}
            </>
          )}

          {revisedOrderBasketItems.length > 0 && (
            <>
              {revisedOrderBasketItems.map((item, index) => (
                <OrderBasketItemTile
                  key={index}
                  orderBasketItem={item}
                  onItemClick={() => openOrderForm(item)}
                  onRemoveClick={() => removeOrder(item)}
                />
              ))}
            </>
          )}

          {discontinuedOrderBasketItems.length > 0 && (
            <>
              {discontinuedOrderBasketItems.map((item, index) => (
                <OrderBasketItemTile
                  key={index}
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
