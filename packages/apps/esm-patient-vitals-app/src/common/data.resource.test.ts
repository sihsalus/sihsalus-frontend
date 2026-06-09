import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { mockVitalsConfig } from 'test-utils';
import { saveVitalsAndBiometrics } from './data.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const concepts = {
  ...mockVitalsConfig.concepts,
  bodyMassIndexUuid: '1342AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

describe('vitals and biometrics resources', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('posts manual vitals without a form reference', () => {
    const abortController = new AbortController();

    saveVitalsAndBiometrics(
      mockVitalsConfig.vitals.encounterTypeUuid,
      concepts,
      'patient-uuid',
      {
        weight: 70,
        abdominalCircumference: 100,
        oxygenSaturation: 0,
      },
      abortController,
      'location-uuid',
      'visit-uuid',
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
      body: {
        patient: 'patient-uuid',
        location: 'location-uuid',
        encounterType: mockVitalsConfig.vitals.encounterTypeUuid,
        visit: 'visit-uuid',
        obs: [
          {
            concept: concepts.weightUuid,
            value: 70,
          },
          {
            concept: concepts.abdominalCircumferenceUuid,
            value: 100,
          },
          {
            concept: concepts.oxygenSaturationUuid,
            value: 0,
          },
        ],
      },
    });
  });
});
