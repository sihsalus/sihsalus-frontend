import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useEffect, useRef } from 'react';

import useArrowNavigation from './useArrowNavigation';

function ArrowNavigationHarness({ onEnter = vi.fn(), onReset = vi.fn(), resetKey = 'initial' }) {
  const resultsRef = useRef<HTMLDivElement>(null);
  const isEventFromFocusedResult = useCallback((event: React.KeyboardEvent<HTMLElement>, index: number) => {
    return Boolean(resultsRef.current?.children.item(index)?.contains(event.target as Node));
  }, []);
  const { focusedResult, handleKeyPress, resetFocusedResult } = useArrowNavigation(2, onEnter, onReset, {
    isEventFromFocusedResult,
    resetKey,
  });

  useEffect(() => {
    if (focusedResult > -1) {
      (resultsRef.current?.children.item(focusedResult) as HTMLElement | null)?.focus();
    }
  }, [focusedResult]);

  return (
    <>
      <div aria-label="Patient search results" data-testid="search" onKeyDown={handleKeyPress} role="group">
        <input aria-label="Patient search" onFocus={resetFocusedResult} />
        <button type="button">Search action</button>
        <div ref={resultsRef}>
          <button type="button">First patient</button>
          <button type="button">Second patient</button>
        </div>
      </div>
      <button type="button">Outside action</button>
      <output aria-label="Focused result">{focusedResult}</output>
    </>
  );
}

describe('useArrowNavigation', () => {
  it('selects the focused result with Enter inside the patient search', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    render(<ArrowNavigationHarness onEnter={onEnter} />);

    await user.click(screen.getByRole('textbox', { name: 'Patient search' }));
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onEnter).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }), 0);
  });

  it('does not handle arrow or Enter keys outside the patient search', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    render(<ArrowNavigationHarness onEnter={onEnter} />);

    await user.click(screen.getByRole('button', { name: 'Outside action' }));
    await user.keyboard('{ArrowDown}{Enter}');

    expect(screen.getByRole('status', { name: 'Focused result' })).toHaveTextContent('-1');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('does not select a stale focused index when Enter originates from another control', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    render(<ArrowNavigationHarness onEnter={onEnter} />);

    await user.click(screen.getByRole('textbox', { name: 'Patient search' }));
    await user.keyboard('{ArrowDown}');
    await user.click(screen.getByRole('button', { name: 'Search action' }));
    await user.keyboard('{Enter}');

    expect(screen.getByRole('status', { name: 'Focused result' })).toHaveTextContent('0');
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('resets the focused index when the search query changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ArrowNavigationHarness resetKey="Rosa" />);

    await user.click(screen.getByRole('textbox', { name: 'Patient search' }));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('status', { name: 'Focused result' })).toHaveTextContent('0');

    rerender(<ArrowNavigationHarness resetKey="Maria" />);

    await waitFor(() => expect(screen.getByRole('status', { name: 'Focused result' })).toHaveTextContent('-1'));
  });
});
