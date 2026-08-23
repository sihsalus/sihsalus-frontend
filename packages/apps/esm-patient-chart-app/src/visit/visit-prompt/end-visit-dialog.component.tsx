import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import {
  getUserFacingErrorMessage,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  toOmrsIsoString,
  useVisit,
} from '@openmrs/esm-framework';
import {
  fetchVisitInsurance,
  getSisFinancingState,
  launchPatientWorkspace,
} from '@openmrs/esm-patient-common-lib';
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
  const [isFinalizing, setIsFinalizing] = React.useState(false);

  const handleEndVisitAndGenerateFUA = async () => {
    if (isFinalizing) {
      return;
    }

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
      setIsFinalizing(true);
      const shouldGenerateFua = getSisFinancingState(await fetchVisitInsurance(activeVisit.uuid)) === 'active';

      if (shouldGenerateFua) {
        const validation = await validateRequiredVisitSummaryFields(patientUuid, activeVisit.uuid);
        const missingFields = [
          !validation.hasPrimaryDiagnosis ? t('primaryDiagnosis', 'Primary diagnosis') : null,
          !validation.hasCodigoPrestacional ? t('codigoPrestacional', 'Codigo Prestacional') : null,
        ].filter(Boolean);

        if (missingFields.length) {
          setIsFinalizing(false);
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
      }

      await openmrsFetch(`${restBaseUrl}/clinicalvisitclosure`, {
        signal: abortController.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          visitUuid: activeVisit.uuid,
          stopDatetime: toOmrsIsoString(new Date()),
        },
      });
      void mutate();
      void mutateInfiniteVisits();

      if (shouldGenerateFua) {
        await openmrsFetch(`${ModuleFuaRestURL}/generateFromVisit/${encodeURIComponent(activeVisit.uuid)}`, {
          method: 'POST',
        });
      }

      closeModal();

      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        subtitle: shouldGenerateFua
          ? t('visitEndedAndFUAGenerated', 'Visit ended and FUA Generated')
          : t('visitEnded', 'Visit ended'),
        title: shouldGenerateFua
          ? t('visitEndedAndFUAGenerated', 'Visit ended and FUA Generated')
          : t('visitEnded', 'Visit ended'),
      });
    } catch (error: unknown) {
      showSnackbar({
        title: t('errorEndingVisitOrGeneratingFUA', 'Error ending visit or generating FUA'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'errorEndingVisitOrGeneratingFUAMessage',
            'No se pudo finalizar la consulta o generar el FUA. Intente nuevamente.',
          ),
          { logContext: 'End visit and generate FUA' },
        ),
      });
    } finally {
      setIsFinalizing(false);
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
        {isFinalizing ? (
          <InlineLoading description={t('finalizingVisit', 'Finalizando consulta...')} status="active" />
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal} disabled={isFinalizing}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={() => void handleEndVisitAndGenerateFUA()} disabled={isFinalizing}>
          {isFinalizing ? t('finalizingVisit', 'Finalizando consulta...') : t('endVisit_title', 'Finalizar consulta')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default EndVisitDialog;
