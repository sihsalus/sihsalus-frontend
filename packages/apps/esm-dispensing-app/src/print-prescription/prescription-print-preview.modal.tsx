import {
  Button,
  ButtonSet,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@carbon/react';
import { ErrorState, getCoreTranslation } from '@openmrs/esm-framework';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';
import { usePrescriptionDetails } from '../medication-request/medication-request.resource';
import PrescriptionsPrintout from './prescription-printout.component';
import styles from './print-prescription.scss';
import PrintablePrescriptionsSelector from './printable-prescriptions.component';

type PrescriptionPrintPreviewModalProps = {
  onClose: () => void;
  encounterUuid: string;
  patientUuid: string;
  status: string;
};

const PrescriptionPrintPreviewModal: React.FC<PrescriptionPrintPreviewModalProps> = ({
  onClose,
  encounterUuid,
  patientUuid,
}) => {
  const { t } = useTranslation();
  const { medicationRequestBundles, error, isLoading } = usePrescriptionDetails(encounterUuid);

  const [excludedPrescriptions, setExcludedPrescriptions] = useState<string[]>([]);
  const [printError, setPrintError] = useState<string | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    onBeforePrint: () => {
      setPrintError(null);
      return Promise.resolve();
    },
    onPrintError: (_errorLocation, _error) => {
      setPrintError(t('printError', 'An error occurred while printing. Please try again.'));
    },
  });

  return (
    <>
      <ModalHeader closeModal={onClose} className={styles.title}>
        {t('printPrescriptions', 'Print prescriptions')}
      </ModalHeader>
      <ModalBody>
        {isLoading && (
          <InlineLoading
            status="active"
            iconDescription="Loading"
            description={t('loading', 'Loading prescriptions') + '....'}
          />
        )}
        {error && <ErrorState error={error} headerTitle={t('error', 'Error')} />}
        {!isLoading && medicationRequestBundles?.length > 0 && (
          <div className={styles.printoutSelectorRow}>
            <PrintablePrescriptionsSelector
              medicationRequests={medicationRequestBundles}
              excludedPrescription={excludedPrescriptions}
              onExcludedPrescriptionChange={setExcludedPrescriptions}
            />
            <div ref={componentRef}>
              <PrescriptionsPrintout
                excludedPrescription={excludedPrescriptions}
                medicationRequests={medicationRequestBundles}
                patientUuid={patientUuid}
              />
            </div>
          </div>
        )}
        {printError && (
          <InlineNotification kind="error" title={t('printErrorTitle', 'Print Error')} subtitle={printError} />
        )}
      </ModalBody>
      <ModalFooter>
        <ButtonSet className={styles.btnSet}>
          <Button kind="secondary" onClick={onClose} type="button">
            {getCoreTranslation('cancel', 'Cancel')}
          </Button>
          <Button kind="primary" onClick={handlePrint} type="button" disabled={isLoading}>
            {t('print', 'Print')}
          </Button>
        </ButtonSet>
      </ModalFooter>
    </>
  );
};

export default PrescriptionPrintPreviewModal;
