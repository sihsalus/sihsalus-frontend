import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLaboratoryNotificationsUrl,
  labOrderCreatedEventType,
  labResultReadyEventType,
  notificationResyncEventType,
  useLaboratoryNotifications,
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

  emit(type: string, data = '') {
    this.listeners.get(type)?.({ type, data } as MessageEvent<string>);
  }
}

describe('laboratory notifications', () => {
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

  it('delivers valid order and result events once and closes on unmount', () => {
    const onNotification = vi.fn();
    const onResyncRequired = vi.fn();
    const { unmount } = renderHook(() => useLaboratoryNotifications(true, onNotification, onResyncRequired));
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
    source.emit(
      labOrderCreatedEventType,
      JSON.stringify({
        id: '1aef6dc9-5000-4295-9756-f6beba41bd0d',
        topic: 'laboratory',
        type: labOrderCreatedEventType,
        payload: { orderUuid: 'e1522ef2-c541-4b80-80ea-6f45ecdd8cbe' },
      }),
    );

    expect(onNotification).toHaveBeenNthCalledWith(1, labResultReadyEventType);
    expect(onNotification).toHaveBeenNthCalledWith(2, labOrderCreatedEventType);
    unmount();
    expect(source.close).toHaveBeenCalledOnce();
    expect(source.listeners.has(labResultReadyEventType)).toBe(false);
    expect(source.listeners.has(labOrderCreatedEventType)).toBe(false);
    expect(source.listeners.has(notificationResyncEventType)).toBe(false);
  });

  it('requests a silent authoritative refresh when replay cannot be completed', () => {
    const onNotification = vi.fn();
    const onResyncRequired = vi.fn();
    renderHook(() => useLaboratoryNotifications(true, onNotification, onResyncRequired));

    FakeEventSource.instances[0].emit(notificationResyncEventType, '{"reason":"cursor-unavailable"}');

    expect(onResyncRequired).toHaveBeenCalledOnce();
    expect(onNotification).not.toHaveBeenCalled();
  });

  it('ignores malformed and mismatched events', () => {
    const onNotification = vi.fn();
    renderHook(() => useLaboratoryNotifications(true, onNotification, vi.fn()));
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
    source.emit(
      labResultReadyEventType,
      JSON.stringify({
        id: 'event-3',
        topic: 'laboratory',
        type: labResultReadyEventType,
        payload: { orderUuid: 'not-a-uuid' },
      }),
    );

    expect(onNotification).not.toHaveBeenCalled();
  });

  it.each(['null', 'false', '42', '"text"', '[]', '{}', '{"payload":null}'])(
    'ignores invalid event envelopes without throwing: %s',
    (data) => {
      const onNotification = vi.fn();
      renderHook(() => useLaboratoryNotifications(true, onNotification, vi.fn()));
      expect(() => FakeEventSource.instances[0].emit(labResultReadyEventType, data)).not.toThrow();
      expect(onNotification).not.toHaveBeenCalled();
    },
  );

  it('rejects blank IDs and event names that disagree with the envelope', () => {
    const onNotification = vi.fn();
    renderHook(() => useLaboratoryNotifications(true, onNotification, vi.fn()));
    const source = FakeEventSource.instances[0];
    const envelope = {
      id: ' ',
      topic: 'laboratory',
      type: labResultReadyEventType,
      payload: { orderUuid: 'b6a5acd3-8c57-47c4-a9af-180c614bbd87' },
    };
    source.emit(labResultReadyEventType, JSON.stringify(envelope));
    // Deliver through the registered listener with a mismatched transport event type.
    source.listeners.get(labResultReadyEventType)?.({
      type: 'UNEXPECTED_EVENT',
      data: JSON.stringify({ ...envelope, id: 'valid-id' }),
    } as MessageEvent<string>);
    expect(onNotification).not.toHaveBeenCalled();
  });

  it('silently refreshes on initial connection and reconnect using the latest callback', () => {
    const onNotification = vi.fn();
    const firstRefresh = vi.fn();
    const nextRefresh = vi.fn();
    const { rerender } = renderHook(({ refresh }) => useLaboratoryNotifications(true, onNotification, refresh), {
      initialProps: { refresh: firstRefresh },
    });
    const source = FakeEventSource.instances[0];
    source.emit('open');
    expect(firstRefresh).toHaveBeenCalledOnce();
    // EventSource owns retries and Last-Event-ID; rerenders must not recreate it.
    source.emit('error');
    rerender({ refresh: nextRefresh });
    source.emit('open');
    expect(nextRefresh).toHaveBeenCalledOnce();
    expect(firstRefresh).toHaveBeenCalledOnce();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(onNotification).not.toHaveBeenCalled();
  });

  it('keeps replay deduplication across reconnects', () => {
    const onNotification = vi.fn();
    renderHook(() => useLaboratoryNotifications(true, onNotification, vi.fn()));
    const source = FakeEventSource.instances[0];
    const data = JSON.stringify({
      id: 'replayed-event',
      topic: 'laboratory',
      type: labResultReadyEventType,
      payload: { orderUuid: 'b6a5acd3-8c57-47c4-a9af-180c614bbd87' },
    });
    source.emit('open');
    source.emit(labResultReadyEventType, data);
    source.emit('error');
    source.emit('open');
    source.emit(labResultReadyEventType, data);
    expect(onNotification).toHaveBeenCalledOnce();
  });

  it('removes every listener when disabled and creates a fresh connection when re-enabled', () => {
    const onNotification = vi.fn();
    const onRefresh = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useLaboratoryNotifications(enabled, onNotification, onRefresh),
      {
        initialProps: { enabled: true },
      },
    );
    const first = FakeEventSource.instances[0];
    rerender({ enabled: false });
    expect(first.close).toHaveBeenCalledOnce();
    expect(first.listeners.size).toBe(0);
    first.emit('open');
    expect(onRefresh).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(FakeEventSource.instances).toHaveLength(2);
    FakeEventSource.instances[1].emit('open');
    expect(onRefresh).toHaveBeenCalledOnce();
    unmount();
    expect(FakeEventSource.instances[1].close).toHaveBeenCalledOnce();
    expect(FakeEventSource.instances[1].listeners.size).toBe(0);
  });

  it('does not invent successful delivery or force retries on connection errors', () => {
    const onNotification = vi.fn();
    const onRefresh = vi.fn();
    renderHook(() => useLaboratoryNotifications(true, onNotification, onRefresh));
    const source = FakeEventSource.instances[0];
    source.emit('error');
    source.emit('error');
    expect(onNotification).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('does not connect without a base URL or browser EventSource support', () => {
    vi.stubGlobal('openmrsBase', '');
    const { unmount } = renderHook(() => useLaboratoryNotifications(true, vi.fn(), vi.fn()));
    expect(FakeEventSource.instances).toHaveLength(0);
    unmount();
    vi.stubGlobal('openmrsBase', '/openmrs');
    vi.stubGlobal('EventSource', undefined);
    renderHook(() => useLaboratoryNotifications(true, vi.fn(), vi.fn()));
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('does not connect when realtime notifications are disabled', () => {
    renderHook(() => useLaboratoryNotifications(false, vi.fn(), vi.fn()));

    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
