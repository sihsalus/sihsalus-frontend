import * as framework from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as imagingApi from '../../api/api';
import { maxUploadImageDataSize } from '../constants';
import { useImagingAccess } from '../utils/use-imaging-access';
import UploadStudiesWorkspace from './upload-studies.workspace';

type WrapperProps = {
  children?: ReactNode;
};

vi.mock('react-i18next', async () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
  createErrorHandler: vi.fn(),
  useLayoutType: vi.fn(),
  ExtensionSlot: () => <div>ExtensionSlot</div>,
  ResponsiveWrapper: ({ children }: WrapperProps) => <div>{children}</div>,
}));

describe('UploadStudiesWorkspace', () => {
  const patientUuid = 'patient-123';
  const closeWorkspace = vi.fn();
  const mockUseOrthancConfigurations = vi.spyOn(imagingApi, 'useOrthancConfigurations');
  const mockUseStudiesByPatient = vi.spyOn(imagingApi, 'useStudiesByPatient');
  const mockUploadStudies = vi.spyOn(imagingApi, 'uploadStudies');
  const buildStudiesHookResult = (
    overrides: Partial<ReturnType<typeof imagingApi.useStudiesByPatient>> = {},
  ): ReturnType<typeof imagingApi.useStudiesByPatient> =>
    ({
      data: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }) as ReturnType<typeof imagingApi.useStudiesByPatient>;

  const selectOrthancServer = () => {
    const comboBox = screen.getByTestId('orthanc-server-combobox');
    fireEvent.change(comboBox, { target: { value: 'url1' } });
    fireEvent.keyDown(comboBox, { key: 'ArrowDown' });
    fireEvent.keyDown(comboBox, { key: 'Enter' });
  };

  const selectFiles = (files: File[]) => {
    const input = screen
      .getByTestId('upload-studies-fileuploader')
      .querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files } });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadStudies.mockReset();
    vi.mocked(useImagingAccess).mockReturnValue({ canWrite: true, isOnline: true });
    mockUseOrthancConfigurations.mockReturnValue({
      data: [
        { id: 1, orthancBaseUrl: 'url1', orthancProxyUrl: null },
        { id: 2, orthancBaseUrl: 'url2', orthancProxyUrl: null },
      ],
    } as ReturnType<typeof imagingApi.useOrthancConfigurations>);
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult());
    (framework.useLayoutType as vi.Mock).mockReturnValue('desktop');
  });

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const setup = () => {
    return render(
      <UploadStudiesWorkspace
        patientUuid={patientUuid}
        closeWorkspace={closeWorkspace}
        promptBeforeClosing={vi.fn()}
        closeWorkspaceWithSavedChanges={vi.fn()}
        setTitle={vi.fn()}
      />,
    );
  };

  it('renders form elements correctly', () => {
    setup();

    expect(screen.getByTestId('orthanc-server-combobox')).toBeInTheDocument();
    expect(screen.getByTestId('upload-studies-fileuploader')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows error snackbar if no files are selected', async () => {
    setup();

    selectOrthancServer();

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() =>
      expect(framework.showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ subtitle: 'Select files to upload' }),
      ),
    );
  });

  it('shows error if file size exceeds limit', async () => {
    setup();

    const file = new File(['synthetic'], 'bigfile.dcm', {
      type: 'application/dicom',
    });
    Object.defineProperty(file, 'size', { value: maxUploadImageDataSize + 1 });

    selectFiles([file]);
    selectOrthancServer();
    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() =>
      expect(framework.showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          subtitle: expect.stringContaining(`${maxUploadImageDataSize / 1000000} MB`),
        }),
      ),
    );
  });

  it('calls uploadStudies and closes workspace on successful upload', async () => {
    const file = new File(['dummy content'], 'test.dcm', { type: 'application/dicom' });
    mockUploadStudies.mockResolvedValue(undefined);
    const mutate = vi.fn().mockResolvedValue(undefined);
    mockUseStudiesByPatient.mockReturnValue(buildStudiesHookResult({ mutate }));

    setup();

    selectFiles([file]);
    selectOrthancServer();

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(mockUploadStudies).toHaveBeenCalledWith(
        [file],
        expect.objectContaining({
          id: expect.any(Number),
          orthancBaseUrl: expect.any(String),
        }),
        patientUuid,
        expect.any(AbortController),
      );
      expect(mutate).toHaveBeenCalled();
      expect(closeWorkspace).toHaveBeenCalled();
    });
  });

  it('shows an inline loading state while uploading files', async () => {
    const file = new File(['dummy content'], 'test.dcm', { type: 'application/dicom' });
    let resolveUpload: () => void;
    mockUploadStudies.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
        }),
    );

    setup();

    selectFiles([file]);
    selectOrthancServer();

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(screen.getByTestId('upload-studies-loading')).toBeInTheDocument();
      expect(screen.getByText('Uploading studies...')).toBeInTheDocument();
      expect(screen.getByTestId('upload-studies-submit')).toBeDisabled();
      expect(screen.getByTestId('upload-studies-cancel')).toBeDisabled();
    });

    resolveUpload?.();

    await waitFor(() => {
      expect(closeWorkspace).toHaveBeenCalled();
    });
  });

  it('shows snackbar on upload failure', async () => {
    const file = new File(['dummy content'], 'test.dcm', { type: 'application/dicom' });
    mockUploadStudies.mockRejectedValue(new Error('Upload failed'));

    setup();

    selectFiles([file]);
    selectOrthancServer();

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(framework.showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          subtitle: 'The operation could not be completed. Refresh and check the result before trying again.',
        }),
      );
    });
  });

  it('calls closeWorkspace when Cancel button is clicked', () => {
    setup();

    fireEvent.click(screen.getByText('Cancel'));
    expect(closeWorkspace).toHaveBeenCalled();
  });
  it('keeps all batches selected through the file picker', async () => {
    mockUploadStudies.mockResolvedValue(undefined);
    setup();
    const first = new File(['a'], 'first.dcm');
    const second = new File(['b'], 'second.dcm');
    selectFiles([first]);
    selectFiles([second]);
    expect(screen.getByText('first.dcm')).toBeInTheDocument();
    expect(screen.getByText('second.dcm')).toBeInTheDocument();
    selectOrthancServer();
    fireEvent.click(screen.getByTestId('upload-studies-submit'));
    await waitFor(() => expect(mockUploadStudies.mock.calls[0][0]).toEqual([first, second]));
  });

  it('rejects ZIP before sending any file', async () => {
    setup();
    selectFiles([new File(['archive'], 'study.zip')]);
    selectOrthancServer();
    fireEvent.click(screen.getByTestId('upload-studies-submit'));
    await screen.findByText(/ZIP upload is unavailable/);
    expect(mockUploadStudies).not.toHaveBeenCalled();
  });

  it('retains only unattempted files after partial completion', async () => {
    const files = ['a.dcm', 'b.dcm', 'c.dcm'].map((name) => new File(['synthetic'], name));
    mockUploadStudies.mockRejectedValueOnce(new imagingApi.StudyUploadError([files[0]], 1));
    setup();
    selectFiles(files);
    selectOrthancServer();
    fireEvent.click(screen.getByTestId('upload-studies-submit'));
    await waitFor(() => expect(screen.queryByText('a.dcm')).not.toBeInTheDocument());
    expect(screen.queryByText('b.dcm')).not.toBeInTheDocument();
    expect(screen.getByText('c.dcm')).toBeInTheDocument();
    mockUploadStudies.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByTestId('upload-studies-submit'));
    await waitFor(() => expect(mockUploadStudies.mock.calls[1][0]).toEqual([files[2]]));
  });

  it('does not offer to upload again when only refreshing the list failed', async () => {
    mockUploadStudies.mockResolvedValueOnce(undefined);
    mockUseStudiesByPatient.mockReturnValue(
      buildStudiesHookResult({ mutate: vi.fn().mockRejectedValue(new Error('refresh failed')) }),
    );
    setup();
    selectFiles([new File(['synthetic'], 'saved.dcm')]);
    selectOrthancServer();
    fireEvent.click(screen.getByTestId('upload-studies-submit'));
    await screen.findByText(/files were uploaded, but the study list could not be refreshed/i);
    expect(screen.queryByText('saved.dcm')).not.toBeInTheDocument();
    expect(closeWorkspace).not.toHaveBeenCalled();
    expect(mockUploadStudies).toHaveBeenCalledTimes(1);
  });
  it('does not send a file removed from the queue', async () => {
    mockUploadStudies.mockResolvedValueOnce(undefined);
    setup();
    const files = [new File(['a'], 'first.dcm'), new File(['b'], 'second.dcm')];
    selectFiles(files);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove file' })[0]);
    selectOrthancServer();
    fireEvent.click(screen.getByTestId('upload-studies-submit'));
    await waitFor(() => expect(mockUploadStudies.mock.calls[0][0]).toEqual([files[1]]));
  });

  it('clears queued files and server selection when the patient changes', () => {
    const { rerender } = setup();
    selectFiles([new File(['synthetic'], 'previous-patient.dcm')]);
    selectOrthancServer();
    rerender(
      <UploadStudiesWorkspace
        patientUuid="another-synthetic-patient"
        closeWorkspace={closeWorkspace}
        promptBeforeClosing={vi.fn()}
        closeWorkspaceWithSavedChanges={vi.fn()}
        setTitle={vi.fn()}
      />,
    );
    expect(screen.queryByText('previous-patient.dcm')).not.toBeInTheDocument();
    expect(screen.getByTestId('orthanc-server-combobox')).toHaveValue('');
    expect(mockUploadStudies).not.toHaveBeenCalled();
  });

  it.each([
    { canWrite: false, isOnline: false },
    { canWrite: true, isOnline: true, userUuid: 'next-synthetic-user' },
  ])('reconciles attempted files before access can resume after %j', async (access) => {
    let rejectUpload: (reason: unknown) => void;
    mockUploadStudies.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectUpload = reject;
        }),
    );
    const { rerender } = setup();
    const files = ['a.dcm', 'b.dcm', 'c.dcm'].map((name) => new File(['synthetic'], name));
    selectFiles(files);
    selectOrthancServer();
    fireEvent.click(screen.getByTestId('upload-studies-submit'));
    await waitFor(() => expect(mockUploadStudies).toHaveBeenCalledTimes(1));
    vi.mocked(useImagingAccess).mockReturnValue(access);
    const currentWorkspace = () => (
      <UploadStudiesWorkspace
        patientUuid={patientUuid}
        closeWorkspace={closeWorkspace}
        promptBeforeClosing={vi.fn()}
        closeWorkspaceWithSavedChanges={vi.fn()}
        setTitle={vi.fn()}
      />
    );
    rerender(currentWorkspace());
    expect(mockUploadStudies.mock.calls[0][3].signal.aborted).toBe(true);
    await act(async () => rejectUpload(new imagingApi.StudyUploadError([files[0]], 1)));
    expect(screen.queryByText('a.dcm')).not.toBeInTheDocument();
    expect(screen.queryByText('b.dcm')).not.toBeInTheDocument();
    expect(screen.getByText('c.dcm')).toBeInTheDocument();
    expect(screen.getByText(/files confirmed/)).toBeInTheDocument();
    expect(closeWorkspace).not.toHaveBeenCalled();
    vi.mocked(useImagingAccess).mockReturnValue({ canWrite: true, isOnline: true });
    rerender(currentWorkspace());
    mockUploadStudies.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByTestId('upload-studies-submit'));
    await waitFor(() => expect(mockUploadStudies.mock.calls[1][0]).toEqual([files[2]]));
  });

  it('removes confirmed uploads even if access changes before the acknowledgement arrives', async () => {
    let resolveUpload: () => void;
    mockUploadStudies.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const { rerender } = setup();
    selectFiles([new File(['synthetic'], 'confirmed.dcm')]);
    selectOrthancServer();
    fireEvent.click(screen.getByTestId('upload-studies-submit'));
    await waitFor(() => expect(mockUploadStudies).toHaveBeenCalledTimes(1));
    vi.mocked(useImagingAccess).mockReturnValue({ canWrite: false, isOnline: false });
    rerender(
      <UploadStudiesWorkspace
        patientUuid={patientUuid}
        closeWorkspace={closeWorkspace}
        promptBeforeClosing={vi.fn()}
        closeWorkspaceWithSavedChanges={vi.fn()}
        setTitle={vi.fn()}
      />,
    );
    await act(async () => resolveUpload());
    expect(screen.queryByText('confirmed.dcm')).not.toBeInTheDocument();
    expect(screen.getByText(/files were uploaded, but the study list could not be refreshed/)).toBeInTheDocument();
    expect(closeWorkspace).not.toHaveBeenCalled();
    expect(screen.getByTestId('upload-studies-cancel')).toBeEnabled();
  });
});

vi.mock('../utils/use-imaging-access', () => ({ useImagingAccess: vi.fn(() => ({ canWrite: true, isOnline: true })) }));
