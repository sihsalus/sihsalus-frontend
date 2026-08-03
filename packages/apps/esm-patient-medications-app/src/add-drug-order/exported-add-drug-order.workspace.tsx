import { type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { type DrugOrderBasketItem } from '@openmrs/esm-patient-common-lib';
import AddDrugOrder from './add-drug-order.component';

export interface AddDrugOrderWorkspaceAdditionalProps {
  order?: DrugOrderBasketItem;
  orderToEditOrdererUuid?: string;
}

/**
 * This workspace is meant for use outside the patient chart
 * @see add-drug-order.workspace.tsx
 */
export default function ExportedAddDrugOrderWorkspace({
  workspaceProps: { order, orderToEditOrdererUuid },
  windowProps: { patient, patientUuid, visitContext },
  closeWorkspace,
}: Workspace2DefinitionProps<
  AddDrugOrderWorkspaceAdditionalProps,
  { patient: fhir.Patient; patientUuid: string; visitContext: import('@openmrs/esm-framework').Visit }
>) {
  return (
    <AddDrugOrder
      key={JSON.stringify([
        false,
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
      closeWorkspace={closeWorkspace}
      trackPatientChartContext={false}
    />
  );
}
