import { describe, expect, it } from 'vitest';
import { isAllowedAttachmentFileName } from './media-uploader.component';

describe('isAllowedAttachmentFileName', () => {
  const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

  it.each([
    'document.PDF',
    'photo.jpg',
    'scan.jpeg',
    'image.png',
  ])('accepts an explicitly allowed extension: %s', (fileName) => {
    expect(isAllowedAttachmentFileName(fileName, allowedExtensions)).toBe(true);
  });

  it.each([
    'pdf',
    '.pdf',
    'document',
    'document.pdf.exe',
    'document.html',
    'document.pdf.',
  ])('rejects missing, ambiguous, or disallowed extensions: %s', (fileName) => {
    expect(isAllowedAttachmentFileName(fileName, allowedExtensions)).toBe(false);
  });

  it('fails closed when no extensions are configured', () => {
    expect(isAllowedAttachmentFileName('document.pdf', [])).toBe(false);
  });
});
