import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPharmacyNotificationsUrl,
  medicationOrderCreatedEventType,
  useMedicationOrderNotifications,
} from './pharmacy-notifications.resource';

class FakeEventSource {
  static instances: Array<FakeEventSource> = [];

  readonly url: string;
  readonly withCredentials: boolean;
  readonly listeners = new Map<string, EventListener>();
  readonly close = vi.fn();

  constructor(url: string | URL, init?: EventSourceInit) {
    this.url = url.toString();
    this.withCredentials = init?.withCredentials ?? false;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    if (this.listeners.get(type) === listener) {
      this.listeners.delete(type);
    }
  }

  emit(type: string, data: string) {
    this.listeners.get(type)?.({ data } as MessageEvent<string>);
  }
}

describe('pharmacy medication-order notifications', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('openmrsBase', '/openmrs/');
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the authenticated pharmacy SSE endpoint under the OpenMRS context path', () => {
    expect(getPharmacyNotificationsUrl()).toBe('/openmrs/ws/sihsalus/notifications/sse?topics=pharmacy');
    expect(getPharmacyNotificationsUrl('')).toBeNull();
  });

  it('delivers each valid medication-order event once and closes on unmount', () => {
    const onOrderCreated = vi.fn();
    const { unmount } = renderHook(() => useMedicationOrderNotifications(true, onOrderCreated));
    const source = FakeEventSource.instances[0];

    expect(source.url).toBe('/openmrs/ws/sihsalus/notifications/sse?topics=pharmacy');
    expect(source.withCredentials).toBe(true);

    const event = JSON.stringify({
      id: 'cdf8e769-892d-468f-ac7b-e0bbd12634b7',
      topic: 'pharmacy',
      type: medicationOrderCreatedEventType,
      payload: { orderUuid: 'b6a5acd3-8c57-47c4-a9af-180c614bbd87' },
    });
    source.emit(medicationOrderCreatedEventType, event);
    source.emit(medicationOrderCreatedEventType, event);

    expect(onOrderCreated).toHaveBeenCalledOnce();
    unmount();
    expect(source.close).toHaveBeenCalledOnce();
    expect(source.listeners.has(medicationOrderCreatedEventType)).toBe(false);
  });

  it('ignores malformed and unauthorized-topic events', () => {
    const onOrderCreated = vi.fn();
    renderHook(() => useMedicationOrderNotifications(true, onOrderCreated));
    const source = FakeEventSource.instances[0];

    source.emit(medicationOrderCreatedEventType, 'not-json');
    source.emit(
      medicationOrderCreatedEventType,
      JSON.stringify({ id: 'event-1', topic: 'laboratory', type: medicationOrderCreatedEventType }),
    );
    source.emit(
      medicationOrderCreatedEventType,
      JSON.stringify({ id: 'event-2', topic: 'pharmacy', type: 'MEDICATION_ORDER_UPDATED' }),
    );

    expect(onOrderCreated).not.toHaveBeenCalled();
  });

  it('does not connect when realtime notifications are disabled', () => {
    renderHook(() => useMedicationOrderNotifications(false, vi.fn()));

    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
