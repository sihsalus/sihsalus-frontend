import { openmrsFetch } from '@openmrs/esm-framework';

import type { ConfigObject } from '../../../config-schema';

import { saveAdverseReaction } from './adverse-reaction.resource';

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
            published: true,
            retired: false,
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);
  });

  it('saves an adverse reaction as an ESAVI encounter with observations', async () => {
    const occurrenceDate = new Date('2026-05-05T10:30:00.000Z');

    await saveAdverseReaction({
      patientUuid: 'patient-uuid',
      locationUuid: 'location-uuid',
      vaccineName: 'BCG',
      reactionDescription: 'Fiebre y enrojecimiento local',
      severity: 'moderate',
      occurrenceDate,
      config,
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('/ws/rest/v1/form?q=INMU-002-REPORTE+ESAVI'));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith('/ws/rest/v1/encounter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        patient: 'patient-uuid',
        location: 'location-uuid',
        encounterDatetime: occurrenceDate,
        encounterType: '29c02aff-9a93-46c9-bf6f-48b552fcb1fa',
        form: '6e4ae4b0-d746-3587-8f17-c0316847dff8',
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

  it('does not save when OpenMRS only returns an approximate form name', async () => {
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'wrong-form-uuid',
            name: 'INMU-002-REPORTE ESAVI LEGACY',
            published: true,
            retired: false,
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(
      saveAdverseReaction({
        patientUuid: 'patient-uuid',
        locationUuid: 'location-uuid',
        vaccineName: 'BCG',
        reactionDescription: 'Fiebre',
        severity: 'mild',
        occurrenceDate: new Date('2026-05-05T10:30:00.000Z'),
        config,
      }),
    ).rejects.toThrow(/No published CRED form/u);

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch).not.toHaveBeenCalledWith('/ws/rest/v1/encounter', expect.anything());
  });
});
