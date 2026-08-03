import { ClickableTile, IconButton, Tag, Tile } from '@carbon/react';
import { ExtensionSlot, TrashCanIcon, useLayoutType, WarningIcon } from '@openmrs/esm-framework';
import { type DrugOrderBasketItem } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './order-basket-item-tile.scss';

export interface OrderBasketItemTileProps {
  orderBasketItem: DrugOrderBasketItem;
  onItemClick: () => void;
  onRemoveClick: () => void;
}

export default function OrderBasketItemTile({ orderBasketItem, onItemClick, onRemoveClick }: OrderBasketItemTileProps) {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';

  // This here is really dirty, but required.
  // If the ref's value is false, we won't react to the ClickableTile's handleClick function.
  // Why is this necessary?
  // The "Remove" button is nested inside the ClickableTile. If the button's clicked, the tile also raises the
  // handleClick event later. Not sure if this is a bug, but this shouldn't be possible in our flows.
  // Hence, we manually prevent the handleClick callback from being invoked as soon as the button is pressed once.
  const shouldOnClickBeCalled = useRef(true);

  const additionalInfoSlotState = useMemo(
    () => ({
      orderItemUuid: orderBasketItem.drug.uuid,
    }),
    [orderBasketItem],
  );

  const tileContent = (
    <div>
      <div className={styles.orderBasketItemTile}>
        <div className={styles.orderContent}>
          <OrderActionLabel orderBasketItem={orderBasketItem} />
          {orderBasketItem.isFreeTextDosage ? (
            <div className={styles.orderTitle}>
              <span className={styles.drugName}>{orderBasketItem.drug?.display}</span>
              {orderBasketItem.freeTextDosage && (
                <span className={styles.dosageInfo}> &mdash; {orderBasketItem.freeTextDosage}</span>
              )}
            </div>
          ) : (
            <div className={styles.orderTitle}>
              <span className={styles.drugName}>{orderBasketItem.drug?.display}</span>
              <span className={styles.dosageInfo}>
                {' '}
                {orderBasketItem.drug?.strength && <>&mdash; {orderBasketItem.drug?.strength}</>}{' '}
                {orderBasketItem.drug?.dosageForm?.display && <>&mdash; {orderBasketItem.drug.dosageForm?.display}</>}
              </span>
            </div>
          )}
          {orderBasketItem.dosage != null && (
            <span className={styles.orderDetailLine}>
              <span className={styles.doseCaption}>{t('dose', 'Dose').toUpperCase()}</span>{' '}
              <span className={styles.dosageLabel}>
                {orderBasketItem.dosage} {orderBasketItem.unit?.value ?? ''}
              </span>{' '}
              <span className={styles.dosageInfo}>
                {orderBasketItem.route?.value && <>&mdash; {orderBasketItem.route.value} </>}
                {orderBasketItem.frequency?.value && <>&mdash; {orderBasketItem.frequency.value} </>}
                {orderBasketItem.numRefills ? (
                  <>
                    &mdash; {t('refills', 'Refills').toUpperCase()} {orderBasketItem.numRefills}{' '}
                  </>
                ) : null}
                {orderBasketItem.pillsDispensed ? (
                  <>
                    &mdash; {t('quantity', 'Quantity').toUpperCase()} {orderBasketItem.pillsDispensed}{' '}
                    {orderBasketItem.quantityUnits?.value?.toLowerCase()}{' '}
                  </>
                ) : null}
                {orderBasketItem.patientInstructions && <>&mdash; {orderBasketItem.patientInstructions}</>}
              </span>
            </span>
          )}
          <span className={styles.orderDetailLine}>
            {orderBasketItem.indication && (
              <>
                <span className={styles.indicationLabel}>{t('indication', 'Indication').toUpperCase()}</span>{' '}
                <span className={styles.dosageInfo}>{orderBasketItem.indication}</span>
              </>
            )}
            {!!orderBasketItem.orderError && (
              <>
                <br />
                <span className={styles.orderErrorText}>
                  <WarningIcon size={16} /> &nbsp;{' '}
                  <span className={styles.label01}>{t('error', 'Error').toUpperCase()}</span> &nbsp;
                  {orderBasketItem.orderError.responseBody?.error?.message ?? orderBasketItem.orderError.message}
                </span>
              </>
            )}
          </span>
        </div>
        <IconButton
          kind="ghost"
          align="left"
          size={isTablet ? 'lg' : 'sm'}
          label={t('removeFromBasket', 'Remove from basket')}
          onClick={() => {
            shouldOnClickBeCalled.current = false;
            onRemoveClick();
          }}
        >
          <TrashCanIcon size={16} className={styles.removeButton} />
        </IconButton>
      </div>
      <ExtensionSlot
        name="order-item-additional-info-slot"
        state={additionalInfoSlotState}
        className={styles.additionalInfoContainer}
      />
    </div>
  );

  return orderBasketItem.action === 'DISCONTINUE' ? (
    <Tile>{tileContent}</Tile>
  ) : (
    <ClickableTile
      role="listitem"
      className={classNames({
        [styles.clickableTileTablet]: isTablet,
        [styles.clickableTileDesktop]: !isTablet,
      })}
      onClick={() => shouldOnClickBeCalled.current && onItemClick()}
    >
      {tileContent}
    </ClickableTile>
  );
}

function OrderActionLabel({ orderBasketItem }: { orderBasketItem: DrugOrderBasketItem }) {
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
