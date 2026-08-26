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
import { MedicationDispenseStatus, MedicationRequestFulfillerStatus } from '../types';
import {
  getMedicationDisplay,
  getMedicationReferenceOrCodeableConcept,
  getUuidFromReference,
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

  const onConfirm = async () => {
    if (!dispensingLocationUuid) {
      showSnackbar({
        title: t('errorDispensingMedication', 'Error dispensing medication'),
        subtitle: t('dispensingLocationNotConfigured', 'The operational pharmacy location has not been configured.'),
        kind: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    markEncounterAsStale(encounterUuid);
    try {
      for (const medicationRequestBundle of medicationRequestBundles) {
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

        await saveMedicationDispense(medicationDispensePayload, MedicationDispenseStatus.completed)
          .then((response) => {
            const hasNoRefills = medicationRequestBundle.request.dispenseRequest.numberOfRepeatsAllowed === 0;
            if (response.ok && hasNoRefills) {
              return updateMedicationRequestFulfillerStatus(
                getUuidFromReference(
                  medicationDispensePayload.authorizingPrescription[0].reference, // assumes authorizing prescription exist
                ),
                MedicationRequestFulfillerStatus.completed,
              ).then(() => response);
            } else {
              return response;
            }
          })
          .then(() => {
            showSnackbar({
              title: t('stockDispensed', 'Stock dispensed'),
              subtitle: medicationDisplay,
              isLowContrast: false,
            });
          })
          .catch((error) => {
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
                { logContext: `Fill prescription ${medicationRequestBundle.request.id}` },
              ),
            });
          });
      }

      close();
    } finally {
      revalidate(mutate, encounterUuid);
      setIsSubmitting(false);
    }
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
            medicationRequestBundles.length === 0
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
