import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ConfigObject } from '../config-schema';
import StickyNoteModal from './sticky-note.modal';
import { createStickyNote, updateStickyNote } from './sticky-note.resource';
import { mockPatientUuid, mockStickyNote } from './sticky-note.test-utils';

vi.mock('./sticky-note.resource', () => ({
  createStickyNote: vi.fn(),
  updateStickyNote: vi.fn(),
}));

vi.mock('./utils', () => ({
  decodeHtmlEntities: (text: string) => text,
}));

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockCreateStickyNote = vi.mocked(createStickyNote);
const mockUpdateStickyNote = vi.mocked(updateStickyNote);

describe('StickyNoteModal', () => {
  const patientUuid = mockPatientUuid;
  const defaultProps = {
    close: vi.fn(),
    mutate: vi.fn(),
    patientUuid,
  };

  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      stickyNoteConceptUuid: 'concept-uuid',
    } as ConfigObject);
  });

  it('renders an empty create form by default', () => {
    render(<StickyNoteModal {...defaultProps} />);

    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '300');
    expect(screen.getByText('0/300')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('does not accept more than 300 characters', async () => {
    const user = userEvent.setup();
    render(<StickyNoteModal {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'a'.repeat(301));

    expect(textarea).toHaveValue('a'.repeat(300));
    expect(screen.getByText('300/300')).toBeInTheDocument();
  });

  it('keeps Save disabled when the input is only whitespace', async () => {
    const user = userEvent.setup();
    render(<StickyNoteModal {...defaultProps} />);

    await user.type(screen.getByRole('textbox'), '   ');

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('keeps Save disabled in edit mode when the value is cleared to whitespace', async () => {
    const user = userEvent.setup();
    render(<StickyNoteModal {...defaultProps} existingNote={mockStickyNote} />);

    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, '   ');

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('creates a new sticky note and shows a success snackbar', async () => {
    const user = userEvent.setup();
    mockCreateStickyNote.mockResolvedValue({} as Awaited<ReturnType<typeof createStickyNote>>);

    render(<StickyNoteModal {...defaultProps} />);

    await user.type(screen.getByRole('textbox'), 'New note');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(mockCreateStickyNote).toHaveBeenCalledWith(patientUuid, 'New note', 'concept-uuid');
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    expect(defaultProps.close).toHaveBeenCalled();
  });

  it('prefills the textarea in edit mode and updates on save', async () => {
    const user = userEvent.setup();
    mockUpdateStickyNote.mockResolvedValue({} as Awaited<ReturnType<typeof updateStickyNote>>);

    render(<StickyNoteModal {...defaultProps} existingNote={mockStickyNote} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue(mockStickyNote.value);

    await user.clear(textarea);
    await user.type(textarea, 'Updated note');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(mockUpdateStickyNote).toHaveBeenCalledWith(mockStickyNote.uuid, 'Updated note');
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('disables Save when the edit leaves the value unchanged', () => {
    render(<StickyNoteModal {...defaultProps} existingNote={mockStickyNote} />);

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('shows an error snackbar when the save fails', async () => {
    const user = userEvent.setup();
    mockCreateStickyNote.mockRejectedValue(new Error('Server error'));

    render(<StickyNoteModal {...defaultProps} />);

    await user.type(screen.getByRole('textbox'), 'New note');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });
});
