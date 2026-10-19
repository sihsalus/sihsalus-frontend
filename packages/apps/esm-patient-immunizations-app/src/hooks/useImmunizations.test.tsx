import { getDefaultsFromConfigSchema, useConfig, useFhirFetchAll, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { configSchema, type ImmunizationConfigObject } from '../config-schema';
import { useImmunizations } from './useImmunizations';

const config = getDefaultsFromConfigSchema(configSchema) as ImmunizationConfigObject;

describe('immunization history sources', () => {
  beforeEach(() => {
    vi.mocked(useConfig).mockReturnValue(config);
    vi.mocked(useOpenmrsFetchAll).mockReturnValue({ data: [], error: undefined, mutate: vi.fn() } as never);
    vi.mocked(useFhirFetchAll).mockReturnValue({ data: [], error: undefined, mutate: vi.fn() } as never);
  });

  it('queries encounters across Form versions and reads the canonical non-administration state', () => {
    vi.mocked(useOpenmrsFetchAll).mockReturnValue({
      data: [
        {
          uuid: 'historical-encounter',
          encounterDatetime: '2026-01-02',
          obs: [
            {
              concept: { uuid: 'f9840000-0000-4000-8000-000000000984' },
              value: { uuid: 'vaccine', display: 'Synthetic vaccine' },
            },
            { concept: { uuid: 'af2ec074-87e5-4651-8e7f-5578bd111cf9' }, value: 'not-done' },
            { concept: { uuid: '9dab3f0d-b9da-45c3-beea-5ec3182e53be' }, value: 'Diferida' },
          ],
        },
      ],
      mutate: vi.fn(),
    } as never);
    const { result } = renderHook(() => useImmunizations('synthetic-patient'));
    const query = vi.mocked(useOpenmrsFetchAll).mock.calls.at(-1)[0] as string;
    expect(query).toContain('encounterType=29c02aff-9a93-46c9-bf6f-48b552fcb1fa');
    expect(query).not.toContain('&form=');
    expect(result.current.data[0].existingDoses[0]).toMatchObject({ status: 'not-done', statusReason: 'Diferida' });
  });

  it('surfaces duplicate canonical observations as an error instead of choosing a value silently', () => {
    vi.mocked(useOpenmrsFetchAll).mockReturnValue({
      data: [
        {
          uuid: 'ambiguous-encounter',
          obs: [
            { uuid: 'a', concept: { uuid: 'f9840000-0000-4000-8000-000000000984' }, value: 'product-a' },
            { uuid: 'b', concept: { uuid: 'f9840000-0000-4000-8000-000000000984' }, value: 'product-b' },
          ],
        },
      ],
      mutate: vi.fn(),
    } as never);
    const { result } = renderHook(() => useImmunizations('synthetic-patient'));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it.each([
    [{ status: 501 }, false],
    [{ status: 501, responseBody: { issue: [{ diagnostics: "No concept mapped to 'CIEL:1421'" }] } }, true],
    [{ status: 422 }, true],
    [{ status: 403 }, true],
    [{ message: 'Not implemented 501' }, true],
  ])('uses REST only for a confirmed unsupported FHIR service: %j', (error, remainsError) => {
    vi.mocked(useFhirFetchAll).mockReturnValue({ data: undefined, error, mutate: vi.fn() } as never);
    const { result } = renderHook(() => useImmunizations('synthetic-patient'));
    expect(Boolean(result.current.error)).toBe(remainsError);
  });
});
