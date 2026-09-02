import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLaboratoryNotificationsUrl,
  labResultReadyEventType,
  useLabResultReadyNotifications,
} from './laboratory-notifications.resource';

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

describe('laboratory result-ready notifications', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('openmrsBase', '/openmrs/');
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the authenticated laboratory SSE endpoint under the OpenMRS context path', () => {
    expect(getLaboratoryNotificationsUrl()).toBe('/openmrs/ws/sihsalus/notifications/sse?topics=laboratory');
    expect(getLaboratoryNotificationsUrl('')).toBeNull();
  });

  it('delivers each valid result-ready event once and closes on unmount', () => {
    const onResultReady = vi.fn();
    const { unmount } = renderHook(() => useLabResultReadyNotifications(true, onResultReady));
    const source = FakeEventSource.instances[0];

    expect(source.url).toBe('/openmrs/ws/sihsalus/notifications/sse?topics=laboratory');
    expect(source.withCredentials).toBe(true);

    const event = JSON.stringify({
      id: '61f62f33-39ac-4fab-8366-2ee2ed08b89b',
      topic: 'laboratory',
      type: labResultReadyEventType,
      payload: { orderUuid: '5eb7c2ad-86ac-4f5e-8b86-ec14a0fb40df' },
    });
    source.emit(labResultReadyEventType, event);
    source.emit(labResultReadyEventType, event);

    expect(onResultReady).toHaveBeenCalledTimes(1);
    unmount();
    expect(source.close).toHaveBeenCalledOnce();
    expect(source.listeners.has(labResultReadyEventType)).toBe(false);
  });

  it('ignores malformed and mismatched events', () => {
    const onResultReady = vi.fn();
    renderHook(() => useLabResultReadyNotifications(true, onResultReady));
    const source = FakeEventSource.instances[0];

    source.emit(labResultReadyEventType, 'not-json');
    source.emit(
      labResultReadyEventType,
      JSON.stringify({ id: 'event-1', topic: 'queue', type: labResultReadyEventType }),
    );
    source.emit(
      labResultReadyEventType,
      JSON.stringify({ id: 'event-2', topic: 'laboratory', type: 'LAB_ORDER_UPDATED' }),
    );

    expect(onResultReady).not.toHaveBeenCalled();
  });

  it('does not connect when realtime notifications are disabled', () => {
    renderHook(() => useLabResultReadyNotifications(false, vi.fn()));

    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
