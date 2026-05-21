import { Button, Search } from '@carbon/react';
import {
  ArrowLeftIcon,
  type DefaultWorkspaceProps,
  ResponsiveWrapper,
  useConfig,
  useDebounce,
  useLayoutType,
  Workspace2,
} from '@openmrs/esm-framework';
import {
  launchPatientWorkspace,
  type OrderBasketItem,
  type PatientWorkspace2DefinitionProps,
  useOrderBasket,
  useOrderType,
} from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../../config-schema';
import { OrderForm } from '../general-order-form/general-order-form.component';
import { prepOrderPostData } from '../resources';

import styles from './orderable-concept-search.scss';
import OrderableConceptSearchResults from './search-results.component';

interface LegacyOrderableConceptSearchWorkspaceProps extends DefaultWorkspaceProps {
  order?: OrderBasketItem;
  orderTypeUuid: string;
  orderableConceptClasses?: Array<string>;
  orderableConceptSets?: Array<string>;
  orderBasketWorkspaceName?: string;
}

type Workspace2OrderableConceptSearchWorkspaceProps = PatientWorkspace2DefinitionProps<
  {
    order?: OrderBasketItem;
    orderTypeUuid: string;
    orderableConceptClasses?: Array<string>;
    orderableConceptSets?: Array<string>;
    orderBasketWorkspaceName?: string;
  },
  object
>;

type OrderableConceptSearchWorkspaceProps =
  | LegacyOrderableConceptSearchWorkspaceProps
  | Workspace2OrderableConceptSearchWorkspaceProps;

function isWorkspace2Props(
  props: OrderableConceptSearchWorkspaceProps,
): props is Workspace2OrderableConceptSearchWorkspaceProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

type DrugsOrOrders = Pick<OrderBasketItem, 'action'>;

export function ordersEqual(order1: DrugsOrOrders, order2: DrugsOrOrders) {
  return order1.action === order2.action;
}

const OrderableConceptSearchWorkspace: React.FC<OrderableConceptSearchWorkspaceProps> = (props) => {
  const { t } = useTranslation();
  const {
    order: initialOrder,
    orderTypeUuid,
    orderableConceptSets: propOrderableConceptSets,
  } = isWorkspace2Props(props) ? props.workspaceProps : props;
  const orderBasketWorkspaceName = isWorkspace2Props(props)
    ? (props.workspaceProps.orderBasketWorkspaceName ?? 'order-basket')
    : (props.orderBasketWorkspaceName ?? 'order-basket');
  const isTablet = useLayoutType() === 'tablet';
  const { careSettingUuid, orderTypes } = useConfig<ConfigObject>();
  const prepareOrderPostData = useCallback(
    (order: OrderBasketItem, patientUuid: string, encounterUuid: string | null) =>
      prepOrderPostData(order, patientUuid, encounterUuid, careSettingUuid),
    [careSettingUuid],
  );
  const { orders } = useOrderBasket<OrderBasketItem>(orderTypeUuid, prepareOrderPostData);
  const [currentOrder, setCurrentOrder] = useState(initialOrder);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [workspaceTitle, setWorkspaceTitle] = useState(t('searchOrderables', 'Search orderables'));
  const { orderType } = useOrderType(orderTypeUuid);
  const handleSetTitle = useCallback(
    (value: string) => {
      if (isWorkspace2Props(props)) {
        setWorkspaceTitle(value);
      } else {
        props.setTitle(value);
      }
    },
    [props],
  );

  const returnToOrderBasket = useCallback(
    (discardUnsavedChanges = false) => {
      if (isWorkspace2Props(props)) {
        if (discardUnsavedChanges) {
          setHasUnsavedChanges(false);
        }
        void props.closeWorkspace({ discardUnsavedChanges });
        return;
      }

      props.closeWorkspace({
        ignoreChanges: discardUnsavedChanges,
        onWorkspaceClose: () => launchPatientWorkspace(orderBasketWorkspaceName),
        closeWorkspaceGroup: false,
      });
    },
    [orderBasketWorkspaceName, props],
  );

  const handlePromptBeforeClosing = useCallback(
    (callback: () => boolean) => {
      if (isWorkspace2Props(props)) {
        setHasUnsavedChanges(callback());
      } else {
        props.promptBeforeClosing(callback);
      }
    },
    [props],
  );

  useEffect(() => {
    if (orderType) {
      handleSetTitle(
        t(`addOrderableForOrderType`, 'Add {{orderTypeDisplay}}', {
          orderTypeDisplay: orderType.display.toLocaleLowerCase(),
        }),
      );
    }
  }, [handleSetTitle, orderType, t]);

  const orderableConceptSets = useMemo(
    () =>
      orderTypes.find((orderType) => orderType.orderTypeUuid === orderTypeUuid)?.orderableConceptSets ??
      propOrderableConceptSets ??
      [],
    [orderTypeUuid, orderTypes, propOrderableConceptSets],
  );

  const openOrderForm = useCallback(
    (order: OrderBasketItem) => {
      const existingOrder = orders.find((prevOrder) => ordersEqual(prevOrder, order));
      if (existingOrder) {
        setCurrentOrder(existingOrder);
      } else {
        setCurrentOrder(order);
      }
    },
    [orders],
  );

  const content = (
    <div className={styles.workspaceWrapper}>
      {!isTablet && (
        <div className={styles.backButton}>
          <Button
            iconDescription="Return to order basket"
            kind="ghost"
            onClick={() => returnToOrderBasket()}
            renderIcon={(props: ComponentProps<typeof ArrowLeftIcon>) => <ArrowLeftIcon size={24} {...props} />}
            size="sm"
          >
            <span>{t('backToOrderBasket', 'Back to order basket')}</span>
          </Button>
        </div>
      )}
      {currentOrder ? (
        <OrderForm
          initialOrder={currentOrder}
          promptBeforeClosing={handlePromptBeforeClosing}
          orderTypeUuid={orderTypeUuid}
          orderableConceptSets={orderableConceptSets}
          returnToOrderBasket={returnToOrderBasket}
        />
      ) : (
        <ConceptSearch
          openOrderForm={openOrderForm}
          returnToOrderBasket={returnToOrderBasket}
          orderableConceptSets={orderableConceptSets}
          orderTypeUuid={orderTypeUuid}
        />
      )}
    </div>
  );

  if (isWorkspace2Props(props)) {
    return (
      <Workspace2 title={workspaceTitle} hasUnsavedChanges={hasUnsavedChanges}>
        {content}
      </Workspace2>
    );
  }

  return content;
};

interface ConceptSearchProps {
  returnToOrderBasket: (discardUnsavedChanges?: boolean) => void;
  openOrderForm: (search: OrderBasketItem) => void;
  orderTypeUuid: string;
  orderableConceptSets: Array<string>;
}

function ConceptSearch({
  returnToOrderBasket,
  orderTypeUuid,
  openOrderForm,
  orderableConceptSets,
}: ConceptSearchProps) {
  const { t } = useTranslation();
  const { orderType } = useOrderType(orderTypeUuid);
  const isTablet = useLayoutType() === 'tablet';
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const focusAndClearSearchInput = () => {
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  const handleSearchTermChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setSearchTerm(event.target.value ?? '');

  return (
    <div className={styles.searchPopupContainer}>
      <ResponsiveWrapper>
        <Search
          autoFocus
          size="lg"
          placeholder={t('searchFieldOrder', 'Search for {{orderType}} order', {
            orderType: orderType?.display ?? '',
          })}
          labelText={t('searchFieldOrder', 'Search for {{orderType}} order', {
            orderType: orderType?.display ?? '',
          })}
          onChange={handleSearchTermChange}
          ref={searchInputRef}
          value={searchTerm}
        />
      </ResponsiveWrapper>
      <OrderableConceptSearchResults
        searchTerm={debouncedSearchTerm}
        openOrderForm={openOrderForm}
        focusAndClearSearchInput={focusAndClearSearchInput}
        returnToOrderBasket={returnToOrderBasket}
        orderTypeUuid={orderTypeUuid}
        cancelOrder={() => returnToOrderBasket()}
        orderableConceptSets={orderableConceptSets}
      />
      {isTablet && (
        <div className={styles.separatorContainer}>
          <p className={styles.separator}>{t('or', 'or')}</p>
          <Button iconDescription="Return to order basket" kind="ghost" onClick={() => returnToOrderBasket()}>
            {t('returnToOrderBasket', 'Return to order basket')}
          </Button>
        </div>
      )}
    </div>
  );
}

export default OrderableConceptSearchWorkspace;
