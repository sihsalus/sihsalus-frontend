import type { FormSchema } from '@sihsalus/esm-form-engine-lib';
import { renderHook } from '@testing-library/react';
import type { SWRResponse } from 'swr';

import useFormSchema from './useFormSchema';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

vi.mock('swr', async () => {
  const actual = await vi.importActual('swr');
  return {
    ...actual,
    __esModule: true,
    default: vi.fn(),
  };
});

import useSWR from 'swr';

const mockUseSWR = vi.mocked(useSWR);
type FormSchemaApiResponse = { data: FormSchema };

function createSwrResponse<T>(overrides: Partial<SWRResponse<T, Error>>): SWRResponse<T, Error> {
  return {
    data: undefined,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
    ...overrides,
  } as SWRResponse<T, Error>;
}

describe('useFormSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially', () => {
    mockUseSWR.mockReturnValue(createSwrResponse<FormSchemaApiResponse>({ isLoading: true }));

    const { result } = renderHook(() => useFormSchema('form-uuid'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.schema).toBeUndefined();
  });

  it('returns schema with encounterType UUID extracted', () => {
    mockUseSWR.mockReturnValue(
      createSwrResponse<FormSchemaApiResponse>({
        data: {
          data: {
            uuid: 'form-uuid',
            name: 'Test Form',
            encounterType: { uuid: 'enc-type-uuid', display: 'Visit Note' },
            pages: [],
          },
        },
      }),
    );

    const { result } = renderHook(() => useFormSchema('form-uuid'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.schema).toBeDefined();
    expect(result.current.schema.encounterType).toBe('enc-type-uuid');
  });

  it('normalizes legacy concept UUIDs in nested schema questions', () => {
    mockUseSWR.mockReturnValue(
      createSwrResponse<FormSchemaApiResponse>({
        data: {
          data: {
            uuid: 'form-uuid',
            name: 'Test Form',
            encounterType: { uuid: 'enc-type-uuid', display: 'Visit Note' },
            pages: [
              {
                label: 'Page 1',
                sections: [
                  {
                    label: 'Section 1',
                    questions: [
                      {
                        id: 'chief-complaint',
                        type: 'obs',
                        label: 'Chief complaint',
                        questionOptions: {
                          rendering: 'text',
                          concept: '5219AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                        },
                      },
                      {
                        id: 'subjective',
                        type: 'obs',
                        label: 'Subjective',
                        questionOptions: {
                          rendering: 'text',
                          concept: '160531AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                        },
                      },
                      {
                        id: 'plan',
                        type: 'obs',
                        label: 'Plan',
                        questionOptions: {
                          rendering: 'text',
                          concept: '159615AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                        },
                      },
                      {
                        id: 'lab-orders',
                        type: 'obs',
                        label: 'Lab orders',
                        questionOptions: {
                          rendering: 'text',
                          concept: '1271AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                        },
                      },
                      {
                        id: 'procedures',
                        type: 'obs',
                        label: 'Procedures',
                        questionOptions: {
                          rendering: 'text',
                          concept: '1651AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                        },
                      },
                      {
                        id: 'prescriptions',
                        type: 'obs',
                        label: 'Prescriptions',
                        questionOptions: {
                          rendering: 'text',
                          concept: '1282AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                        },
                      },
                      {
                        id: 'referral',
                        type: 'obs',
                        label: 'Referral',
                        questionOptions: {
                          rendering: 'text',
                          concept: '1272AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      }),
    );

    const { result } = renderHook(() => useFormSchema('form-uuid'));
    const normalizedSchema = result.current.schema as FormSchema & {
      pages: Array<{
        sections: Array<{
          questions: Array<{
            questionOptions: {
              concept: string;
            };
          }>;
        }>;
      }>;
    };

    expect(normalizedSchema.pages[0].sections[0].questions[0].questionOptions.concept).toBe(
      '71b58cff-879b-4358-98d5-2165434d4324',
    );
    expect(normalizedSchema.pages[0].sections[0].questions[1].questionOptions.concept).toBe(
      '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(normalizedSchema.pages[0].sections[0].questions[2].questionOptions.concept).toBe(
      'c4010006-0000-4000-8000-000000000006',
    );
    expect(normalizedSchema.pages[0].sections[0].questions[3].questionOptions.concept).toBe(
      '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(normalizedSchema.pages[0].sections[0].questions[4].questionOptions.concept).toBe(
      '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(normalizedSchema.pages[0].sections[0].questions[5].questionOptions.concept).toBe(
      '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(normalizedSchema.pages[0].sections[0].questions[6].questionOptions.concept).toBe(
      '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
  });

  it('returns error on fetch failure', () => {
    const testError = new Error('Network error');
    mockUseSWR.mockReturnValue(createSwrResponse<FormSchemaApiResponse>({ error: testError }));

    const { result } = renderHook(() => useFormSchema('form-uuid'));
    expect(result.current.error).toBe(testError);
  });

  it('passes null URL when formUuid is empty', () => {
    mockUseSWR.mockReturnValue(createSwrResponse<FormSchemaApiResponse>({}));

    renderHook(() => useFormSchema(''));
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function));
  });
});
