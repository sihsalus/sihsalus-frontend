import { Button, InlineNotification, ModalBody, ModalFooter, ModalHeader, Select, SelectItem } from '@carbon/react';
import { launchWorkspace2, useSession, userHasAccess } from '@openmrs/esm-framework';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { laboratoryEditPrivilege, labResultsAddOrderWorkspaceName, labResultsWorkspaceName } from '../../constants';
import { fetchLabOrderResult, getResultPatientUuid } from '../../laboratory-results.resource';
import { useInvalidateLabOrders } from '../../laboratory.resource';
import type { Order } from '../../types';
import styles from './lab-result-actions.scss';

export interface LabResultModalProps {
  orders: Array<Order>;
  closeModal: () => void;
}

export default function EditLabResultsModal({ orders, closeModal }: LabResultModalProps) {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(laboratoryEditPrivilege, session?.user);
  const invalidateLabOrders = useInvalidateLabOrders();
  const eligibleOrders = orders.filter((order) => ['COMPLETED', 'ON_HOLD'].includes(order.fulfillerStatus));
  const [selectedUuid, setSelectedUuid] = useState(eligibleOrders.length === 1 ? eligibleOrders[0].uuid : '');
  const [isOpening, setIsOpening] = useState(false);
  const [hasError, setHasError] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const validSelection = Boolean(getResultPatientUuid(orders));

  const openResult = async () => {
    const selectedOrder = eligibleOrders.find((order) => order.uuid === selectedUuid);
    if (!canEdit || !validSelection || !selectedOrder || isOpening) return;
    const controller = new AbortController();
    request.current = controller;
    setIsOpening(true);
    setHasError(false);
    try {
      const { order } = await fetchLabOrderResult(selectedOrder, ['COMPLETED', 'ON_HOLD'], controller.signal);
      if (controller.signal.aborted) return;
      const opened = await launchWorkspace2(
        labResultsWorkspaceName,
        { patient: order.patient, order, invalidateLabOrders, labOrderWorkspaceName: labResultsAddOrderWorkspaceName },
        {
          patient: order.patient,
          patientUuid: order.patient.uuid,
          encounterUuid: order.encounter.uuid,
          visitContext: order.encounter.visit ?? null,
        },
      );
      if (opened) closeModal();
    } catch {
      if (!controller.signal.aborted) setHasError(true);
    } finally {
      if (!controller.signal.aborted) setIsOpening(false);
    }
  };

  return (
    <>
      <ModalHeader closeModal={closeModal} title={t('editLabResults', 'Edit lab results')} />
      <ModalBody className={styles.body}>
        {!canEdit || !validSelection || !eligibleOrders.length ? (
          <InlineNotification
            kind="error"
            hideCloseButton
            title={t(
              'labResultSelectionUnavailable',
              'These results cannot be opened. Refresh the list and check your access.',
            )}
          />
        ) : (
          <>
            <p>{orders[0].patient.display}</p>
            <p>
              {t(
                'chooseResultToEdit',
                'Select the order whose saved result you want to correct. For panels, correct one result at a time.',
              )}
            </p>
            <Select
              id="lab-result-order"
              labelText={t('labResultOrder', 'Laboratory order')}
              value={selectedUuid}
              disabled={isOpening}
              onChange={(event) => {
                setSelectedUuid(event.target.value);
                setHasError(false);
              }}
            >
              <SelectItem value="" text={t('selectLabResultOrder', 'Select an order')} />
              {eligibleOrders.map((order) => (
                <SelectItem
                  key={order.uuid}
                  value={order.uuid}
                  text={`${order.orderNumber} — ${order.concept.display}`}
                />
              ))}
            </Select>
          </>
        )}
        {hasError && (
          <InlineNotification
            kind="error"
            hideCloseButton
            title={t('labResultOpenFailed', 'Could not open the saved result. Refresh the list or try again.')}
          />
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          onClick={openResult}
          disabled={
            !canEdit ||
            !validSelection ||
            !selectedUuid ||
            isOpening ||
            !eligibleOrders.some((order) => order.uuid === selectedUuid)
          }
        >
          {isOpening ? t('loading', 'Loading') : t('openLabResult', 'Open result')}
        </Button>
      </ModalFooter>
    </>
  );
}
