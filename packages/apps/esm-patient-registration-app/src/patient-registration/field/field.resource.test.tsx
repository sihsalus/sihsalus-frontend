import { showSnackbar } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import useSWRImmutable from 'swr/immutable';

import { useConceptAnswers } from './field.resource';

vi.mock('swr/immutable', () => ({
  default: vi.fn(),
}));

const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseSWRImmutable = vi.mocked(useSWRImmutable);

describe('useConceptAnswers', () => {
  it('does not show a global error for a forbidden concept response', () => {
    mockUseSWRImmutable.mockReturnValue({
      data: undefined,
      error: Object.assign(new Error('Forbidden'), { response: { status: 403 } }),
      isLoading: false,
    } as ReturnType<typeof useSWRImmutable>);

    const { result } = renderHook(() => useConceptAnswers('concept-uuid'));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toEqual(expect.objectContaining({ message: 'Forbidden' }));
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('shows one global error for other concept request failures', async () => {
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
      subtitle: 'Server error',
      kind: 'error',
    });
  });
});
