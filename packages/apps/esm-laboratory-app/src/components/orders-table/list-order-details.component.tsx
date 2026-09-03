import {
  Accordion,
  AccordionItem,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
} from '@carbon/react';
import { openmrsFetch, restBaseUrl, ExtensionSlot, formatDate, parseDate } from '@openmrs/esm-framework';
import useSWR from 'swr';
import type { ReactNode } from 'react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type GroupedOrders } from '../../types';
import { getFulfillerStatusDisplay, getOrderUrgencyDisplay } from '../../utils/order-display';
import { extractPriorityFromInstructions } from '../../utils/priority-parser';
import styles from './list-order-details.scss';

const labEncounterRepresentation =
  'custom:(uuid,obs:(uuid,obsDatetime,voided,comment,groupMembers:(uuid,obsDatetime,voided,comment,value,concept:(uuid)),order:(uuid),concept:(uuid),value))';

// biome-ignore lint/suspicious/noExplicitAny: order object representation
function useOrderObservationComment(order: any) {
  // biome-ignore lint/suspicious/noExplicitAny: encounter data payload representation
  const { data: encounterData } = useSWR<any>(
    order?.encounter?.uuid ? `${restBaseUrl}/encounter/${order.encounter.uuid}?v=${labEncounterRepresentation}` : null,
    openmrsFetch,
  );

  return useMemo(() => {
    const obsList = encounterData?.obs ?? encounterData?.data?.obs ?? [];
    if (!Array.isArray(obsList)) return undefined;

    const isPanel = order.concept?.setMembers && order.concept.setMembers.length > 0;
    if (isPanel) return undefined;

    // biome-ignore lint/suspicious/noExplicitAny: observation representation
    let targetObs = obsList.find((o: any) => o?.order?.uuid === order.uuid);
    if (!targetObs) {
      // biome-ignore lint/suspicious/noExplicitAny: group member observation representation
      targetObs = obsList.find((o: any) => o?.groupMembers?.some((m: any) => m?.order?.uuid === order.uuid));
    }
    if (!targetObs && order.fulfillerStatus === 'COMPLETED' && order.concept?.uuid) {
      const byConcept = obsList.filter(
        // biome-ignore lint/suspicious/noExplicitAny: observation representation
        (o: any) => o?.concept?.uuid === order.concept.uuid || o?.groupMembers?.some((m: any) => m?.concept?.uuid === order.concept.uuid),
      );
      if (byConcept.length > 0) {
        targetObs = byConcept[byConcept.length - 1];
      }
    }

    if (!targetObs) return undefined;
    if (targetObs.comment) return targetObs.comment;
    if (Array.isArray(targetObs.groupMembers)) {
      for (const m of targetObs.groupMembers) {
        if (m?.comment) return m.comment;
      }
    }
    return undefined;
  }, [encounterData, order]);
}

type OrderDetailsRowProps = {
  label: ReactNode;
  value: ReactNode;
};

export interface ListOrdersDetailsProps {
  groupedOrders: GroupedOrders;
}

const OrderDetailRow = ({ label, value }: OrderDetailsRowProps) => {
  return (
    <StructuredListRow className={styles.orderDetailsRow}>
      <StructuredListCell className={styles.orderDetailsCell}>
        <span className={styles.orderDetailsTextBold}>{label}</span>
      </StructuredListCell>
      <StructuredListCell className={styles.orderDetailsCell}>
        <span className={styles.orderDetailsText}>{value}</span>
      </StructuredListCell>
    </StructuredListRow>
  );
};
const getPriorityColor = (urgency: string | undefined): string => {
  if (!urgency) return 'gray';
  const normUrgency = urgency.toUpperCase();
  switch (normUrgency) {
    case 'E724BDB6-2C75-4B6F-A00C-D43F2C372974': // Emergencia
      return 'red';
    case 'B96959DB-2106-4CE7-B39B-6FCB2CA88CDA': // Urgente
    case 'STAT':
      return 'orange';
    case '427A595A-A5EE-4BA7-BCB7-2503248EFB31': // Urgencia menor
      return 'yellow';
    case 'BF3A08C6-CBE6-4F00-8E06-5F5437790B85': // Rutina / No urgente
    case 'ROUTINE':
      return 'green';
    case '65CF194E-05A7-4832-BA6D-9B7C9940A7C2': // Programado
    case 'ON_SCHEDULED_DATE':
      return 'blue';
    default:
      return 'gray';
  }
};

// biome-ignore lint/suspicious/noExplicitAny: order representation
const OrderItemDetails = ({ order }: { order: any }) => {
  const { t } = useTranslation();
  const { urgency, cleanInstructions } = extractPriorityFromInstructions(order.instructions, order.urgency);
  const orderObservationComment = useOrderObservationComment(order);

  return (
    <div className={styles.orderDetailsContainer}>
      <StructuredListWrapper className={styles.orderDetailsWrapper}>
        <StructuredListBody>
          <OrderDetailRow
            label={t('urgencyStatus', 'Urgency:')}
            value={
              <div className={styles.priorityPill} data-urgency-color={getPriorityColor(urgency)}>
                {getOrderUrgencyDisplay(urgency, t)}
                {(urgency?.toUpperCase() === '65CF194E-05A7-4832-BA6D-9B7C9940A7C2' ||
                  urgency?.toUpperCase() === 'ON_SCHEDULED_DATE') &&
                  order.scheduledDate &&
                  ` (${formatDate(parseDate(order.scheduledDate))})`}
              </div>
            }
          />
          <OrderDetailRow label={t('testOrdered', 'Test ordered:')} value={order.display} />
          <OrderDetailRow
            label={t('orderStatus', 'Status:')}
            value={
              <div
                className={styles.statusPill}
                data-status={(order.fulfillerStatus ?? 'Order not picked').replace('_', ' ')}
              >
                {getFulfillerStatusDisplay(order.fulfillerStatus, t)}
              </div>
            }
          />
          <OrderDetailRow label={t('orderNumbers', 'Order number:')} value={order.orderNumber} />
          <OrderDetailRow
            label={t('orderDate', 'Order date:')}
            value={formatDate(parseDate(order.dateActivated))}
          />
          <OrderDetailRow label={t('orderedBy', 'Ordered By:')} value={order.orderer?.display} />
          <OrderDetailRow
            label={t('orderInstructions', 'Instructions:')}
            value={cleanInstructions ?? t('NoInstructionLeft', 'No instructions are provided.')}
          />
          {orderObservationComment && (
            <OrderDetailRow label={t('observations', 'Observaciones:')} value={orderObservationComment} />
          )}

          {order.fulfillerStatus === 'DECLINED' && (
            <OrderDetailRow label={t('reasonForDecline', 'Reason for decline:')} value={order.fulfillerComment} />
          )}
        </StructuredListBody>
      </StructuredListWrapper>
      {(order.fulfillerStatus === 'COMPLETED' || order.fulfillerStatus === 'DRAFT') && (
        <Accordion>
          <AccordionItem
            open={order.fulfillerStatus === 'COMPLETED'}
            title={<span className={styles.accordionTitle}>{t('viewTestResults', 'View test results')}</span>}
          >
            <div className={styles.viewResults}>
              <ExtensionSlot
                className={styles.labResultSlot}
                state={{ order: order, hideObservations: true }}
                name="completed-lab-order-results-slot"
              />
            </div>
          </AccordionItem>
        </Accordion>
      )}

      <ExtensionSlot name="lab-order-pdf-attachments-slot" state={{ order }} />

      <div className={styles.buttonSection}>
        {order.fulfillerStatus === 'RECEIVED' || order.fulfillerStatus == null ? (
          <>
            <div className={styles.testsOrderedActions}>
              <ExtensionSlot state={{ order: order }} name="rejected-ordered-actions-slot" />
              <ExtensionSlot state={{ order: order }} name="tests-ordered-actions-slot" />
              <ExtensionSlot state={{ order: order }} name="add-lab-order-details-slot" />
            </div>
          </>
        ) : order.fulfillerStatus === 'IN_PROGRESS' ? (
          <>
            <div className={styles.testsOrderedActions}>
              <ExtensionSlot
                className={styles.menuLink}
                state={{ order: order }}
                name="inprogress-tests-actions-slot"
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

const ListOrderDetails: React.FC<ListOrdersDetailsProps> = ({ groupedOrders }) => {
  const originalOrders = groupedOrders?.originalOrders ?? [];

  return (
    <div>
      {originalOrders.map((order) => (
        <OrderItemDetails key={order.orderNumber} order={order} />
      ))}
    </div>
  );
};

export default ListOrderDetails;
