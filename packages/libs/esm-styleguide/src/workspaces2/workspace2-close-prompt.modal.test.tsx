import { getCoreTranslation } from '@openmrs/esm-translations';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Workspace2ClosePromptModal from './workspace2-close-prompt.modal';

describe('Workspace2ClosePromptModal', () => {
  it('uses a localized description for the destructive action', () => {
    render(
      <Workspace2ClosePromptModal
        affectedWorkspaceTitles={['Record procedure']}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const discardButton = screen.getByRole('button', { name: 'Danger: Discard changes' });

    expect(getCoreTranslation).toHaveBeenCalledWith('danger', 'Danger');
    expect(discardButton).toHaveAccessibleDescription('Danger:');
    expect(discardButton).toHaveTextContent('Danger: Discard changes');
  });
});
