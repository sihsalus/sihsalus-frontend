import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { mockVitalsConfig } from 'test-utils';
import { saveVitalsAndBiometrics } from './data.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const concepts = {
  ...mockVitalsConfig.concepts,
  bodyMassIndexUuid: '1342AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};
const glasgowEyeOpeningSpontaneousUuid = 'faff1dec-14df-44d4-8695-b337dced2274';
const glasgowVerbalResponseOrientedUuid = '6440f83b-657e-4c5c-bac5-e3f67660ea4e';
const glasgowMotorResponseObeysCommandsUuid = 'bddbf4e2-c870-4515-924e-d98cfcb7948f';

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
        glasgowEyeOpening: glasgowEyeOpeningSpontaneousUuid,
        glasgowVerbalResponse: glasgowVerbalResponseOrientedUuid,
        glasgowMotorResponse: glasgowMotorResponseObeysCommandsUuid,
        glasgowTotal: 15,
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
          {
            concept: concepts.glasgowEyeOpeningUuid,
            value: glasgowEyeOpeningSpontaneousUuid,
          },
          {
            concept: concepts.glasgowVerbalResponseUuid,
            value: glasgowVerbalResponseOrientedUuid,
          },
          {
            concept: concepts.glasgowMotorResponseUuid,
            value: glasgowMotorResponseObeysCommandsUuid,
          },
          {
            concept: concepts.glasgowTotalUuid,
            value: 15,
          },
        ],
      },
    });
  });
});
