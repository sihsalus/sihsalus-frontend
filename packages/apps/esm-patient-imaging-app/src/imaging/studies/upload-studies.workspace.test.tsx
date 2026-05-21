import * as framework from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as api from '../../api';
import { maxUploadImageDataSize } from '../constants';
import UploadStudiesWorkspace from './upload-studies.workspace';

type WrapperProps = {
  children?: ReactNode;
};

type ComboBoxMockProps = {
  onChange: ({ selectedItem }: { selectedItem: { id: number; orthancBaseUrl: string } }) => void;
  selectedItem?: { id?: number };
};

type FileUploaderMockProps = {
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

type ButtonLikeProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

type FormLikeProps = React.FormHTMLAttributes<HTMLFormElement> & {
  children?: ReactNode;
};

vi.mock('react-i18next', async () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('../../api', async () => ({
  uploadStudies: vi.fn(),
  useOrthancConfigurations: vi.fn(),
}));

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
  createErrorHandler: vi.fn(),
  useLayoutType: vi.fn(),
  ExtensionSlot: () => <div>ExtensionSlot</div>,
  ResponsiveWrapper: ({ children }: WrapperProps) => <div>{children}</div>,
}));

vi.mock('@carbon/react', async () => {
  const original = await vi.importActual('@carbon/react');
  return {
    ...original,
    ComboBox: ({ onChange, selectedItem }: ComboBoxMockProps) => (
      <select
        data-testid="combobox"
        value={selectedItem?.id || ''}
        onChange={(e) => onChange({ selectedItem: { id: Number(e.target.value), orthancBaseUrl: e.target.value } })}
      >
        <option value="">Select</option>
        <option value="1">Server 1</option>
        <option value="2">Server 2</option>
      </select>
    ),
    FileUploader: ({ onChange }: FileUploaderMockProps) => (
      <input type="file" data-testid="file-uploader" onChange={onChange} multiple />
    ),
    Button: ({ children, ...props }: ButtonLikeProps) => <button {...props}>{children}</button>,
    Form: ({ children, ...props }: FormLikeProps) => <form {...props}>{children}</form>,
    Stack: ({ children }: WrapperProps) => <div>{children}</div>,
    Row: ({ children }: WrapperProps) => <div>{children}</div>,
    FormGroup: ({ children }: WrapperProps) => <div>{children}</div>,
  };
});

describe('UploadStudiesWorkspace', () => {
  const patientUuid = 'patient-123';
  const closeWorkspace = vi.fn();

  beforeEach(() => {
    (api.useOrthancConfigurations as vi.Mock).mockReturnValue({
      data: [
        { id: 1, orthancBaseUrl: 'url1', orthancProxyUrl: null },
        { id: 2, orthancBaseUrl: 'url2', orthancProxyUrl: null },
      ],
    });
    (framework.useLayoutType as vi.Mock).mockReturnValue('desktop');
    vi.clearAllMocks();
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

    expect(screen.getByTestId('combobox')).toBeInTheDocument();
    expect(screen.getByTestId('file-uploader')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows error snackbar if no files are selected', async () => {
    setup();

    // Select a valid Orthanc server to pass form validation
    fireEvent.change(screen.getByTestId('combobox'), { target: { value: '1' } });

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

    fireEvent.change(screen.getByTestId('file-uploader'), { target: { files: [file] } });
    fireEvent.change(screen.getByTestId('combobox'), { target: { value: '1' } });
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
    (api.uploadStudies as vi.Mock).mockResolvedValue({});

    setup();

    fireEvent.change(screen.getByTestId('file-uploader'), { target: { files: [file] } });
    fireEvent.change(screen.getByTestId('combobox'), { target: { value: '1' } });

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(api.uploadStudies).toHaveBeenCalled();
      expect(closeWorkspace).toHaveBeenCalled();
    });
  });

  it('shows snackbar on upload failure', async () => {
    const file = new File(['dummy content'], 'test.dcm', { type: 'application/dicom' });
    (api.uploadStudies as vi.Mock).mockRejectedValue(new Error('Upload failed'));

    setup();

    fireEvent.change(screen.getByTestId('file-uploader'), { target: { files: [file] } });
    fireEvent.change(screen.getByTestId('combobox'), { target: { value: '1' } });

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
