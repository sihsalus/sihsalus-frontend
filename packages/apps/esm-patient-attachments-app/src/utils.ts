import { type Attachment, type AttachmentResponse, attachmentUrl, formatDate } from '@openmrs/esm-framework';

export function readFileAsString(file: File) {
  return new Promise<string>((resolve, reject) => {
    const rejectRead = () => reject(new Error('Attachment file could not be read.'));
    if (file) {
      const reader = new FileReader();

      reader.addEventListener('load', () => {
        if (typeof reader.result === 'string' && reader.result.length > 0) {
          resolve(reader.result);
        } else {
          rejectRead();
        }
      });

      reader.addEventListener('error', rejectRead);
      reader.addEventListener('abort', rejectRead);

      reader.readAsDataURL(file);
    } else {
      rejectRead();
    }
  });
}

export interface AttachmentTableData extends Attachment {
  dateTimeValue: string;
}

export function createGalleryEntry(data: AttachmentResponse): AttachmentTableData {
  return {
    id: data.uuid,
    src: `${window.openmrsBase}${attachmentUrl}/${data.uuid}/bytes`,
    filename: data.filename.replace(/\.[^\\/.]+$/, ''),
    description: data.comment,
    dateTimeValue: data.dateTime,
    dateTime: formatDate(new Date(data.dateTime), {
      mode: 'wide',
    }),
    bytesMimeType: data.bytesMimeType,
    bytesContentFamily: data.bytesContentFamily,
  };
}
