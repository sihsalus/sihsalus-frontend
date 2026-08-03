import { Button, ClickableTile, Tag, Tile } from '@carbon/react';
import { TrashCanIcon, useLayoutType, WarningIcon } from '@openmrs/esm-framework';
import { type OrderBasketItem } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { type ComponentProps, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './order-basket-item-tile.scss';

export interface OrderBasketItemTileProps {
  orderBasketItem: OrderBasketItem;
  onItemClick: () => void;
  onRemoveClick: () => void;
}

const OrderBasketItemTile: React.FC<OrderBasketItemTileProps> = ({ orderBasketItem, onItemClick, onRemoveClick }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';

  // This here is really dirty, but required.
  // If the ref's value is false, we won't react to the ClickableTile's handleClick function.
  // Why is this necessary?
  // The "Remove" button is nested inside the ClickableTile. If the button's clicked, the tile also raises the
  // handleClick event later. Not sure if this is a bug, but this shouldn't be possible in our flows.
  // Hence, we manually prevent the handleClick callback from being invoked as soon as the button is pressed once.
  const shouldOnClickBeCalled = useRef(true);

  const labTile = (
    <div className={styles.orderBasketItemTile}>
      <div className={styles.orderContent}>
        <OrderActionLabel orderBasketItem={orderBasketItem} />
        <span className={styles.name}>{orderBasketItem.concept?.display}</span>
        <span className={styles.label01}>
          {!!orderBasketItem.orderError && (
            <>
              <br />
              <span className={styles.orderErrorText}>
                <WarningIcon size={16} />
                &nbsp;
                <span className={styles.label01}>{t('error', 'Error').toUpperCase()}</span> &nbsp;
                {t(
                  'orderSubmissionFailedItemMessage',
                  'No se pudo registrar esta orden. Revise los datos e intente nuevamente.',
                )}
              </span>
            </>
          )}
        </span>
      </div>
      <Button
        className={styles.removeButton}
        kind="ghost"
        hasIconOnly={true}
        renderIcon={(props: ComponentProps<typeof TrashCanIcon>) => <TrashCanIcon size={16} {...props} />}
        iconDescription={t('removeFromBasket', 'Remove from basket')}
        onClick={() => {
          shouldOnClickBeCalled.current = false;
          onRemoveClick();
        }}
        tooltipPosition="left"
      />
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
};

function OrderActionLabel({ orderBasketItem }: { orderBasketItem: OrderBasketItem }) {
  const { t } = useTranslation();

  if (orderBasketItem.isOrderIncomplete) {
    return (
      <Tag
        className={styles.orderStatus}
        size="sm"
        type="red"
        role="status"
        aria-atomic
        aria-label={t('orderActionIncomplete', 'Incomplete')}
      >
        {t('orderActionIncomplete', 'Incomplete')}
      </Tag>
    );
  }

  switch (orderBasketItem.action) {
    case 'NEW':
      return (
        <Tag
          className={styles.orderStatus}
          size="sm"
          type="green"
          role="status"
          aria-label={t('orderActionNew', 'New')}
        >
          {t('orderActionNew', 'New')}
        </Tag>
      );
    case 'RENEW':
      return (
        <Tag
          className={styles.orderStatus}
          size="sm"
          type="green"
          role="status"
          aria-atomic
          aria-label={t('orderActionRenew', 'Renew')}
        >
          {t('orderActionRenew', 'Renew')}
        </Tag>
      );
    case 'REVISE':
      return (
        <Tag
          className={styles.orderStatus}
          size="sm"
          type="blue"
          role="status"
          aria-atomic
          aria-label={t('orderActionRevise', 'Modify')}
        >
          {t('orderActionRevise', 'Modify')}
        </Tag>
      );
    case 'DISCONTINUE':
      return (
        <Tag
          className={styles.orderStatus}
          size="sm"
          type="gray"
          role="status"
          aria-atomic
          aria-label={t('orderActionDiscontinue', 'Discontinue')}
        >
          {t('orderActionDiscontinue', 'Discontinue')}
        </Tag>
      );
    default:
      return <></>;
  }
}

export default OrderBasketItemTile;
