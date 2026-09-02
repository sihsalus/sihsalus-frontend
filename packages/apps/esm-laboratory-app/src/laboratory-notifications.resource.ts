import { useEffect, useRef } from 'react';

export const laboratoryNotificationTopic = 'laboratory';
export const labOrderCreatedEventType = 'LAB_ORDER_CREATED';
export const labResultReadyEventType = 'LAB_RESULT_READY';
const laboratoryEventTypes = [labOrderCreatedEventType, labResultReadyEventType] as const;

export type LaboratoryNotificationEventType = (typeof laboratoryEventTypes)[number];

type LaboratoryNotification = {
  id: string;
  topic: string;
  type: string;
};

export function getLaboratoryNotificationsUrl(openmrsBase = globalThis.openmrsBase): string | null {
  if (typeof openmrsBase !== 'string' || !openmrsBase.trim()) {
    return null;
  }

  return `${openmrsBase.replace(/\/+$/, '')}/ws/sihsalus/notifications/sse?topics=${laboratoryNotificationTopic}`;
}

/**
 * Subscribes to privacy-minimized order and result signals from the SIHSALUS notifications OMOD.
 * EventSource reconnects automatically when the server ends its bounded SSE response.
 */
export function useLaboratoryNotifications(
  enabled: boolean,
  onNotification: (eventType: LaboratoryNotificationEventType) => void,
) {
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  useEffect(() => {
    const url = getLaboratoryNotificationsUrl();
    if (!enabled || !url || typeof EventSource === 'undefined') {
      return;
    }

    const eventSource = new EventSource(url, { withCredentials: true });
    let lastDeliveredId: string | null = null;

    const handleNotification = (rawEvent: Event) => {
      const message = rawEvent as MessageEvent<string>;
      let notification: LaboratoryNotification;
      try {
        notification = JSON.parse(message.data) as LaboratoryNotification;
      } catch {
        return;
      }

      if (
        typeof notification.id !== 'string' ||
        notification.id === lastDeliveredId ||
        notification.topic !== laboratoryNotificationTopic ||
        !laboratoryEventTypes.includes(notification.type as LaboratoryNotificationEventType)
      ) {
        return;
      }

      lastDeliveredId = notification.id;
      callbackRef.current(notification.type as LaboratoryNotificationEventType);
    };

    laboratoryEventTypes.forEach((eventType) => {
      eventSource.addEventListener(eventType, handleNotification);
    });
    return () => {
      laboratoryEventTypes.forEach((eventType) => {
        eventSource.removeEventListener(eventType, handleNotification);
      });
      eventSource.close();
    };
  }, [enabled]);
}
