import { useEffect, useRef } from 'react';

export const laboratoryNotificationTopic = 'laboratory';
export const labResultReadyEventType = 'LAB_RESULT_READY';

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
 * Subscribes to the privacy-minimized result-ready signal from the SIHSALUS notifications OMOD.
 * EventSource reconnects automatically when the server ends its bounded SSE response.
 */
export function useLabResultReadyNotifications(enabled: boolean, onResultReady: () => void) {
  const callbackRef = useRef(onResultReady);
  callbackRef.current = onResultReady;

  useEffect(() => {
    const url = getLaboratoryNotificationsUrl();
    if (!enabled || !url || typeof EventSource === 'undefined') {
      return;
    }

    const eventSource = new EventSource(url, { withCredentials: true });
    let lastDeliveredId: string | null = null;

    const handleResultReady = (rawEvent: Event) => {
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
        notification.type !== labResultReadyEventType
      ) {
        return;
      }

      lastDeliveredId = notification.id;
      callbackRef.current();
    };

    eventSource.addEventListener(labResultReadyEventType, handleResultReady);
    return () => {
      eventSource.removeEventListener(labResultReadyEventType, handleResultReady);
      eventSource.close();
    };
  }, [enabled]);
}
