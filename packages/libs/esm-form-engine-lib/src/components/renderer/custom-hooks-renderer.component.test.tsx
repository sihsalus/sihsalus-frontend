import { render, waitFor } from '@testing-library/react';

import { CustomHooksRenderer } from './custom-hooks-renderer.component';

describe('CustomHooksRenderer', () => {
  it('propagates a dependency error without updating the processor context', async () => {
    const forbiddenError = Object.assign(new Error('Forbidden'), {
      status: 403,
    });
    const onError = vi.fn();
    const setContext = vi.fn();
    const setIsLoadingCustomHooks = vi.fn();
    const updateContext = vi.fn();
    const useCustomHooks = vi.fn(() => ({
      data: null,
      error: forbiddenError,
      isLoading: false,
      updateContext,
    }));

    render(
      <CustomHooksRenderer
        context={{} as never}
        onError={onError}
        setContext={setContext}
        setIsLoadingCustomHooks={setIsLoadingCustomHooks}
        useCustomHooks={useCustomHooks}
      />,
    );

    await waitFor(() => expect(onError).toHaveBeenCalledWith(forbiddenError));
    expect(setIsLoadingCustomHooks).toHaveBeenCalledWith(false);
    expect(updateContext).not.toHaveBeenCalled();
  });
});
