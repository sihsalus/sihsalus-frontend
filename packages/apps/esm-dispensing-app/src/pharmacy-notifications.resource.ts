import { useEffect, useRef } from 'react';

export const pharmacyNotificationTopic = 'pharmacy';
export const medicationOrderCreatedEventType = 'MEDICATION_ORDER_CREATED';
export const notificationResyncEventType = 'SIHSALUS_RESYNC_REQUIRED';
const maxRememberedEventIds = 100;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PharmacyNotification = {
  id: string;
  topic: string;
  type: string;
  payload?: {
    orderUuid?: string;
  };
};

export function getPharmacyNotificationsUrl(openmrsBase = globalThis.openmrsBase): string | null {
  if (typeof openmrsBase !== 'string' || !openmrsBase.trim()) {
    return null;
  }

  return `${openmrsBase.replace(/\/+$/, '')}/ws/sihsalus/notifications/sse?topics=${pharmacyNotificationTopic}`;
}

/**
 * Subscribes to the privacy-minimized medication-order signal from the notifications OMOD.
 * EventSource reconnects automatically when the server ends its bounded SSE response.
 */
export function useMedicationOrderNotifications(
  enabled: boolean,
  onOrderCreated: () => void,
  onResyncRequired: () => void,
) {
  const callbackRef = useRef(onOrderCreated);
  callbackRef.current = onOrderCreated;
  const resyncCallbackRef = useRef(onResyncRequired);
  resyncCallbackRef.current = onResyncRequired;

  useEffect(() => {
    const url = getPharmacyNotificationsUrl();
    if (!enabled || !url || typeof EventSource === 'undefined') {
      return;
    }

    const eventSource = new EventSource(url, { withCredentials: true });
    const deliveredIds = new Set<string>();
    const deliveredIdOrder: Array<string> = [];

    const handleOrderCreated = (rawEvent: Event) => {
      const message = rawEvent as MessageEvent<string>;
      let notification: PharmacyNotification;
      try {
        notification = JSON.parse(message.data) as PharmacyNotification;
      } catch {
        return;
      }

      if (
        typeof notification.id !== 'string' ||
        deliveredIds.has(notification.id) ||
        notification.topic !== pharmacyNotificationTopic ||
        notification.type !== medicationOrderCreatedEventType ||
        typeof notification.payload?.orderUuid !== 'string' ||
        !uuidPattern.test(notification.payload.orderUuid)
      ) {
        return;
      }

      deliveredIds.add(notification.id);
      deliveredIdOrder.push(notification.id);
      if (deliveredIdOrder.length > maxRememberedEventIds) {
        const oldestId = deliveredIdOrder.shift();
        if (oldestId) deliveredIds.delete(oldestId);
      }
      callbackRef.current();
    };

    const handleResyncRequired = () => {
      resyncCallbackRef.current();
    };

    eventSource.addEventListener(medicationOrderCreatedEventType, handleOrderCreated);
    eventSource.addEventListener(notificationResyncEventType, handleResyncRequired);
    return () => {
      eventSource.removeEventListener(medicationOrderCreatedEventType, handleOrderCreated);
      eventSource.removeEventListener(notificationResyncEventType, handleResyncRequired);
      eventSource.close();
    };
  }, [enabled]);
}
