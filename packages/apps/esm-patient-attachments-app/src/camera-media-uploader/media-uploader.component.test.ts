import { describe, expect, it } from 'vitest';
import { getEffectiveMaxFileSizeMb, isAllowedAttachmentFileName } from './media-uploader.component';

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

describe('getEffectiveMaxFileSizeMb', () => {
  it('uses a positive workflow-specific override', () => {
    expect(getEffectiveMaxFileSizeMb(1, 5)).toBe(5);
  });

  it.each([undefined, 0, -1, Number.NaN])('falls back to configuration for an invalid override: %s', (override) => {
    expect(getEffectiveMaxFileSizeMb(1, override)).toBe(1);
  });
});
