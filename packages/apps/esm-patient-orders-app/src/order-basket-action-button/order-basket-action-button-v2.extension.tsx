import { ActionMenuButton2, ShoppingCartIcon } from '@openmrs/esm-framework';
import { type PatientChartWorkspaceActionButtonProps, useOrderBasket } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

const OrderBasketActionButton: React.FC<PatientChartWorkspaceActionButtonProps> = ({ groupProps }) => {
  const { t } = useTranslation();
  const { orders } = useOrderBasket();
  const patientUuid = groupProps?.patientUuid;

  return (
    <ActionMenuButton2
      icon={(props: ComponentProps<typeof ShoppingCartIcon>) => <ShoppingCartIcon {...props} />}
      label={t('orderBasket', 'Order basket')}
      tagContent={orders?.length > 0 ? orders.length : undefined}
      workspaceToLaunch={{
        workspaceName: 'order-basket',
        workspaceProps: patientUuid ? { patientUuid } : undefined,
        windowProps: patientUuid ? { patientUuid } : undefined,
      }}
    />
  );
};

export default OrderBasketActionButton;
