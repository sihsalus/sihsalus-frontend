import { openmrsFetch } from '@openmrs/esm-framework';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MissingCatalogItem from './missing-catalog-item.component';

async function openDraft() {
  const user = userEvent.setup();
  render(<MissingCatalogItem />);
  await user.click(screen.getByRole('button', { name: 'Cannot find a medication or supply?' }));
  return user;
}

describe('Missing catalog item draft', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(openmrsFetch).mockClear();
  });

  it('does not offer copying a blank or whitespace-only description', async () => {
    const user = await openDraft();
    const copyButton = screen.getByRole('button', { name: 'Copy draft for Pharmacy' });
    expect(copyButton).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Item to request' }), '   ');
    expect(copyButton).toBeDisabled();
    expect(screen.queryByRole('textbox', { name: 'Draft for review (not sent)' })).not.toBeInTheDocument();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('copies only an explicitly reviewed draft with a non-prescription label, without persistence', async () => {
    const user = await openDraft();
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const writeStorage = vi.spyOn(Storage.prototype, 'setItem');
    const input = screen.getByRole('textbox', { name: 'Item to request' });

    expect(input).toHaveAttribute('maxlength', '1000');
    await user.type(input, '  Synthetic supply, presentation for review  ');
    const expected = 'Catalog review request — NOT a prescription\n\nSynthetic supply, presentation for review';
    expect(screen.getByRole('textbox', { name: 'Draft for review (not sent)' })).toHaveValue(expected);
    expect(copy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Copy draft for Pharmacy' }));
    expect(copy).toHaveBeenCalledExactlyOnceWith(expected);
    expect(screen.getByRole('status')).toHaveTextContent('Draft copied. It has not been sent to Pharmacy.');
    expect(openmrsFetch).not.toHaveBeenCalled();
    expect(writeStorage).not.toHaveBeenCalled();

    await user.type(input, ' revised');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('preserves the preview for manual copying when the clipboard denies access', async () => {
    const user = await openDraft();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('sensitive browser error detail'));
    await user.type(screen.getByRole('textbox', { name: 'Item to request' }), 'Synthetic catalog item');
    await user.click(screen.getByRole('button', { name: 'Copy draft for Pharmacy' }));

    expect(screen.getByRole('status')).toHaveTextContent('Select and copy the preview manually.');
    expect(screen.getByRole('textbox', { name: 'Draft for review (not sent)' })).toHaveValue(
      'Catalog review request — NOT a prescription\n\nSynthetic catalog item',
    );
    expect(screen.queryByText('sensitive browser error detail')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy draft for Pharmacy' })).toBeEnabled();
  });

  it('degrades to manual copying when the clipboard API is unavailable', async () => {
    const user = await openDraft();
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(undefined);
    await user.type(screen.getByRole('textbox', { name: 'Item to request' }), 'Synthetic catalog item');
    await user.click(screen.getByRole('button', { name: 'Copy draft for Pharmacy' }));

    expect(screen.getByRole('status')).toHaveTextContent('Select and copy the preview manually.');
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('prevents repeated copying or changing the draft while the clipboard is pending', async () => {
    const user = await openDraft();
    let resolveCopy: () => void;
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve;
        }),
    );
    const input = screen.getByRole('textbox', { name: 'Item to request' });
    await user.type(input, 'Synthetic item');
    const button = screen.getByRole('button', { name: 'Copy draft for Pharmacy' });
    await user.dblClick(button);

    expect(copy).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(input).toHaveAttribute('readonly');
    await act(async () => resolveCopy());
    expect(button).toBeEnabled();
  });
});
