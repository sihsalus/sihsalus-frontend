import { getDefaultsFromConfigSchema, openmrsFetch, useConfig, useSession } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { mockSession } from 'test-utils';
import { type ConfigObject, configSchema } from '../config-schema';
import VitalsHeader from './vitals-header.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');
  return {
    ...originalModule,
    useVisitOrOfflineVisit: vi.fn(() => ({ currentVisit: null })),
  };
});

const config = getDefaultsFromConfigSchema(configSchema) as ConfigObject;
const pulseUuid = config.concepts.pulseUuid;
const pulseMetadata = {
  uuid: pulseUuid,
  display: 'Heart rate',
  lowNormal: 60,
  hiNormal: 100,
  lowCritical: 45,
  hiCritical: 150,
  lowAbsolute: 0,
  hiAbsolute: 230,
  units: 'beats/min',
};

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue(config);
  vi.mocked(useSession).mockReturnValue({
    ...mockSession.data,
    user: {
      ...mockSession.data.user,
      privileges: [{ display: 'app:hoja.clinica.signosVitales.editar' }],
    },
  } as never);
});

describe('Vitals header reference ranges', () => {
  it.each([
    { state: 'patient-specific', expectedRange: '80 – 100 beats/min', abnormal: true },
    { state: 'partial', expectedRange: 'N/A', abnormal: true },
    { state: 'empty', expectedRange: '60 – 100 beats/min', abnormal: false },
    { state: 'error', expectedRange: '60 – 100 beats/min', abnormal: false },
  ])('explains the interpretation using the same $state ranges', async ({ state, expectedRange, abnormal }) => {
    const user = userEvent.setup();
    vi.mocked(openmrsFetch).mockImplementation((url) => {
      const requestUrl = String(url);
      let data: unknown;
      if (requestUrl.includes('/conceptreferencerange?')) {
        if (state === 'error') {
          return Promise.reject(new Error('Reference ranges unavailable'));
        }
        data = {
          results:
            state === 'patient-specific' || state === 'partial'
              ? [{ concept: pulseUuid, lowNormal: 80, hiNormal: state === 'partial' ? undefined : 100 }]
              : [],
        };
      } else if (requestUrl.includes('/concept/')) {
        data = { setMembers: [pulseMetadata] };
      } else if (requestUrl.includes('/Observation?')) {
        data = {
          entry: [
            {
              resource: {
                resourceType: 'Observation',
                code: { coding: [{ code: pulseUuid }] },
                effectiveDateTime: '2026-10-10T12:00:00Z',
                encounter: { reference: 'Encounter/synthetic-encounter' },
                valueQuantity: { value: 78 },
              },
            },
          ],
          link: [],
        };
      } else {
        throw new Error('Unexpected test request');
      }
      return Promise.resolve({ data }) as ReturnType<typeof openmrsFetch>;
    });

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
        <VitalsHeader patientUuid="synthetic-patient" />
      </SWRConfig>,
    );

    expect(await screen.findByText('78')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View normal ranges' }));
    expect(await screen.findByText(expectedRange)).toBeInTheDocument();
    await waitFor(() => {
      expect(Boolean(screen.queryByTitle('Abnormal value'))).toBe(abnormal);
    });
    expect(openmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/conceptreferencerange?patient=synthetic-patient&concept='),
    );
  });
});
