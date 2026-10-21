import { openmrsFetch } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { SWRConfig } from 'swr';

import type { ConfigObject } from '../../../config-schema';

import { saveAdverseReaction, useAdverseReactions } from './adverse-reaction.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const config = {
  encounterTypes: {
    vaccinationAdministration: '29c02aff-9a93-46c9-bf6f-48b552fcb1fa',
  },
  formsList: {
    adverseReactionForm: 'INMU-002-REPORTE ESAVI',
  },
  adverseReactionReporting: {
    formName: 'INMU-002-REPORTE ESAVI',
    formVersion: '1.0.0',
    encounterRoleUuid: 'synthetic-esavi-role',
    vaccineNameConceptUuid: 'f0000017-0000-4000-8000-000000000017',
    severityConceptUuid: 'f0000019-0000-4000-8000-000000000019',
    reactionDescriptionConceptUuid: 'f0000002-0000-4000-8000-000000000002',
    severityAnswers: {
      mild: 'f0000161-0000-4000-8000-000000000161',
      moderate: 'f0000162-0000-4000-8000-000000000162',
      severe: 'f0000163-0000-4000-8000-000000000163',
    },
  },
} as ConfigObject;

describe('adverse reaction resource', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: '6e4ae4b0-d746-3587-8f17-c0316847dff8',
            name: 'INMU-002-REPORTE ESAVI',
            display: 'INMU-002-REPORTE ESAVI',
            version: '1.0.0',
            published: true,
            retired: false,
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);
  });

  it('saves an adverse reaction as an ESAVI encounter with observations', async () => {
    const reportDatetime = new Date('2026-05-05T10:30:00.000Z');

    await saveAdverseReaction({
      patientUuid: 'patient-uuid',
      locationUuid: 'location-uuid',
      visitUuid: 'synthetic-visit',
      providerUuid: 'synthetic-provider',
      vaccineName: 'BCG',
      reactionDescription: 'Fiebre y enrojecimiento local',
      severity: 'moderate',
      reportDatetime,
      config,
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('/ws/rest/v1/form?'), { cache: 'no-store' });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith('/ws/rest/v1/encounter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        patient: 'patient-uuid',
        location: 'location-uuid',
        encounterDatetime: reportDatetime,
        encounterType: '29c02aff-9a93-46c9-bf6f-48b552fcb1fa',
        form: '6e4ae4b0-d746-3587-8f17-c0316847dff8',
        visit: 'synthetic-visit',
        encounterProviders: [{ provider: 'synthetic-provider', encounterRole: 'synthetic-esavi-role' }],
        obs: [
          {
            concept: 'f0000017-0000-4000-8000-000000000017',
            value: 'BCG',
          },
          {
            concept: 'f0000019-0000-4000-8000-000000000019',
            value: 'f0000162-0000-4000-8000-000000000162',
          },
          {
            concept: 'f0000002-0000-4000-8000-000000000002',
            value: 'Fiebre y enrojecimiento local',
          },
        ],
      },
    });
  });
});

it.each(['mild', 'moderate', 'severe', 'historical'] as const)(
  'maps severity by configured UUID: %s',
  async (severity) => {
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          {
            uuid: 'synthetic-esavi',
            encounterDatetime: '2026-10-10T05:00:00Z',
            form: { name: config.formsList.adverseReactionForm },
            obs: [
              {
                uuid: 'synthetic-severity',
                concept: { uuid: config.adverseReactionReporting.severityConceptUuid },
                value: {
                  uuid:
                    severity === 'historical'
                      ? 'old-concept'
                      : config.adverseReactionReporting.severityAnswers[severity],
                  display: 'Stored label',
                },
              },
            ],
          },
        ],
      },
    } as never);
    const { result } = renderHook(() => useAdverseReactions('synthetic-child', config), {
      wrapper: ({ children }) => createElement(SWRConfig, { value: { provider: () => new Map() } }, children),
    });
    await waitFor(() => expect(result.current.reactions).toHaveLength(1));
    expect(result.current.reactions[0].severityCode).toBe(severity === 'historical' ? undefined : severity);
    expect(result.current.reactions[0].severity).toBe('Stored label');
  },
);

const savePayload = {
  patientUuid: 'synthetic-child',
  locationUuid: 'synthetic-location',
  visitUuid: 'synthetic-visit',
  providerUuid: 'synthetic-provider',
  vaccineName: 'BCG',
  reactionDescription: 'Synthetic reaction',
  severity: 'mild' as const,
  reportDatetime: new Date('2026-10-01T00:00:00Z'),
  config,
};
it.each(['visitUuid', 'providerUuid', 'locationUuid', 'patientUuid'] as const)(
  'does not POST without %s',
  async (missing) => {
    mockOpenmrsFetch.mockReset();
    await expect(saveAdverseReaction({ ...savePayload, [missing]: '' })).rejects.toThrow();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  },
);
it.each([
  [{ uuid: 'wrong', name: config.formsList.adverseReactionForm, version: '1.0.0', published: false, retired: false }],
  [{ uuid: 'old', name: config.formsList.adverseReactionForm, version: '0.9', published: true, retired: false }],
  [{ uuid: 'retired', name: config.formsList.adverseReactionForm, version: '1.0.0', published: true, retired: true }],
  [
    { uuid: 'one', name: config.formsList.adverseReactionForm, version: '1.0.0', published: true, retired: false },
    { uuid: 'two', name: config.formsList.adverseReactionForm, version: '1.0.0', published: true, retired: false },
  ],
])('does not POST an unverified or ambiguous ESAVI schema: %j', async (...results) => {
  mockOpenmrsFetch.mockReset();
  mockOpenmrsFetch.mockResolvedValue({ data: { results } } as never);
  await expect(saveAdverseReaction(savePayload)).rejects.toThrow();
  expect(mockOpenmrsFetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});
