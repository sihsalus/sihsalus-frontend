import { useEffect, useRef } from 'react';

export const pharmacyNotificationTopic = 'pharmacy';
export const medicationOrderCreatedEventType = 'MEDICATION_ORDER_CREATED';

type PharmacyNotification = {
  id: string;
  topic: string;
  type: string;
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
export function useMedicationOrderNotifications(enabled: boolean, onOrderCreated: () => void) {
  const callbackRef = useRef(onOrderCreated);
  callbackRef.current = onOrderCreated;

  useEffect(() => {
    const url = getPharmacyNotificationsUrl();
    if (!enabled || !url || typeof EventSource === 'undefined') {
      return;
    }

    const eventSource = new EventSource(url, { withCredentials: true });
    let lastDeliveredId: string | null = null;

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
        notification.id === lastDeliveredId ||
        notification.topic !== pharmacyNotificationTopic ||
        notification.type !== medicationOrderCreatedEventType
      ) {
        return;
      }

      lastDeliveredId = notification.id;
      callbackRef.current();
    };

    eventSource.addEventListener(medicationOrderCreatedEventType, handleOrderCreated);
    return () => {
      eventSource.removeEventListener(medicationOrderCreatedEventType, handleOrderCreated);
      eventSource.close();
    };
  }, [enabled]);
}
