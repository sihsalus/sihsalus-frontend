import * as framework from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as imagingApi from '../../api/api';
import { maxUploadImageDataSize } from '../constants';
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
    render(
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

    const file = new File([new ArrayBuffer(maxUploadImageDataSize + 1)], 'bigfile.dcm', {
      type: 'application/dicom',
    });

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
        expect.objectContaining({ subtitle: expect.stringContaining('Upload failed') }),
      );
    });
  });

  it('calls closeWorkspace when Cancel button is clicked', () => {
    setup();

    fireEvent.click(screen.getByText('Cancel'));
    expect(closeWorkspace).toHaveBeenCalled();
  });
});
