import { openmrsFetch } from '@openmrs/esm-framework';

import {
  childNutritionFormFallbacks,
  getCREDFormIdentifier,
  neonatalFormFallbacks,
  resolveCREDForm,
  wellChildControlFormFallbacks,
} from './useCREDFormLauncher';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  launchWorkspace2: vi.fn(),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  showSnackbar: vi.fn(),
  useConfig: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('CRED form launcher resources', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('uses the child nutrition fallback when config does not provide the form key', () => {
    expect(
      getCREDFormIdentifier(
        undefined,
        'nutritionalAssessmentForm',
        childNutritionFormFallbacks.nutritionalAssessmentForm,
      ),
    ).toBe('CRED-006-EVALUACIÓN NUTRICIONAL');
  });

  it('uses the neonatal fallback when config does not provide the form key', () => {
    expect(getCREDFormIdentifier(undefined, 'birthDetails', neonatalFormFallbacks.birthDetails)).toBe(
      '8db0f1dc-c191-3468-854c-6c6c41ef6198',
    );
  });

  it('uses the well-child control fallback when config does not provide the form key', () => {
    expect(
      getCREDFormIdentifier(
        undefined,
        'stimulationFollowupForm',
        wellChildControlFormFallbacks.stimulationFollowupForm,
      ),
    ).toBe('CRED-004-SEGUIMIENTO DEL DESARROLLO');
  });

  it('prefers the configured form identifier over the fallback', () => {
    expect(
      getCREDFormIdentifier(
        { nutritionalAssessmentForm: 'CRED-006-EVALUACIÓN NUTRICIONAL' },
        'nutritionalAssessmentForm',
        childNutritionFormFallbacks.nutritionalAssessmentForm,
      ),
    ).toBe('CRED-006-EVALUACIÓN NUTRICIONAL');
  });

  it('resolves a form UUID through the OpenMRS form endpoint', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        uuid: '21f010ce-4876-32ec-8844-27dfedc6705a',
        name: 'CRED-006-EVALUACIÓN NUTRICIONAL',
        display: 'CRED-006-EVALUACIÓN NUTRICIONAL',
        published: true,
        retired: false,
        resources: [
          {
            uuid: 'resource-uuid',
            name: 'JSON schema',
            dataType: 'AmpathJsonSchema',
            valueReference: 'clob-uuid',
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const form = await resolveCREDForm('21f010ce-4876-32ec-8844-27dfedc6705a', 'CRED-006-EVALUACIÓN NUTRICIONAL');

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/ws/rest/v1/form/21f010ce-4876-32ec-8844-27dfedc6705a?v=custom:'),
    );
    expect(form).toMatchObject({
      uuid: '21f010ce-4876-32ec-8844-27dfedc6705a',
      name: 'CRED-006-EVALUACIÓN NUTRICIONAL',
      published: true,
      retired: false,
    });
  });

  it('resolves a configured form name to the published OpenMRS form', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'retired-form',
            name: 'CRED-007-CONSEJERÍA ALIMENTARIA',
            display: 'CRED-007-CONSEJERÍA ALIMENTARIA',
            published: true,
            retired: true,
          },
          {
            uuid: '1fa86795-3d84-304a-ac9e-320a39b69ca7',
            name: 'CRED-007-CONSEJERÍA ALIMENTARIA',
            display: 'CRED-007-CONSEJERÍA ALIMENTARIA',
            published: true,
            retired: false,
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const form = await resolveCREDForm('CRED-007-CONSEJERÍA ALIMENTARIA', 'Consejería alimentaria');
    const calledUrl = mockOpenmrsFetch.mock.calls[0][0] as string;

    expect(decodeURIComponent(calledUrl).replace(/\+/g, ' ')).toContain('q=CRED-007-CONSEJERÍA ALIMENTARIA');
    expect(form.uuid).toBe('1fa86795-3d84-304a-ac9e-320a39b69ca7');
  });
});
