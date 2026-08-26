import { Button, InlineLoading, InlineNotification, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getPatientName, getUserFacingErrorMessage, showSnackbar, useConfig, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import MedicationEvent from '../components/medication-event.component';
import { type PharmacyConfig } from '../config-schema';
import {
  initiateMedicationDispenseBody,
  saveMedicationDispense,
  useProviders,
} from '../medication-dispense/medication-dispense.resource';
import {
  updateMedicationRequestFulfillerStatus,
  usePrescriptionDetails,
} from '../medication-request/medication-request.resource';
import { MedicationDispenseStatus } from '../types';
import {
  computeNewFulfillerStatusAfterDispenseEvent,
  getFulfillerStatus,
  getMedicationDisplay,
  getMedicationReferenceOrCodeableConcept,
  getUuidFromReference,
  isMedicationRequestFullyDispensed,
  markEncounterAsStale,
  revalidate,
} from '../utils';
import styles from './on-prescription-filled.scss';

interface OnPrescriptionFilledModalProps {
  patient: fhir.Patient;

  /**
   * The encounter with which the user just placed the fill prescription order.
   */
  encounterUuid: string;

  /**
   * closes the modal
   */
  close(): void;
}

/**
 * This modal appears after the user submits the order basket opened via the
 * manual prescription action in the dispensing app. The orders have already
 * been persisted when this modal opens; the modal only offers immediate
 * dispensing as an optional next step.
 */
const OnPrescriptionFilledModal: React.FC<OnPrescriptionFilledModalProps> = ({ patient, encounterUuid, close }) => {
  const { dispenserProviderRoles, dispensingLocationUuid } = useConfig<PharmacyConfig>();
  const session = useSession();
  const providers = useProviders(dispenserProviderRoles);
  const {
    medicationRequestBundles,
    error: ordersError,
    isLoading: areOrdersLoading,
  } = usePrescriptionDetails(encounterUuid);
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isSubmittingRef = React.useRef(false);
  const pendingMedicationRequestBundles = React.useMemo(
    () => medicationRequestBundles.filter((bundle) => !isMedicationRequestFullyDispensed(bundle)),
    [medicationRequestBundles],
  );

  const onConfirm = async () => {
    if (isSubmittingRef.current) {
      return;
    }

    if (!dispensingLocationUuid) {
      showSnackbar({
        title: t('errorDispensingMedication', 'Error dispensing medication'),
        subtitle: t('dispensingLocationNotConfigured', 'The operational pharmacy location has not been configured.'),
        kind: 'error',
      });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    markEncounterAsStale(encounterUuid);
    let hasSavedDispense = false;
    try {
      for (const medicationRequestBundle of pendingMedicationRequestBundles) {
        const medicationDispensePayload = initiateMedicationDispenseBody(
          medicationRequestBundle.request,
          session,
          providers,
          true,
          dispensingLocationUuid,
        );
        const medicationDisplay = getMedicationDisplay(
          getMedicationReferenceOrCodeableConcept(medicationRequestBundle.request),
        );

        let dispenseSaved = false;
        try {
          const response = await saveMedicationDispense(medicationDispensePayload, MedicationDispenseStatus.completed);
          dispenseSaved = response.ok && (response.status === 200 || response.status === 201);
          if (!dispenseSaved) {
            throw new Error('Medication dispense request was not accepted');
          }
          hasSavedDispense = true;

          const newFulfillerStatus = computeNewFulfillerStatusAfterDispenseEvent(
            medicationDispensePayload,
            medicationRequestBundle,
            false,
          );
          const currentFulfillerStatus = getFulfillerStatus(medicationRequestBundle.request) ?? null;
          if (currentFulfillerStatus !== newFulfillerStatus) {
            try {
              await updateMedicationRequestFulfillerStatus(
                getUuidFromReference(
                  medicationDispensePayload.authorizingPrescription[0].reference, // assumes authorizing prescription exists
                ),
                newFulfillerStatus,
              );
            } catch (error) {
              showSnackbar({
                title: t('dispenseSavedOrderStatusPending', 'Dispense saved; order status pending'),
                kind: 'warning',
                subtitle: getUserFacingErrorMessage(
                  error,
                  t(
                    'dispenseSavedOrderStatusPendingForMedication',
                    '{{medication}} was dispensed, but the order status could not be updated. Do not dispense it again; refresh the list and contact support if it remains active.',
                    { medication: medicationDisplay },
                  ),
                  {
                    logContext: 'Update registered medication request after saved dispense',
                  },
                ),
              });
              continue;
            }
          }

          showSnackbar({
            title: t('stockDispensed', 'Stock dispensed'),
            subtitle: medicationDisplay,
            isLowContrast: false,
          });
        } catch (error) {
          if (!dispenseSaved) {
            showSnackbar({
              title: t('errorDispensingMedication', 'Error dispensing medication'),
              kind: 'error',
              subtitle: getUserFacingErrorMessage(
                error,
                t(
                  'errorDispensingMedicationMessage',
                  '{{medication}}: no se pudo completar la dispensación. Intente nuevamente.',
                  { medication: medicationDisplay },
                ),
                { logContext: 'Dispense registered medication request' },
              ),
            });
          }
        }
      }
    } finally {
      try {
        await revalidate(mutate, encounterUuid);
      } catch (error) {
        if (hasSavedDispense) {
          showSnackbar({
            kind: 'warning',
            title: t('dispenseSavedRefreshPending', 'Dispense saved; refresh pending'),
            subtitle: getUserFacingErrorMessage(
              error,
              t(
                'dispenseSavedRefreshPendingMessage',
                'The dispense was saved, but the list could not be refreshed. Reload it before continuing.',
              ),
              { logContext: 'Refresh prescriptions after dispensing registered orders' },
            ),
          });
        }
      }
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
    close();
  };

  const patientName = getPatientName(patient);

  return (
    <>
      <ModalHeader>{t('manualPrescriptionRegistered', 'Prescription registered')}</ModalHeader>
      <ModalBody>
        <p className={styles.modalDescription}>
          <Trans
            components={{ patientName: <strong /> }}
            defaults="The following medication orders have already been registered for <patientName>{{patientName}}</patientName>. Review them before choosing whether to dispense them now."
            i18nKey="manualPrescriptionRegisteredDescription"
            values={{ patientName }}
          />
        </p>
        {!areOrdersLoading && !ordersError && medicationRequestBundles.length > 0 && (
          <h3 className={styles.registeredOrdersHeading}>
            {t('registeredMedicationOrders', 'Registered medication orders ({{count}})', {
              count: medicationRequestBundles.length,
            })}
          </h3>
        )}
        {areOrdersLoading && (
          <InlineLoading description={t('loadingRegisteredOrders', 'Loading registered medication orders...')} />
        )}
        {ordersError && (
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            title={t('errorLoadingRegisteredOrders', 'Could not load the registered orders')}
            subtitle={getUserFacingErrorMessage(
              ordersError,
              t(
                'errorLoadingRegisteredOrdersMessage',
                'The prescription was registered, but its medication orders could not be displayed. Leave it pending and reload the pharmacy list.',
              ),
              { logContext: `Load newly registered prescription ${encounterUuid}` },
            )}
          />
        )}
        {!areOrdersLoading && !ordersError && medicationRequestBundles.length === 0 && (
          <InlineNotification
            hideCloseButton
            kind="warning"
            lowContrast
            title={t('noRegisteredOrdersFound', 'No registered medication orders were found')}
            subtitle={t(
              'noRegisteredOrdersFoundMessage',
              'Leave this prescription pending and reload the pharmacy list before dispensing.',
            )}
          />
        )}
        {!areOrdersLoading &&
          !ordersError &&
          medicationRequestBundles.map((bundle) => (
            <MedicationEvent key={bundle.request.id} medicationEvent={bundle.request} />
          ))}
      </ModalBody>
      <ModalFooter>
        <Button disabled={isSubmitting} kind="secondary" onClick={close}>
          {t('leavePendingDispensing', 'Leave pending for dispensing')}
        </Button>
        <Button
          disabled={
            isSubmitting ||
            !dispensingLocationUuid ||
            areOrdersLoading ||
            Boolean(ordersError) ||
            pendingMedicationRequestBundles.length === 0
          }
          onClick={() => {
            onConfirm();
          }}
        >
          {t('dispenseRegisteredOrdersNow', 'Dispense now')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default OnPrescriptionFilledModal;
