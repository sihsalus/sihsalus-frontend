import { InlineNotification } from '@carbon/react';
import { fhirBaseUrl, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { type PharmacyConfig } from '../config-schema';
import { PRESCRIPTIONS_TABLE_ENDPOINT } from '../constants';
import FillPrescriptionButton from '../fill-prescription/fill-prescription-button.component';
import { useMedicationOrderNotifications } from '../pharmacy-notifications.resource';
import { PharmacyHeader } from '../pharmacy-header/pharmacy-header.component';
import PrescriptionTabLists from '../prescriptions/prescription-tab-lists.component';

export default function DispensingDashboard() {
  const config = useConfig<PharmacyConfig>();
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const handleMedicationOrderCreated = useCallback(() => {
    void mutate(
      (key) =>
        typeof key === 'string' && key.startsWith(`${fhirBaseUrl}/${PRESCRIPTIONS_TABLE_ENDPOINT}`),
    );
    showSnackbar({
      isLowContrast: true,
      kind: 'info',
      title: t('medicationOrderCreated', 'New medication order'),
      subtitle: t('medicationOrderCreatedMessage', 'A new medication order was added to the pharmacy worklist.'),
    });
  }, [mutate, t]);
  useMedicationOrderNotifications(config.enableRealtimeMedicationOrderNotifications, handleMedicationOrderCreated);

  if (config.dispenseBehavior.restrictTotalQuantityDispensed && config.dispenseBehavior.allowModifyingPrescription) {
    return (
      <div className={`omrs-main-content`}>
        <InlineNotification
          title={t('dispensingAppError', 'Dispensing App Error')}
          subtitle={t(
            'dispensingAppMisconfigurationMessage',
            "Please contact your system administration: Misconfiguration - 'restrictTotalQuantityDispensed' cannot be enabled if 'allowModifyingPrescription' is enabled.",
          )}
        />
      </div>
    );
  } else {
    return (
      <div className={`omrs-main-content`}>
        <PharmacyHeader />
        {/* <DispensingTiles /> */}
        <FillPrescriptionButton />
        <PrescriptionTabLists />
      </div>
    );
  }
}
