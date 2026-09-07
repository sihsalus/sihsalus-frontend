import { type FetchResponse, showSnackbar, type UploadedFile, useConfig } from '@openmrs/esm-framework';
import { useAllowedFileExtensions } from '@openmrs/esm-patient-common-lib';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileAsString } from '../utils';
import CameraMediaUploaderContext from './camera-media-uploader-context.resources';
import CameraMediaUploaderModal from './camera-media-uploader.component';
import UploadStatusComponent from './upload-status.component';

vi.mock('../utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils')>()),
  readFileAsString: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  useAllowedFileExtensions: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const images = ['first.png', 'second.png', 'third.png'].map(
  (name) => new File(['synthetic image'], name, { type: 'image/png' }),
);
const batch: Array<UploadedFile> = images.map((file) => ({
  base64Content: 'data:image/png;base64,c3ludGhldGlj',
  file,
  fileName: file.name,
  fileDescription: '',
  fileType: 'image',
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({ maxFileSize: 1 });
  vi.mocked(useAllowedFileExtensions).mockReturnValue({
    allowedFileExtensions: ['png', 'pdf'],
    error: undefined,
    isConfigured: true,
    isLoading: false,
  });
  vi.mocked(readFileAsString).mockResolvedValue('data:image/png;base64,c3ludGhldGlj');
});

function renderPicker(multipleFiles = true) {
  const saveFile = vi.fn().mockResolvedValue({});
  const onCompletion = vi.fn();
  const view = render(
    <CameraMediaUploaderModal
      closeModal={vi.fn()}
      collectDescription
      multipleFiles={multipleFiles}
      onCompletion={onCompletion}
      saveFile={saveFile}
    />,
  );
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error('Attachment file input was not rendered');
  }
  return { ...view, input, saveFile, onCompletion };
}

describe('selecting a batch of attachments', () => {
  it('waits for three image reads, preserves selection order, and uploads only after reviewing all three', async () => {
    const reads = images.map(() => deferred<string>());
    vi.mocked(readFileAsString).mockImplementation((file) => reads[images.indexOf(file)].promise);
    const user = userEvent.setup();
    const { input, saveFile, onCompletion } = renderPicker();

    expect(screen.getByText(/You can select several files together/)).toBeInTheDocument();
    fireEvent.change(input, { target: { files: images } });
    expect(input).toBeDisabled();
    await act(async () => reads[2].resolve('data:image/png;base64,dGhpcmQ='));
    await act(async () => reads[0].resolve('data:image/png;base64,Zmlyc3Q='));
    expect(screen.queryByRole('textbox', { name: 'Image name' })).not.toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
    await act(async () => reads[1].resolve('data:image/png;base64,c2Vjb25k'));

    for (let index = 0; index < images.length; index++) {
      expect(screen.getByText(`(File ${index + 1} of 3)`, { exact: false })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Image name' })).toHaveValue(images[index].name.replace('.png', ''));
      expect(saveFile).not.toHaveBeenCalled();
      await user.type(screen.getByRole('textbox', { name: 'Image description' }), `Synthetic description ${index + 1}`);
      await user.click(screen.getByRole('button', { name: 'Add attachment' }));
    }

    await waitFor(() => expect(onCompletion).toHaveBeenCalledTimes(1));
    expect(saveFile).toHaveBeenCalledTimes(3);
    expect(saveFile.mock.calls.map(([file]) => file.fileName)).toEqual(images.map((file) => file.name));
    expect(saveFile.mock.calls.map(([file]) => file.fileDescription)).toEqual([
      'Synthetic description 1',
      'Synthetic description 2',
      'Synthetic description 3',
    ]);
  });

  it.each([
    [new File(['unsupported'], 'invalid.html', { type: 'text/html' }), 'Unsupported file type'],
    [new File(['unsupported'], 'extensionless'), 'Unsupported file type'],
    [
      new File([new Uint8Array(1024 * 1024 + 1)], 'large.png', {
        type: 'image/png',
      }),
      'File size limit exceeded',
    ],
  ])('rejects the whole selection when a file fails validation', async (invalidFile, errorTitle) => {
    const { input, saveFile } = renderPicker();
    fireEvent.change(input, { target: { files: [...images, invalidFile] } });
    expect(await screen.findByText(errorTitle)).toBeInTheDocument();
    expect(readFileAsString).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Image name' })).not.toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('shows a safe read failure without advancing a partial selection and allows corrected selection', async () => {
    vi.mocked(readFileAsString).mockRejectedValueOnce(new Error('private local path and technical detail'));
    const { input, saveFile } = renderPicker();
    fireEvent.change(input, { target: { files: images } });
    expect(await screen.findByText('Files could not be read')).toBeInTheDocument();
    expect(screen.queryByText(/private local path/)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Image name' })).not.toBeInTheDocument();
    expect(input).toBeEnabled();
    expect(saveFile).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [images[0]] } });
    expect(await screen.findByRole('textbox', { name: 'Image name' })).toHaveValue('first');
  });

  it('ignores another selection while the first batch is being read', async () => {
    const read = deferred<string>();
    vi.mocked(readFileAsString).mockReturnValue(read.promise);
    const { input } = renderPicker();
    fireEvent.change(input, { target: { files: images } });
    fireEvent.change(input, { target: { files: images } });
    expect(readFileAsString).toHaveBeenCalledTimes(3);
    await act(async () => read.resolve('data:image/png;base64,c3ludGhldGlj'));
    expect(screen.getByText('(File 1 of 3)', { exact: false })).toBeInTheDocument();
  });

  it('rejects multiple dropped PDFs when the consumer only permits one file, then accepts one PDF', async () => {
    const { container, input, saveFile } = renderPicker(false);
    const pdfs = ['first.pdf', 'second.pdf'].map(
      (name) => new File(['synthetic PDF'], name, { type: 'application/pdf' }),
    );
    expect(input.multiple).toBe(false);
    const dropTarget = container.querySelector('.cds--file__drop-container');
    if (!dropTarget) {
      throw new Error('Attachment drop target was not rendered');
    }
    fireEvent.drop(dropTarget, {
      dataTransfer: { files: pdfs, types: ['Files'] },
    });
    expect(await screen.findByText('Select one file at a time for this attachment.')).toBeInTheDocument();
    expect(readFileAsString).not.toHaveBeenCalled();
    expect(saveFile).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [pdfs[0]] } });
    expect(await screen.findByRole('textbox', { name: 'File name' })).toHaveValue('first');
    expect(readFileAsString).toHaveBeenCalledTimes(1);
  });

  it('does not reopen review when file reads finish after the picker is closed', async () => {
    const read = deferred<string>();
    vi.mocked(readFileAsString).mockReturnValue(read.promise);
    const { input, unmount, saveFile } = renderPicker();
    fireEvent.change(input, { target: { files: images } });
    unmount();
    await act(async () => read.resolve('data:image/png;base64,c3ludGhldGlj'));
    expect(screen.queryByRole('textbox', { name: 'Image name' })).not.toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
  });
});

describe('uploading a confirmed batch', () => {
  it('keeps background completion tied to the confirmed batch without displaying filenames after close', async () => {
    const upload = deferred<FetchResponse<unknown>>();
    const saveFile = vi.fn(() => upload.promise);
    const onCompletion = vi.fn();
    const { unmount } = render(
      <CameraMediaUploaderContext.Provider value={{ filesToUpload: batch, saveFile, onCompletion }}>
        <UploadStatusComponent />
      </CameraMediaUploaderContext.Provider>,
    );
    unmount();
    await act(async () => upload.resolve({} as FetchResponse<unknown>));
    expect(saveFile).toHaveBeenCalledTimes(3);
    expect(onCompletion).toHaveBeenCalledTimes(1);
    expect(showSnackbar).toHaveBeenCalledTimes(3);
    for (const [notification] of vi.mocked(showSnackbar).mock.calls) {
      expect(notification).toEqual({ title: 'Upload complete', kind: 'success', isLowContrast: true });
    }
  });

  it('uploads each file once under StrictMode and callback rerenders, waiting for every success', async () => {
    const uploads = images.map(() => deferred<FetchResponse<unknown>>());
    const saveFile = vi.fn((file: UploadedFile) => uploads[batch.indexOf(file)].promise);
    const onCompletion = vi.fn();
    const clearData = vi.fn();
    const ui = (save = saveFile, complete = onCompletion) => (
      <StrictMode>
        <CameraMediaUploaderContext.Provider
          value={{
            filesToUpload: [...batch],
            saveFile: save,
            onCompletion: complete,
            clearData,
          }}
        >
          <UploadStatusComponent />
        </CameraMediaUploaderContext.Provider>
      </StrictMode>
    );
    const { rerender } = render(ui());
    expect(saveFile).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'Add more attachments' })).toBeDisabled();
    const changedSaveFile = vi.fn((file: UploadedFile) => saveFile(file));
    const changedCompletion = vi.fn(() => onCompletion());
    rerender(ui(changedSaveFile, changedCompletion));
    expect(changedSaveFile).not.toHaveBeenCalled();
    await act(async () => uploads[2].resolve({} as FetchResponse<unknown>));
    await act(async () => uploads[0].resolve({} as FetchResponse<unknown>));
    expect(onCompletion).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add more attachments' })).toBeDisabled();
    await act(async () => uploads[1].resolve({} as FetchResponse<unknown>));
    expect(onCompletion).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Add more attachments' })).toBeEnabled();
    expect(saveFile).toHaveBeenCalledTimes(3);
    expect(showSnackbar).toHaveBeenCalledTimes(3);
  });

  it('shows partial failures safely, leaves remaining files pending, and never reports batch completion or retries', async () => {
    const uploads = images.map(() => deferred<FetchResponse<unknown>>());
    const saveFile = vi.fn((file: UploadedFile) => uploads[batch.indexOf(file)].promise);
    const onCompletion = vi.fn();
    const { rerender } = render(
      <CameraMediaUploaderContext.Provider value={{ filesToUpload: batch, saveFile, onCompletion }}>
        <UploadStatusComponent />
      </CameraMediaUploaderContext.Provider>,
    );
    await act(async () => uploads[0].resolve({} as FetchResponse<unknown>));
    await act(async () => uploads[1].reject(new Error('private endpoint with technical backend details')));
    expect(screen.getByText(/Upload could not be confirmed/)).toBeInTheDocument();
    expect(screen.queryByText(/private endpoint/)).not.toBeInTheDocument();
    expect(screen.getByText('second.png').closest('[role="alert"]')).toBeInTheDocument();
    expect(
      screen.getByText('third.png').closest('.cds--file__selected-file')?.querySelector('.cds--loading'),
    ).not.toBeNull();
    expect(onCompletion).not.toHaveBeenCalled();
    await act(async () => uploads[2].resolve({} as FetchResponse<unknown>));
    rerender(
      <CameraMediaUploaderContext.Provider
        value={{
          filesToUpload: [...batch],
          saveFile: (file) => saveFile(file),
          onCompletion,
        }}
      >
        <UploadStatusComponent />
      </CameraMediaUploaderContext.Provider>,
    );
    expect(onCompletion).not.toHaveBeenCalled();
    expect(saveFile).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'Add more attachments' })).toBeDisabled();
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle: expect.stringContaining('reload the attachments'),
      }),
    );
  });
});
