import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  normalizeQueueFilterValue,
  updateSelectedQueueLocationUuid,
  updateSelectedService,
  updateValueInSessionStorage,
  useServiceQueuesStore,
} from './store';

describe('normalizeQueueFilterValue', () => {
  it.each([null, undefined, '', '  ', 'all', 'ALL'])('normalizes the All sentinel %s to no filter', (value) => {
    expect(normalizeQueueFilterValue(value)).toBeNull();
  });

  it('keeps a concrete UUID and trims accidental whitespace', () => {
    expect(normalizeQueueFilterValue(' queue-location-uuid ')).toBe('queue-location-uuid');
  });
});

describe('Testing updateValueInSessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should save value in the session storage if valid value is passed', () => {
    updateValueInSessionStorage('key', 'value');
    expect(sessionStorage.getItem('key')).toBe('value');
  });

  it('should delete the key of the value passed is null or undefined', () => {
    updateValueInSessionStorage('key1', 'v1');
    expect(sessionStorage.getItem('key1')).toBe('v1');
    updateValueInSessionStorage('key1', null);
    expect(sessionStorage.getItem('key1')).toBe(null);

    updateValueInSessionStorage('key2', 'v2');
    expect(sessionStorage.getItem('key2')).toBe('v2');
    updateValueInSessionStorage('key2', undefined);
    expect(sessionStorage.getItem('key2')).toBe(null);
  });

  it('distinguishes an explicit All Queue Location from an uninitialized selection', () => {
    const { result } = renderHook(() => useServiceQueuesStore());

    act(() => updateSelectedQueueLocationUuid(null));

    expect(result.current.selectedQueueLocationUuid).toBeNull();
    expect(result.current.queueLocationSelectionInitialized).toBe(true);
    expect(sessionStorage.getItem('queueLocationUuid')).toBeNull();
    expect(sessionStorage.getItem('queueLocationSelection')).toBe('all');
  });

  it('persists a concrete Queue Location without the All sentinel', () => {
    const { result } = renderHook(() => useServiceQueuesStore());

    act(() => updateSelectedQueueLocationUuid('outpatient-location'));

    expect(result.current.selectedQueueLocationUuid).toBe('outpatient-location');
    expect(result.current.queueLocationSelectionInitialized).toBe(true);
    expect(sessionStorage.getItem('queueLocationUuid')).toBe('outpatient-location');
    expect(sessionStorage.getItem('queueLocationSelection')).toBeNull();
  });

  it('does not send legacy All sentinels as UPSS or service UUIDs', () => {
    const { result } = renderHook(() => useServiceQueuesStore());

    act(() => {
      updateSelectedQueueLocationUuid('all');
      updateSelectedService('all', 'All');
    });

    expect(result.current.selectedQueueLocationUuid).toBeNull();
    expect(result.current.selectedServiceUuid).toBeNull();
    expect(sessionStorage.getItem('queueLocationUuid')).toBeNull();
    expect(sessionStorage.getItem('queueServiceUuid')).toBeNull();
    expect(sessionStorage.getItem('queueLocationSelection')).toBe('all');
  });
});
