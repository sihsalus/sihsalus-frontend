import { DataTableSkeleton } from '@carbon/react';
import { EmptyState, ErrorState, useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { useTranslation } from 'react-i18next';
import { usePastPatientOrders } from '../api/api';
import MedicationsDetailsTable from '../components/medications-details-table.component';

interface PastMedicationsProps {
  patient: fhir.Patient;
}

const PastMedications: React.FC<PastMedicationsProps> = ({ patient }) => {
  const { t } = useTranslation();
  const headerTitle = t('pastMedicationsHeaderTitle', 'Past medications');
  const displayText = t('pastMedicationsDisplayText', 'past medications');

  const { data: pastPatientOrders, error, isLoading, isValidating } = usePastPatientOrders(patient?.id);
  const launchOrderBasket = useLaunchWorkspaceRequiringVisit(patient.id, 'order-basket');

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (pastPatientOrders?.length) {
    return (
      <MedicationsDetailsTable
        isValidating={isValidating}
        title={t('pastMedicationsTableTitle', 'Past Medications')}
        medications={pastPatientOrders}
        showDiscontinueButton={false}
        showModifyButton={false}
        showRenewButton={true}
        patient={patient}
      />
    );
  }

  return (
    <EmptyState
      displayText={displayText}
      headerTitle={headerTitle}
      launchForm={() => launchOrderBasket({}, { encounterUuid: '' })}
    />
  );
};

export default PastMedications;
