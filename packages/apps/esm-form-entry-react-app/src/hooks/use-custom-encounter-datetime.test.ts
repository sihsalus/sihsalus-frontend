import { renderHook } from '@testing-library/react';

import type { FormEntryReactConfig } from '../types';

import { useCustomEncounterDatetime } from './use-custom-encounter-datetime';

describe('useCustomEncounterDatetime', () => {
  const baseConfig: FormEntryReactConfig = {
    dataSources: { monthlySchedule: false },
    customDataSources: [],
    appointmentsResourceUrl: '',
    customEncounterDatetime: false,
  };

  it('returns existing preFilled when config is disabled', () => {
    const preFilled = { someField: 'someValue' };
    const { result } = renderHook(() => useCustomEncounterDatetime(baseConfig, '2024-01-01', preFilled));
    expect(result.current).toBe(preFilled);
  });

  it('returns existing preFilled when visit is in the future', () => {
    const config = { ...baseConfig, customEncounterDatetime: true };
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const preFilled = { someField: 'someValue' };
    const { result } = renderHook(() => useCustomEncounterDatetime(config, futureDate, preFilled));
    expect(result.current).toEqual(preFilled);
  });

  it('merges encDate when config is enabled and visit is in the past', () => {
    const config = { ...baseConfig, customEncounterDatetime: true };
    const pastDate = '2020-01-15T08:00:00.000+0000';
    const preFilled = { someField: 'someValue' };
    const { result } = renderHook(() => useCustomEncounterDatetime(config, pastDate, preFilled));
    expect(result.current).toEqual(expect.objectContaining({ someField: 'someValue', encDate: expect.any(String) }));
  });

  it('returns undefined when no preFilled and config disabled', () => {
    const { result } = renderHook(() => useCustomEncounterDatetime(baseConfig, '2024-01-01'));
    expect(result.current).toBeUndefined();
  });
});
