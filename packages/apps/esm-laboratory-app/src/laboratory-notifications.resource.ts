import { useEffect, useRef } from 'react';

export const laboratoryNotificationTopic = 'laboratory';
export const labOrderCreatedEventType = 'LAB_ORDER_CREATED';
export const labResultReadyEventType = 'LAB_RESULT_READY';
export const notificationResyncEventType = 'SIHSALUS_RESYNC_REQUIRED';
const laboratoryEventTypes = [labOrderCreatedEventType, labResultReadyEventType] as const;
const maxRememberedEventIds = 100;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LaboratoryNotificationEventType = (typeof laboratoryEventTypes)[number];

type LaboratoryNotification = {
  id: string;
  topic: string;
  type: string;
  payload?: {
    orderUuid?: string;
  };
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
  onResyncRequired: () => void,
) {
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;
  const resyncCallbackRef = useRef(onResyncRequired);
  resyncCallbackRef.current = onResyncRequired;

  useEffect(() => {
    const url = getLaboratoryNotificationsUrl();
    if (!enabled || !url || typeof EventSource === 'undefined') {
      return;
    }

    const eventSource = new EventSource(url, { withCredentials: true });
    const deliveredIds = new Set<string>();
    const deliveredIdOrder: Array<string> = [];

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
        deliveredIds.has(notification.id) ||
        notification.topic !== laboratoryNotificationTopic ||
        !laboratoryEventTypes.includes(notification.type as LaboratoryNotificationEventType) ||
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
      callbackRef.current(notification.type as LaboratoryNotificationEventType);
    };

    const handleResyncRequired = () => {
      resyncCallbackRef.current();
    };

    laboratoryEventTypes.forEach((eventType) => {
      eventSource.addEventListener(eventType, handleNotification);
    });
    eventSource.addEventListener(notificationResyncEventType, handleResyncRequired);
    return () => {
      laboratoryEventTypes.forEach((eventType) => {
        eventSource.removeEventListener(eventType, handleNotification);
      });
      eventSource.removeEventListener(notificationResyncEventType, handleResyncRequired);
      eventSource.close();
    };
  }, [enabled]);
}
