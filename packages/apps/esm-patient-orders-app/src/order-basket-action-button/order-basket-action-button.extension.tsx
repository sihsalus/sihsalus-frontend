import { ActionMenuButton, ShoppingCartIcon, UserHasAccess } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit, useOrderBasket } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { orderBasketPrivileges } from '../order-basket-access';

const OrderBasketActionButton: React.FC = () => {
  const { t } = useTranslation();
  const { orders } = useOrderBasket();
  const launchOrderBasket = useLaunchWorkspaceRequiringVisit('order-basket');

  return (
    <UserHasAccess privilege={orderBasketPrivileges}>
      <ActionMenuButton
        getIcon={(props: ComponentProps<typeof ShoppingCartIcon>) => <ShoppingCartIcon {...props} />}
        label={t('orderBasket', 'Order basket')}
        iconDescription={t('medications', 'Medications')}
        handler={launchOrderBasket}
        type={'order'}
        tagContent={orders?.length > 0 ? orders?.length : null}
      />
    </UserHasAccess>
  );
};

export default OrderBasketActionButton;
