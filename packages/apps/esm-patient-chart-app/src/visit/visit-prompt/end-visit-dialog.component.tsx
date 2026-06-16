import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { openmrsFetch, showSnackbar, updateVisit, useVisit } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteVisits2 } from '../visits-widget/visit.resource';

import styles from './end-visit-dialog.scss';

const ModuleFuaRestURL = '/ws/module/fua';

interface EndVisitDialogProps {
  patientUuid: string;
  closeModal: () => void;
}

/**
 * This modal shows up when user clicks on the "End visit" button in the action menu within the
 * patient banner. It should only show when the patient has an active visit. See stop-visit.component.tsx
 * for the button.
 */

/**
 * Se esta modificando esta funcion para darle soporte a la funcionalidad de generar FUA (formato unico de atención).
 */
const EndVisitDialog: React.FC<EndVisitDialogProps> = ({ patientUuid, closeModal }) => {
  const { t } = useTranslation();
  const { activeVisit, mutate } = useVisit(patientUuid);
  const { mutate: mutateInfiniteVisits } = useInfiniteVisits2(patientUuid);

  const handleEndVisit = () => {
    if (activeVisit) {
      const endVisitPayload = {
        stopDatetime: new Date(),
      };

      const abortController = new AbortController();

      void updateVisit(activeVisit.uuid, endVisitPayload, abortController)
        .then((response) => {
          void mutate();
          void mutateInfiniteVisits();
          closeModal();

          showSnackbar({
            isLowContrast: true,
            kind: 'success',
            subtitle: t('visitEndSuccessfully', `${response?.data?.visitType?.display} ended successfully`),
            title: t('visitEnded', 'Visit ended'),
          });
        })
        .catch((error: { message?: string }) => {
          showSnackbar({
            title: t('errorEndingVisit', 'Error ending visit'),
            kind: 'error',
            isLowContrast: false,
            subtitle: error?.message,
          });
        });
    }
  };

  const handleEndVisitAndGenerateFUA = async () => {
    if (!activeVisit) {
      showSnackbar({
        title: t('errorGeneratingFUA', 'Error generating FUA'),
        kind: 'error',
        isLowContrast: false,
        subtitle: t('noActiveVisitForFua', 'There is no active visit to create a FUA'),
      });
      return;
    }

    const abortController = new AbortController();
    try {
      await updateVisit(activeVisit.uuid, { stopDatetime: new Date() }, abortController);
      void mutate();
      void mutateInfiniteVisits();
      closeModal();

      await openmrsFetch(`${ModuleFuaRestURL}/generateFromVisit/${encodeURIComponent(activeVisit.uuid)}`, {
        method: 'POST',
      });

      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        subtitle: t('visitEndedAndFUAGenerated', 'Visit ended and FUA Generated'),
        title: t('visitEndedAndFUAGenerated', 'Visit ended and FUA Generated'),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('unknownError', 'Unknown error');
      showSnackbar({
        title: t('errorEndingVisitOrGeneratingFUA', 'Error ending visit or generating FUA'),
        kind: 'error',
        isLowContrast: false,
        subtitle: message,
      });
    }
  };

  return (
    <div>
      <ModalHeader
        closeModal={closeModal}
        title={t('endActiveVisitConfirmation', 'Are you sure you want to end this active visit?')}
      />
      <ModalBody>
        <p className={styles.bodyShort02}>
          {t('youCanAddAdditionalEncounters', 'You can add additional encounters to this visit in the visit summary.')}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          kind="danger"
          onClick={() => void handleEndVisitAndGenerateFUA()}
        >
          {t('endVisitAndGenerateFua_title', 'End Visit and Generate FUA')}
        </Button>
        <Button kind="danger--tertiary" onClick={handleEndVisit}>
          {t('closeVisit_title', 'Close Visit')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default EndVisitDialog;
