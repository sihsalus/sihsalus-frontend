import { mockSubscription } from '@mocks/openconceptlab.mock';
import { type FetchResponse, openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSwr } from '@tools/test-helpers';

import Import from './import.component';
import { startImportWithSubscription } from './import.resource';

const mockOpenmrsFetch = openmrsFetch as vi.Mock;
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockStartImportWithSubscription = vi.mocked(startImportWithSubscription);

vi.mock('./import.resource', async () => {
  const originalModule = await vi.importActual<Record<string, unknown>>('./import.resource');

  return {
    ...originalModule,
    startImportWithSubscription: vi.fn(),
    startImportWithFile: vi.fn(),
  };
});

describe('Import component', () => {
  it('renders the form elements', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: [] } });
    renderWithSwr(<Import />);
    await waitForLoadingToFinish();

    expect(screen.getByText('Import Concepts')).toBeVisible();
    expect(screen.getByText('Import from Subscription')).toBeVisible();

    expect(screen.getByText('Import from file (Offline)')).toBeVisible();
    expect(screen.getByText('Import from file')).toBeEnabled();
    expect(screen.queryByText('File Added')).not.toBeInTheDocument();
  });

  it('renders correctly when there is no subscription', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: [] } });
    renderWithSwr(<Import />);
    await waitForLoadingToFinish();

    expect(screen.getByText('Import from Subscription')).toBeDisabled();
    expect(screen.getByText('Import from file')).toBeEnabled();
  });

  it('renders correctly when when a subscription exists', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: [mockSubscription] } });
    renderWithSwr(<Import />);
    await waitForLoadingToFinish();

    await waitFor(() => expect(screen.getByText('Import from Subscription')).toBeEnabled(), { timeout: 2000 });
    expect(screen.getByText('Import from file')).toBeEnabled();
  });

  it('allows starting an import using the subscription', async () => {
    const user = userEvent.setup();
    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: [mockSubscription] } });
    renderWithSwr(<Import />);
    await waitForLoadingToFinish();

    mockStartImportWithSubscription.mockResolvedValue({ status: 201 } as unknown as FetchResponse);

    await user.click(screen.getByText('Import from Subscription'));

    expect(mockStartImportWithSubscription).toHaveBeenCalledWith(expect.any(AbortController));
    expect(mockStartImportWithSubscription).toHaveBeenCalledTimes(1);

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        subtitle: 'Import started successfully',
        kind: 'success',
        title: 'Import started',
      }),
    );
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
  });
});

function waitForLoadingToFinish() {
  return waitFor(() => {
    expect(screen.getByText('Import Concepts')).toBeVisible();
  });
}
