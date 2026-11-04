import { logError, showSnackbar } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import useSWRImmutable from 'swr/immutable';

import { useConceptAnswers } from './field.resource';

vi.mock('swr/immutable', () => ({
  default: vi.fn(),
}));

const mockLogError = vi.mocked(logError);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseSWRImmutable = vi.mocked(useSWRImmutable);

describe('useConceptAnswers', () => {
  beforeEach(() => {
    mockLogError.mockClear();
    mockShowSnackbar.mockClear();
  });

  const mapping = (code: string, source = 'MINSA-ETNIAS', retired = false, type = 'SAME-AS') => ({
    conceptMapType: { name: type },
    conceptReferenceTerm: { code, retired, conceptSource: { name: source, retired: false } },
  });

  function response(answers: Array<unknown>, setMembers: Array<unknown> = []) {
    mockUseSWRImmutable.mockReturnValue({
      data: { data: { uuid: 'ethnicity-question', answers, setMembers } },
      error: undefined,
      isLoading: false,
    } as ReturnType<typeof useSWRImmutable>);
  }

  it('loads native names and exact active SAME-AS codes only from the configured source', () => {
    response([
      {
        uuid: 'aimara-clinical-uuid',
        display: 'Aimara',
        names: [
          { name: 'Aymara', voided: false },
          { name: 'Voided alias', voided: true },
        ],
        mappings: [
          mapping('2'),
          mapping('2'),
          mapping('4', 'OTHER'),
          mapping('9', 'MINSA-ETNIAS', true),
          mapping('7', 'MINSA-ETNIAS', false, 'NARROWER-THAN'),
        ],
      },
    ]);
    const { result } = renderHook(() => useConceptAnswers('ethnicity-question', 'MINSA-ETNIAS'));
    expect(result.current.data).toEqual([
      expect.objectContaining({
        uuid: 'aimara-clinical-uuid',
        code: '2',
        synonyms: ['Aymara'],
        codeMappingStatus: 'mapped',
      }),
    ]);
    const url = mockUseSWRImmutable.mock.calls.at(-1)?.[0];
    expect(url).toContain('/concept/ethnicity-question?');
    expect(url).toContain('names:(name,voided)');
    expect(url).toContain('mappings:(conceptMapType:(name),conceptReferenceTerm:');
  });

  it('preserves leading zeroes and never substitutes clinical identities for missing official codes', () => {
    response([
      { uuid: 'mapped', display: 'Mapped', mappings: [mapping('02')] },
      { uuid: 'internal-id-4', display: 'Unmapped', mappings: [mapping('4', 'OTHER')] },
    ]);
    const { result } = renderHook(() => useConceptAnswers('ethnicity-question', 'MINSA-ETNIAS'));
    expect(result.current.data[0]).toMatchObject({ code: '02', codeMappingStatus: 'mapped' });
    expect(result.current.data[1]).toMatchObject({ uuid: 'internal-id-4', codeMappingStatus: 'unmapped' });
    expect(result.current.data[1].code).toBeUndefined();
  });

  it('does not use retired or incompletely described sources as official codes', () => {
    const retiredSource = mapping('2');
    retiredSource.conceptReferenceTerm.conceptSource.retired = true;
    response([
      { uuid: 'retired-source', display: 'Retired source', mappings: [retiredSource] },
      {
        uuid: 'missing-source',
        display: 'Missing source',
        mappings: [{ conceptMapType: { name: 'SAME-AS' }, conceptReferenceTerm: { code: '2', retired: false } }],
      },
    ]);
    const { result } = renderHook(() => useConceptAnswers('ethnicity-question', 'MINSA-ETNIAS'));
    expect(
      result.current.data.every(
        ({ code, codeMappingStatus }) => code === undefined && codeMappingStatus === 'unmapped',
      ),
    ).toBe(true);
  });

  it('marks multiple different official codes as ambiguous instead of choosing one', () => {
    response([{ uuid: 'ambiguous', display: 'Ambiguous', mappings: [mapping('2'), mapping('02')] }]);
    const { result } = renderHook(() => useConceptAnswers('ethnicity-question', 'MINSA-ETNIAS'));
    expect(result.current.data[0]).toMatchObject({ uuid: 'ambiguous', codeMappingStatus: 'ambiguous' });
    expect(result.current.data[0].code).toBeUndefined();
  });

  it('keeps set-member fallback and the original small projection for ordinary coded fields', () => {
    const member = { uuid: 'ordinary', display: 'Ordinary' };
    response([], [member]);
    const { result } = renderHook(() => useConceptAnswers('ordinary-set'));
    expect(result.current.data).toEqual([member]);
    expect(mockUseSWRImmutable.mock.calls.at(-1)?.[0]).not.toContain('mappings:');
  });

  it('does not show a global error for a forbidden concept response', () => {
    const error = Object.assign(new Error('Forbidden'), { response: { status: 403 } });
    mockUseSWRImmutable.mockReturnValue({
      data: undefined,
      error,
      isLoading: false,
    } as ReturnType<typeof useSWRImmutable>);

    const { result } = renderHook(() => useConceptAnswers('concept-uuid'));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toEqual(expect.objectContaining({ message: 'Forbidden' }));
    expect(mockLogError).toHaveBeenCalledWith(error, 'Patient registration concept request failed');
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('logs concept request failures and shows a generic localized error', async () => {
    const error = new Error('Server error');
    mockUseSWRImmutable.mockReturnValue({
      data: undefined,
      error,
      isLoading: false,
    } as ReturnType<typeof useSWRImmutable>);

    renderHook(() => useConceptAnswers('concept-uuid'));

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    });
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      title: 'Error',
      subtitle: 'Try refreshing the page or contact your system administrator',
      kind: 'error',
    });
    expect(mockLogError).toHaveBeenCalledWith(error, 'Patient registration concept request failed');
  });
});
