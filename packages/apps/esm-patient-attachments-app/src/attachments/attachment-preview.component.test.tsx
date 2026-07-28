import { type Attachment } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import AttachmentPreview from './attachment-preview.component';

it('sandboxes PDF previews and suppresses referrer information', () => {
  const attachment = {
    bytesContentFamily: 'PDF',
    description: '',
    filename: 'clinical-document.pdf',
    id: 'attachment-uuid',
    src: 'data:application/pdf;base64,JVBERi0xLjQK',
  } as Attachment;

  render(<AttachmentPreview attachmentToPreview={attachment} onClosePreview={vi.fn()} onDeleteAttachment={vi.fn()} />);

  const preview = screen.getByTitle('PDFViewer');
  expect(preview.getAttribute('sandbox')).toBe('');
  expect(preview).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(preview).toHaveAttribute('src', attachment.src);
});
