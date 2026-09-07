import { Button, Checkbox, Form, FormLabel, InlineLoading } from '@carbon/react';
import {
  ExtensionSlot,
  getCoreTranslation,
  getUserFacingErrorMessage,
  showModal,
  showSnackbar,
  useConfig,
  usePatient,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { type PharmacyConfig } from '../config-schema';
import { saveMedicationDispense } from '../medication-dispense/medication-dispense.resource';
import { updateMedicationRequestFulfillerStatus } from '../medication-request/medication-request.resource';
import {
  type InventoryItem,
  type MedicationDispense,
  MedicationDispenseStatus,
  type MedicationRequestBundle,
  MedicationRequestFulfillerStatus,
} from '../types';
import {
  calculateIsFreeTextDosage,
  computeNewFulfillerStatusAfterDispenseEvent,
  getDosageInstruction,
  getFulfillerStatus,
  getUuidFromReference,
  markEncounterAsStale,
  revalidate,
} from '../utils';
import styles from './forms.scss';
import MedicationDispenseReview from './medication-dispense-review.component';
import { createStockDispenseRequestPayload, sendStockDispenseRequest } from './stock-dispense/stock.resource';
import StockDispense from './stock-dispense/stock-dispense.component';

type DispenseFormProps = {
  medicationDispense: MedicationDispense;
  medicationRequestBundle: MedicationRequestBundle;
  mode: 'enter' | 'edit';
  patientUuid?: string;
  encounterUuid: string;
  quantityRemaining: number;
  quantityDispensed: number;
  customWorkspaceTitle?: string;
  onWorkspaceClosed?(): void;
};

const DispenseForm: React.FC<Workspace2DefinitionProps<DispenseFormProps, {}, {}>> = ({
  workspaceProps: {
    medicationDispense,
    medicationRequestBundle,
    mode,
    patientUuid,
    encounterUuid,
    quantityRemaining,
    quantityDispensed,
    customWorkspaceTitle,
    onWorkspaceClosed,
  },
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const { patient, isLoading } = usePatient(patientUuid);
  const config = useConfig<PharmacyConfig>();

  // Keep track of inventory item
  const [inventoryItem, setInventoryItem] = useState<InventoryItem>();

  // Keep track of medication dispense payload
  const [medicationDispensePayload, setMedicationDispensePayload] = useState<MedicationDispense>();

  // to prevent duplicate submits
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const [shouldCompleteOrder, setShouldCompleteOrder] = useState(false);
  const completionChoiceTouchedRef = useRef(false);

  const [isFreeTextDosage, setIsFreeTextDosage] = useState(() => {
    const dosageInstruction = getDosageInstruction(medicationDispense?.dosageInstruction);
    return dosageInstruction ? calculateIsFreeTextDosage(dosageInstruction) : false;
  });

  const getDuplicateDispense = (dispense: MedicationDispense): MedicationDispense => {
    const dispenses = medicationRequestBundle?.dispenses ?? [];
    const duplicateCheckWindowDays = config.duplicateCheckWindowDays;
    const getDispenseDate = (d: MedicationDispense) => d.whenHandedOver ?? d.whenPrepared;
    const getTime = (date?: string) => {
      if (!date) {
        return null;
      }

      const parsedTime = new Date(date).getTime();
      return Number.isNaN(parsedTime) ? null : parsedTime;
    };
    const windowMs = duplicateCheckWindowDays * 24 * 60 * 60 * 1000;
    const currentDispenseTime = getTime(getDispenseDate(dispense)) ?? Date.now();

    return dispenses
      .filter((d) => d.status === MedicationDispenseStatus.completed)
      .filter((d) => {
        const dispenseTime = getTime(getDispenseDate(d));
        if (dispenseTime === null) {
          return false;
        }

        // Duplicate checks are relative to the dispense date being submitted, not "now".
        return dispenseTime <= currentDispenseTime && currentDispenseTime - dispenseTime <= windowMs;
      })
      .sort((a, b) => {
        return getTime(getDispenseDate(b)) - getTime(getDispenseDate(a));
      })
      .find((existingDispense) => {
        if (mode === 'edit' && existingDispense.id && dispense.id && existingDispense.id === dispense.id) {
          return false;
        }
        const sameMedication =
          existingDispense.medicationCodeableConcept?.coding?.[0]?.code ===
          dispense.medicationCodeableConcept?.coding?.[0]?.code;
        const sameQuantity =
          existingDispense.quantity?.value === dispense.quantity?.value &&
          existingDispense.quantity?.code === dispense.quantity?.code;
        const sameDose =
          existingDispense.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.value ===
            dispense.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.value &&
          existingDispense.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.code ===
            dispense.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.code;
        return sameMedication && sameQuantity && sameDose;
      });
  };

  const handleDuplicateMedication = (previousDispense: MedicationDispense) => {
    const dispose = showModal('duplicate-dispense-modal', {
      onClose: () => dispose(),
      medicationName: medicationDispensePayload?.medicationCodeableConcept?.text || '',
      previousDispense: previousDispense,
      previousDispenseDate: previousDispense?.whenHandedOver ?? previousDispense?.whenPrepared ?? undefined,
      previousSchedule:
        previousDispense?.dosageInstruction?.[0]?.timing?.code?.text ??
        medicationDispensePayload?.dosageInstruction?.[0]?.timing?.code?.text,
      previousQuantity: previousDispense?.quantity?.value ?? medicationDispensePayload?.quantity?.value,
      previousQuantityUnit:
        previousDispense?.quantity?.unit ??
        previousDispense?.quantity?.code ??
        medicationDispensePayload?.quantity?.code,
      previousPerformer:
        previousDispense?.performer?.[0]?.actor?.display ?? medicationDispensePayload?.performer?.[0]?.actor?.display,
      onConfirm: () => handleSubmit(),
    });
  };

  // Submit medication dispense form
  const handleSubmit = async () => {
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const abortController = new AbortController();
    markEncounterAsStale(encounterUuid);
    let dispenseSaved = false;
    let orderMarkedCompleted = false;
    let statusUpdateFailed = false;
    let statusUpdateErrorMessage: string | undefined;

    try {
      const response = await saveMedicationDispense(
        medicationDispensePayload,
        MedicationDispenseStatus.completed,
        abortController,
      );
      dispenseSaved = response.ok && (response.status === 200 || response.status === 201);
      if (!dispenseSaved) {
        throw new Error('Medication dispense request was not accepted');
      }

      const usesExplicitCompletionChoice =
        config.completeOrderWithThisDispense && mode === 'enter' && !medicationDispense?.id;
      const newFulfillerStatus = usesExplicitCompletionChoice
        ? shouldCompleteOrder
          ? MedicationRequestFulfillerStatus.completed
          : MedicationRequestFulfillerStatus.in_progress
        : computeNewFulfillerStatusAfterDispenseEvent(
            medicationDispensePayload,
            medicationRequestBundle,
            config.dispenseBehavior.restrictTotalQuantityDispensed,
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
          orderMarkedCompleted = newFulfillerStatus === MedicationRequestFulfillerStatus.completed;
        } catch (error) {
          statusUpdateFailed = true;
          statusUpdateErrorMessage = getUserFacingErrorMessage(
            error,
            t(
              'dispenseSavedOrderStatusPendingMessage',
              'The dispense was saved, but the order status could not be updated. Do not dispense it again; refresh the list and contact support if it remains active.',
            ),
            { logContext: 'Update medication request after saved dispense' },
          );
        }
      }

      if (config.enableStockDispense) {
        try {
          const stockDispenseRequestPayload = createStockDispenseRequestPayload(
            inventoryItem,
            patientUuid,
            encounterUuid,
            medicationDispensePayload,
          );
          await sendStockDispenseRequest(stockDispenseRequestPayload, abortController);
          showSnackbar({
            title: t('stockDispensed', 'Stock dispensed'),
            kind: 'success',
            subtitle: t('stockDispensedSuccessfully', 'Stock dispensed successfully and batch level updated.'),
          });
        } catch (error) {
          showSnackbar({
            kind: 'error',
            title: t('stockDispenseError', 'Error updating inventory'),
            subtitle: getUserFacingErrorMessage(
              error,
              t('stockDispenseErrorMessage', 'The dispense record was saved, but inventory could not be updated.'),
              { logContext: 'Update stock after medication dispense' },
            ),
          });
        }
      }

      try {
        await revalidate(mutate, encounterUuid);
      } catch (error) {
        showSnackbar({
          kind: 'warning',
          title: t('dispenseSavedRefreshPending', 'Dispense saved; refresh pending'),
          subtitle: getUserFacingErrorMessage(
            error,
            t(
              'dispenseSavedRefreshPendingMessage',
              'The dispense was saved, but the list could not be refreshed. Reload it before continuing.',
            ),
            { logContext: 'Refresh prescriptions after medication dispense' },
          ),
        });
      }

      if (statusUpdateFailed) {
        showSnackbar({
          kind: 'warning',
          title: t('dispenseSavedOrderStatusPending', 'Dispense saved; order status pending'),
          subtitle:
            statusUpdateErrorMessage ??
            t(
              'dispenseSavedOrderStatusPendingMessage',
              'The dispense was saved, but the order status could not be updated. Do not dispense it again; refresh the list and contact support if it remains active.',
            ),
        });
      } else if (orderMarkedCompleted) {
        showSnackbar({
          title: t('prescriptionCompleted', 'Prescription completed'),
          kind: 'success',
          subtitle: t('prescriptionCompletedSuccessfully', 'Medication dispensed and prescription marked as completed'),
        });
      } else {
        showSnackbar({
          kind: 'success',
          subtitle: t('medicationListUpdated', 'Medication dispense list has been updated.'),
          title: t(
            mode === 'enter' ? 'medicationDispensed' : 'medicationDispenseUpdated',
            mode === 'enter'
              ? 'Medication successfully dispensed.'
              : 'Medication dispense record successfully updated.',
          ),
        });
      }

      closeWorkspace({ discardUnsavedChanges: true });
      onWorkspaceClosed?.();
    } catch (error) {
      if (!dispenseSaved) {
        try {
          await revalidate(mutate, encounterUuid);
        } catch {
          // Keep the encounter marked as stale so the next consumer retries the read.
        }
        showSnackbar({
          kind: 'error',
          title: t(
            mode === 'enter' ? 'medicationDispenseError' : 'medicationDispenseUpdatedError',
            mode === 'enter' ? 'Error dispensing medication.' : 'Error updating dispense record',
          ),
          subtitle: getUserFacingErrorMessage(
            error,
            t('medicationDispenseSaveErrorMessage', 'Could not save the dispense record. Please try again.'),
            { logContext: 'Save medication dispense' },
          ),
        });
      } else {
        try {
          await revalidate(mutate, encounterUuid);
        } catch {
          // Keep the encounter marked as stale so the next consumer retries the read.
        }
        showSnackbar({
          kind: 'warning',
          title: t('dispenseSavedOrderStatusPending', 'Dispense saved; order status pending'),
          subtitle: getUserFacingErrorMessage(
            error,
            t(
              'dispenseSavedOrderStatusPendingMessage',
              'The dispense was saved, but the order status could not be updated. Do not dispense it again; refresh the list and contact support if it remains active.',
            ),
            { logContext: 'Complete workflow after saved medication dispense' },
          ),
        });
        closeWorkspace({ discardUnsavedChanges: true });
        onWorkspaceClosed?.();
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const updateMedicationDispense = useCallback((medicationDispenseUpdate: Partial<MedicationDispense>) => {
    setMedicationDispensePayload((prevState) => ({
      ...prevState,
      ...medicationDispenseUpdate,
    }));
  }, []);

  // whether or not the form is valid and ready to submit
  const isValid = useMemo(() => {
    if (!medicationDispensePayload) {
      return false;
    }
    const anyCodedDosage =
      medicationDispensePayload.dosageInstruction[0]?.doseAndRate[0]?.doseQuantity?.value ||
      medicationDispensePayload.dosageInstruction[0]?.doseAndRate[0]?.doseQuantity?.code ||
      medicationDispensePayload.dosageInstruction[0]?.route?.coding[0]?.code ||
      medicationDispensePayload.dosageInstruction[0]?.timing?.code?.coding[0].code;

    const allCodedDosage =
      medicationDispensePayload.dosageInstruction[0]?.doseAndRate[0]?.doseQuantity?.value &&
      medicationDispensePayload.dosageInstruction[0]?.doseAndRate[0]?.doseQuantity?.code &&
      medicationDispensePayload.dosageInstruction[0]?.route?.coding[0]?.code &&
      medicationDispensePayload.dosageInstruction[0]?.timing?.code?.coding[0].code;

    return (
      medicationDispensePayload.performer &&
      medicationDispensePayload.performer[0]?.actor.reference &&
      medicationDispensePayload.quantity?.value &&
      (quantityRemaining == null ||
        (quantityRemaining > 0 && medicationDispensePayload?.quantity?.value <= quantityRemaining)) &&
      medicationDispensePayload.quantity?.code &&
      ((allCodedDosage && !isFreeTextDosage) ||
        (!anyCodedDosage && isFreeTextDosage && medicationDispensePayload.dosageInstruction[0]?.text)) &&
      (!medicationDispensePayload.substitution.wasSubstituted ||
        (medicationDispensePayload.substitution.reason[0]?.coding[0].code &&
          medicationDispensePayload.substitution.type?.coding[0].code))
    );
  }, [isFreeTextDosage, medicationDispensePayload, quantityRemaining]);

  // initialize the internal dispense payload with the dispenses passed in as props
  useEffect(() => setMedicationDispensePayload(medicationDispense), [medicationDispense]);

  // Auto-default completion only when the entered dispense safely covers the full remaining order.
  useEffect(() => {
    if (
      mode === 'enter' &&
      !medicationDispense?.id &&
      medicationDispensePayload &&
      medicationRequestBundle &&
      !completionChoiceTouchedRef.current
    ) {
      setShouldCompleteOrder(
        computeNewFulfillerStatusAfterDispenseEvent(medicationDispensePayload, medicationRequestBundle, false) ===
          MedicationRequestFulfillerStatus.completed,
      );
    }
  }, [medicationDispense?.id, medicationDispensePayload, medicationRequestBundle, mode]);

  const isButtonDisabled = (config.enableStockDispense ? !inventoryItem : false) || !isValid || isSubmitting;

  const handleSubmitOrDuplicateCheck = () => {
    const duplicateDispense = medicationDispensePayload ? getDuplicateDispense(medicationDispensePayload) : null;
    if (config.enableDuplicateDispenseCheck && duplicateDispense) {
      handleDuplicateMedication(duplicateDispense);
    } else {
      handleSubmit();
    }
  };

  const bannerState = useMemo(() => {
    if (patient) {
      return {
        patient,
        patientUuid,
        hideActionsOverflow: true,
      };
    }
  }, [patient, patientUuid]);

  return (
    <Workspace2 title={customWorkspaceTitle ?? t('dispensePrescription', 'Dispense prescription')}>
      <Form className={styles.formWrapper}>
        <div>
          {isLoading && (
            <InlineLoading
              className={styles.bannerLoading}
              iconDescription="Loading"
              description="Loading banner"
              status="active"
            />
          )}
          {patient && <ExtensionSlot name="patient-header-slot" state={bannerState} />}
          <section className={styles.formGroup}>
            <FormLabel>
              {config.dispenseBehavior.allowModifyingPrescription
                ? t('drugHelpText', 'You may edit the formulation and quantity dispensed here')
                : t('drugHelpTextNoEdit', 'You may edit quantity dispensed here')}
            </FormLabel>
            {medicationDispensePayload ? (
              <div>
                <MedicationDispenseReview
                  medicationDispense={medicationDispensePayload}
                  updateMedicationDispense={updateMedicationDispense}
                  isFreeTextDosage={isFreeTextDosage}
                  setIsFreeTextDosage={setIsFreeTextDosage}
                  quantityRemaining={quantityRemaining}
                  quantityDispensed={quantityDispensed}
                />
                {config.completeOrderWithThisDispense && mode === 'enter' && !medicationDispense?.id && (
                  <Checkbox
                    id="complete-order-with-this-dispense"
                    labelText={t('completeOrderWithThisDispense', 'Complete order with this dispense')}
                    checked={shouldCompleteOrder}
                    onChange={(_, { checked }) => {
                      completionChoiceTouchedRef.current = true;
                      setShouldCompleteOrder(checked);
                    }}
                  />
                )}
                {config.enableStockDispense && (
                  <StockDispense
                    inventoryItem={inventoryItem}
                    medicationDispense={medicationDispense}
                    updateInventoryItem={setInventoryItem}
                  />
                )}
              </div>
            ) : null}
          </section>
        </div>
        <section className={styles.buttonGroup}>
          <Button
            disabled={isSubmitting}
            onClick={() => {
              closeWorkspace();
              onWorkspaceClosed?.();
            }}
            kind="secondary"
          >
            {getCoreTranslation('cancel', 'Cancel')}
          </Button>
          <Button disabled={isButtonDisabled} onClick={handleSubmitOrDuplicateCheck}>
            {t(
              mode === 'enter' ? 'dispensePrescription' : 'saveChanges',
              mode === 'enter' ? 'Dispense prescription' : 'Save changes',
            )}
          </Button>
        </section>
      </Form>
    </Workspace2>
  );
};

export default DispenseForm;
