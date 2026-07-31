import { act, render, screen } from '@testing-library/react';

import HtmlFormEntryWrapper from './html-form-entry-wrapper.component';

describe('HtmlFormEntryWrapper', () => {
  it('accepts the close message only from its own same-origin iframe', () => {
    const closeWorkspaceWithSavedChanges = vi.fn();
    render(<HtmlFormEntryWrapper closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges} src="about:blank" />);

    const iframe = screen.getByTitle('HTML form entry') as HTMLIFrameElement;

    act(() => {
      globalThis.dispatchEvent(
        new MessageEvent('message', {
          data: 'close-workspace',
          origin: 'https://untrusted.example',
          source: iframe.contentWindow,
        }),
      );
      globalThis.dispatchEvent(
        new MessageEvent('message', {
          data: 'close-workspace',
          origin: globalThis.location.origin,
          source: null,
        }),
      );
    });

    expect(closeWorkspaceWithSavedChanges).not.toHaveBeenCalled();

    act(() => {
      globalThis.dispatchEvent(
        new MessageEvent('message', {
          data: 'close-workspace',
          origin: globalThis.location.origin,
          source: iframe.contentWindow,
        }),
      );
    });

    expect(closeWorkspaceWithSavedChanges).toHaveBeenCalledOnce();
    expect(iframe).toHaveAttribute('referrerpolicy', 'same-origin');
  });
});
