import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { openmrsFetch, restBaseUrl, showSnackbar, updateVisit, useVisit } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteVisits2 } from '../visits-widget/visit.resource';

import styles from './end-visit-dialog.scss';

const ModuleFuaRestURL = '/ws/module/fua';
const codigoPrestacionalFormFieldPath = 'codigo-prestacional';

interface EndVisitDialogProps {
  patientUuid: string;
  closeModal: () => void;
}

interface VisitEncounterSummary {
  diagnoses?: Array<{
    rank?: number;
    voided?: boolean;
  }>;
  obs?: Array<{
    formFieldPath?: string;
    value?: unknown;
    display?: string;
  }>;
}

interface RequiredVisitSummaryValidation {
  hasCodigoPrestacional: boolean;
  hasPrimaryDiagnosis: boolean;
}

function getObsTextValue(obs: NonNullable<VisitEncounterSummary['obs']>[number]) {
  if (obs.value == null) {
    return obs.display ?? '';
  }

  if (typeof obs.value === 'object') {
    const value = obs.value as { display?: unknown; uuid?: unknown };
    return String(value.display ?? value.uuid ?? obs.display ?? '');
  }

  return String(obs.value);
}

async function validateRequiredVisitSummaryFields(
  patientUuid: string,
  visitUuid: string,
): Promise<RequiredVisitSummaryValidation> {
  const customRepresentation = 'custom:(uuid,diagnoses:(rank,voided),obs:(formFieldPath,value,display))';
  const { data } = await openmrsFetch<{ results: Array<VisitEncounterSummary> }>(
    `${restBaseUrl}/encounter?patient=${patientUuid}&visit=${visitUuid}&v=${customRepresentation}&limit=50`,
  );
  const encounters = data?.results ?? [];

  return {
    hasPrimaryDiagnosis: encounters.some((encounter) =>
      encounter.diagnoses?.some((diagnosis) => diagnosis.rank === 1 && !diagnosis.voided),
    ),
    hasCodigoPrestacional: encounters.some((encounter) =>
      encounter.obs?.some(
        (obs) => obs.formFieldPath === codigoPrestacionalFormFieldPath && Boolean(getObsTextValue(obs).trim()),
      ),
    ),
  };
}

/**
 * This modal shows up when user clicks on the "End visit" button in the action menu within the
 * patient banner. It should only show when the patient has an active visit. See stop-visit.component.tsx
 * for the button.
 */
const EndVisitDialog: React.FC<EndVisitDialogProps> = ({ patientUuid, closeModal }) => {
  const { t } = useTranslation();
  const { activeVisit, mutate } = useVisit(patientUuid);
  const { mutate: mutateInfiniteVisits } = useInfiniteVisits2(patientUuid);

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
      const validation = await validateRequiredVisitSummaryFields(patientUuid, activeVisit.uuid);
      const missingFields = [
        !validation.hasPrimaryDiagnosis ? t('primaryDiagnosis', 'Primary diagnosis') : null,
        !validation.hasCodigoPrestacional ? t('codigoPrestacional', 'Codigo Prestacional') : null,
      ].filter(Boolean);

      if (missingFields.length) {
        closeModal();
        launchPatientWorkspace('visit-notes-form-workspace', {
          formContext: 'creating',
          openedFrom: 'end-visit-dialog',
        });
        showSnackbar({
          title: t('missingRequiredVisitSummaryFields', 'Missing required visit summary data'),
          kind: 'warning',
          isLowContrast: true,
          subtitle: t(
            'completeRequiredVisitSummaryFields',
            'Complete {{fields}} in Resumen de consulta before finalizing the visit.',
            { fields: missingFields.join(', ') },
          ),
        });
        return;
      }

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
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error && 'message' in error
            ? String(error.message)
            : t('unknownError', 'Unknown error');
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
        <Button kind="danger" onClick={() => void handleEndVisitAndGenerateFUA()}>
          {t('endVisitAndGenerateFua_title', 'Finalizar Consulta y Generar FUA')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default EndVisitDialog;
