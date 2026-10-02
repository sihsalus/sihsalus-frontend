import { launchWorkspace2, showSnackbar } from '@openmrs/esm-framework';
import {
  type DrugOrderBasketItem,
  getPatientChartStore,
  type PatientWorkspace2DefinitionProps,
} from '@openmrs/esm-patient-common-lib';
import { useTranslation } from 'react-i18next';
import AddDrugOrder from './add-drug-order.component';

export interface AddDrugOrderWorkspaceProps {
  /**
   * Optional. If provided, the form edits this order. Note that this order could either
   * be an already submitted order that the user wants to modify, or a NEW pending order in
   * the order basket. To distinguish the two, check order.action.
   */
  order?: DrugOrderBasketItem;

  /**
   * This field should only be supplied for an existing order saved to the backend
   */
  orderToEditOrdererUuid?: string;

  /** Direct prescribing entry returns to the shared basket to review and sign pending orders. */
  returnToOrderBasket?: boolean;
}

/**
 * This workspace displays the drug order form for:
 * 1. adding a new drug order
 * 2. editing a pending (un-submitted) drug order in the order basket
 * 3. editing an existing (submitted) order
 *
 * On form save, it either saves the order in the order basket (case 1 and 2)
 * or directly submits the modified order to the server (case 3).
 *
 *
 * This workspace must only be used within the patient chart.
 * @see exported-add-drug-order.workspace.tsx
 */
export default function AddDrugOrderWorkspace({
  workspaceProps: { order, orderToEditOrdererUuid, returnToOrderBasket },
  groupProps,
  windowProps,
  isRootWorkspace,
  closeWorkspace,
}: PatientWorkspace2DefinitionProps<AddDrugOrderWorkspaceProps, { encounterUuid?: string }>) {
  const { patient, patientUuid, visitContext } = groupProps;
  const { t } = useTranslation();
  const closeAndReturn: typeof closeWorkspace = async (options) => {
    const closed = await closeWorkspace(options);
    const current = getPatientChartStore().getState();
    if (
      closed &&
      returnToOrderBasket &&
      isRootWorkspace &&
      current.patientUuid === patientUuid &&
      current.visitContext?.uuid === visitContext?.uuid
    ) {
      try {
        if (!(await launchWorkspace2('order-basket', null, windowProps, groupProps))) {
          throw new Error('Order basket unavailable');
        }
      } catch {
        showSnackbar({
          kind: 'error',
          title: t('pendingOrdersNavigationTitle', 'Pending orders'),
          subtitle: t(
            'pendingOrdersNavigationError',
            'The order basket could not be opened. Your pending orders remain available from the order basket action.',
          ),
        });
      }
    }
    return closed;
  };
  return (
    <AddDrugOrder
      key={JSON.stringify([
        true,
        patientUuid,
        order?.previousOrder ?? order?.uuid ?? '',
        orderToEditOrdererUuid ?? '',
        visitContext?.uuid ?? '',
      ])}
      initialOrder={order}
      orderToEditOrdererUuid={orderToEditOrdererUuid}
      patient={patient}
      patientUuid={patientUuid}
      visitContext={visitContext}
      closeWorkspace={closeAndReturn}
      trackPatientChartContext
    />
  );
}
