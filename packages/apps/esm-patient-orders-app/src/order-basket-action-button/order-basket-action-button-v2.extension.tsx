import { ActionMenuButton2, ShoppingCartIcon } from '@openmrs/esm-framework';
import {
  type PatientChartWorkspaceActionButtonProps,
  useOrderBasket,
  usePatientChartStore,
} from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

const OrderBasketActionButton: React.FC<PatientChartWorkspaceActionButtonProps> = ({ groupProps }) => {
  const { t } = useTranslation();
  const { orders } = useOrderBasket();
  const patientChartContext = usePatientChartStore();
  const patientUuid = groupProps?.patientUuid ?? patientChartContext.patientUuid;
  const patientChartGroupProps =
    groupProps ??
    (patientUuid
      ? {
          patient: patientChartContext.patient,
          patientUuid,
          visitContext: patientChartContext.visitContext,
          mutateVisitContext: patientChartContext.mutateVisitContext,
        }
      : null);

  return (
    <ActionMenuButton2
      icon={(props: ComponentProps<typeof ShoppingCartIcon>) => <ShoppingCartIcon {...props} />}
      label={t('orderBasket', 'Order basket')}
      tagContent={orders?.length > 0 ? orders.length : undefined}
      workspaceToLaunch={{
        workspaceName: 'order-basket',
        workspaceProps: patientUuid ? { patientUuid } : undefined,
        windowProps: patientUuid ? { patientUuid } : undefined,
        groupProps: patientChartGroupProps,
      }}
    />
  );
};

export default OrderBasketActionButton;
