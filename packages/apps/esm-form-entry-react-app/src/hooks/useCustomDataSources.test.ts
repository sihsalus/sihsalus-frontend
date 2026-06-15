import { renderHook, waitFor } from '@testing-library/react';

import type { FormEntryReactConfig } from '../types';

import { useCustomDataSources } from './useCustomDataSources';

const mockRegisterCustomDataSource = vi.fn();

vi.mock('../form-engine-lib-runtime', () => ({
  registerCustomDataSource: (registration: unknown) => mockRegisterCustomDataSource(registration),
}));

describe('useCustomDataSources', () => {
  const baseConfig: FormEntryReactConfig = {
    dataSources: { monthlySchedule: false },
    customDataSources: [],
    appointmentsResourceUrl: '',
    customEncounterDatetime: false,
  };

  beforeEach(() => {
    mockRegisterCustomDataSource.mockReset();
    delete window['_custom_module'];
  });

  it('registers the deprecated monthlySchedule datasource when enabled', async () => {
    const config: FormEntryReactConfig = {
      ...baseConfig,
      dataSources: { monthlySchedule: true },
      appointmentsResourceUrl: '/etl-latest/etl/get-monthly-schedule',
    };

    renderHook(() => useCustomDataSources(config));

    expect(mockRegisterCustomDataSource).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'monthlySchedule',
      }),
    );

    const registration = mockRegisterCustomDataSource.mock.calls[0][0];
    const loadedDataSource = await registration.load();

    expect(loadedDataSource.default).toEqual(
      expect.objectContaining({
        fetchData: expect.any(Function),
        fetchSingleItem: expect.any(Function),
        toUuidAndDisplay: expect.any(Function),
      }),
    );
  });

  it('registers module federation custom data sources from config', async () => {
    const customDataSource = {
      fetchData: vi.fn(),
      fetchSingleItem: vi.fn(),
      toUuidAndDisplay: vi.fn(),
    };

    window['_custom_module'] = {
      get: vi.fn().mockResolvedValue(() => ({
        customDataSource,
      })),
    };

    const config: FormEntryReactConfig = {
      ...baseConfig,
      customDataSources: [
        {
          name: 'customSource',
          moduleName: '@custom/module',
          moduleExport: 'customDataSource',
        },
      ],
    };

    renderHook(() => useCustomDataSources(config));

    await waitFor(() =>
      expect(mockRegisterCustomDataSource).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'customSource',
        }),
      ),
    );

    const registration = mockRegisterCustomDataSource.mock.calls[0][0];
    const loadedDataSource = await registration.load();

    expect(loadedDataSource.default).toBe(customDataSource);
  });
});
