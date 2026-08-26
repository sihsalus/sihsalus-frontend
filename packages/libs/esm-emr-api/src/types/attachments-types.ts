export interface UploadedFile {
  file?: File;
  base64Content: string;
  fileName: string;
  fileType: string;
  fileDescription: string;
  status?: 'uploading' | 'complete';
  capturedFromWebcam?: boolean;
}

/**
 * Optional clinical context used by the attachments backend to associate an
 * uploaded document with an existing encounter and form field.
 */
export interface AttachmentUploadContext {
  encounterUuid: string;
  formFieldNamespace: string;
  formFieldPath: string;
}

export interface Attachment {
  id: string;
  src: string;
  filename: string;
  dateTime: string;
  bytesMimeType: string;
  bytesContentFamily: string;
  description?: string;
}

export interface AttachmentResponse {
  bytesContentFamily: string;
  bytesMimeType: string;
  comment: string;
  dateTime: string;
  uuid: string;
  filename?: string;
}
