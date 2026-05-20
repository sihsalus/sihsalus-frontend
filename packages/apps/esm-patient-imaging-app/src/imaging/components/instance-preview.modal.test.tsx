import { render, screen, waitFor } from '@testing-library/react';
import InstancePreviewModal from './instance-preview.modal';
import '@testing-library/jest-dom';
import { showSnackbar } from '@openmrs/esm-framework';
import { act } from '@testing-library/react';
import * as api from '../../api';

const mockT = (_key: string, defaultValue: string) => defaultValue;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}));

vi.mock('../../api');
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
}));

describe('InstancePreviewModal', () => {
  const closeMock = vi.fn();
  const defaultProps = {
    closeInstancePreviewModal: closeMock,
    studyId: 1,
    orthancInstanceUID: 'UID123',
    instancePosition: '1 of 10',
  };

  const setup = () => render(<InstancePreviewModal {...defaultProps} />);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  });

  afterAll(() => {
    (global.URL.createObjectURL as vi.Mock).mockRestore?.();
  });

  it('renders loading state initially', async () => {
    (api.previewInstance as vi.Mock).mockReturnValue(new Promise(() => {}));

    await act(async () => {
      setup();
    });

    expect(screen.getByText(/Loading image/i)).toBeInTheDocument();
    expect(screen.getByText(/Instance position: 1 of 10/i)).toBeInTheDocument();
  });

  it('renders image after successful fetch', async () => {
    const blob = new Blob(['fake image'], { type: 'image/png' });

    const response = { blob: vi.fn().mockResolvedValue(blob) };
    (api.previewInstance as vi.Mock).mockResolvedValue(response);

    setup();

    await waitFor(() => {
      const img = screen.getByRole('img', { hidden: true }) as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect((img as HTMLImageElement).src).toContain('blob:mock-url');
    });
  });

  it('handles fetch error', async () => {
    const error = new Error('Failed to fetch');
    (api.previewInstance as vi.Mock).mockImplementation(() => Promise.reject(error));

    setup();

    await waitFor(() => {
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'An error occurred while retrieving the instance preview',
          subtitle: 'Failed to fetch',
        }),
      );
      expect(closeMock).toHaveBeenCalled();
    });
  });

  it('renders and finishes loading', async () => {
    const blob = new Blob(['fake image'], { type: 'image/png' });
    const response = { blob: vi.fn().mockResolvedValue(blob) };
    (api.previewInstance as vi.Mock).mockResolvedValue(response);

    setup();

    // wait for the imageData update
    await waitFor(() => {
      const img = screen.getByRole('img') as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img.src).toContain('blob:mock-url');
    });
  });
});
