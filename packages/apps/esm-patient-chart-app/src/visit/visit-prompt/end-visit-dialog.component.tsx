import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import {
  getUserFacingErrorMessage,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  toOmrsIsoString,
  useVisit,
} from '@openmrs/esm-framework';
import { fetchVisitInsurance, getSisFinancingState, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
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
  uuid?: string;
  diagnoses?: Array<{
    rank?: number;
    voided?: boolean;
    diagnosis?: {
      coded?: {
        mappings?: Array<{
          display?: string;
          conceptReferenceTerm?: {
            code?: string;
            conceptSource?: { name?: string; display?: string };
          };
        }>;
        names?: Array<{
          display?: string;
          name?: string;
          conceptNameType?: string;
        }>;
      };
    };
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

const cie10CodePattern = /^[A-Z][0-9][A-Z0-9.]{1,5}$/i;
const cie10SourcePattern = /icd[-\s]?10|cie[-\s]?10/i;
const encounterPageSize = 100;

function diagnosisHasCataloguedCie10Code(diagnosis: NonNullable<VisitEncounterSummary['diagnoses']>[number]): boolean {
  const coded = diagnosis.diagnosis?.coded;
  const hasMappedCode = coded?.mappings?.some((mapping) => {
    const source =
      mapping.conceptReferenceTerm?.conceptSource?.name?.trim() ||
      mapping.conceptReferenceTerm?.conceptSource?.display?.trim() ||
      mapping.display?.split(':', 1)[0]?.trim() ||
      '';
    const display = mapping.display?.trim() ?? '';
    const separatorIndex = display.lastIndexOf(':');
    const code =
      mapping.conceptReferenceTerm?.code?.trim() ||
      (separatorIndex >= 0 ? display.slice(separatorIndex + 1).trim() : '');

    return cie10SourcePattern.test(source) && cie10CodePattern.test(code);
  });
  if (hasMappedCode) {
    return true;
  }

  return Boolean(
    coded?.names?.some((name) => {
      const value = (name.display ?? name.name)?.trim() ?? '';
      return name.conceptNameType === 'SHORT' && cie10CodePattern.test(value);
    }),
  );
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
  const customRepresentation =
    'custom:(uuid,diagnoses:(rank,voided,diagnosis:(coded:(mappings:(display,conceptReferenceTerm:(code,conceptSource:(name,display))),names:(display,name,conceptNameType)))),obs:(formFieldPath,value,display))';
  const baseUrl = `${restBaseUrl}/encounter?patient=${patientUuid}&visit=${visitUuid}&v=${customRepresentation}`;
  const encounters: Array<VisitEncounterSummary> = [];
  const seenEncounterUuids = new Set<string>();
  let startIndex = 0;

  while (true) {
    const { data } = await openmrsFetch<{
      results?: Array<VisitEncounterSummary>;
      totalCount?: number;
    }>(`${baseUrl}&limit=${encounterPageSize}&startIndex=${startIndex}&totalCount=true`);
    const page = data?.results ?? [];
    let newEncounterCount = 0;
    page.forEach((encounter) => {
      if (!encounter.uuid || !seenEncounterUuids.has(encounter.uuid)) {
        encounters.push(encounter);
        newEncounterCount += 1;
        if (encounter.uuid) {
          seenEncounterUuids.add(encounter.uuid);
        }
      }
    });

    const totalCount = data?.totalCount;
    const hasMoreByTotal = typeof totalCount === 'number' && encounters.length < totalCount;
    if (!page.length || (!hasMoreByTotal && page.length < encounterPageSize)) {
      break;
    }
    if (!newEncounterCount) {
      throw new Error('Encounter pagination did not advance while validating the visit summary.');
    }
    startIndex += page.length;
  }

  return {
    hasPrimaryDiagnosis: encounters.some((encounter) =>
      encounter.diagnoses?.some(
        (diagnosis) => diagnosis.rank === 1 && !diagnosis.voided && diagnosisHasCataloguedCie10Code(diagnosis),
      ),
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
        try {
          await openmrsFetch(`${ModuleFuaRestURL}/generateFromVisit/${encodeURIComponent(activeVisit.uuid)}`, {
            method: 'POST',
          });
        } catch (error: unknown) {
          getUserFacingErrorMessage(
            error,
            t(
              'visitEndedFuaPendingDescription',
              'The visit was closed, but FUA generation could not be confirmed. Check FUA Management before retrying.',
            ),
            { logContext: 'Generate FUA after visit closure' },
          );
          closeModal();
          showSnackbar({
            isLowContrast: true,
            kind: 'warning',
            subtitle: t(
              'visitEndedFuaPendingDescription',
              'The visit was closed, but FUA generation could not be confirmed. Check FUA Management before retrying.',
            ),
            title: t('visitEndedFuaPending', 'Visit ended; verify FUA'),
          });
          return;
        }
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
        title: t('errorEndingVisit', 'Error ending visit'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t('errorEndingVisitMessage', 'The visit could not be confirmed as ended. Verify its status before retrying.'),
          { logContext: 'End visit' },
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
