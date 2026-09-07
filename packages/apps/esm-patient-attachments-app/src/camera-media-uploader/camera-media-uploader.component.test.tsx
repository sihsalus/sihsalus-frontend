import { useAllowedFileExtensions } from '@openmrs/esm-patient-common-lib';
import { render } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import CameraMediaUploaderModal from './camera-media-uploader.component';

vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  useAllowedFileExtensions: vi.fn(),
}));

const mockUseAllowedFileExtensions = vi.mocked(useAllowedFileExtensions);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAllowedFileExtensions.mockReturnValue({
    allowedFileExtensions: [],
    error: undefined,
    isConfigured: false,
    isLoading: false,
  });
});

it('keeps the configured lookup and intersects an explicit allowlist by default', () => {
  mockUseAllowedFileExtensions.mockReturnValue({
    allowedFileExtensions: ['jpg'],
    error: undefined,
    isConfigured: true,
    isLoading: false,
  });

  const { getByText } = render(
    <CameraMediaUploaderModal allowedExtensions={['pdf']} closeModal={vi.fn()} saveFile={vi.fn()} />,
  );

  expect(mockUseAllowedFileExtensions).toHaveBeenCalledWith(true);
  expect(getByText('Attachment upload unavailable')).toBeInTheDocument();
});

it('skips the configured lookup only for an explicit workflow opt-in', () => {
  render(
    <CameraMediaUploaderModal
      allowedExtensions={['pdf']}
      closeModal={vi.fn()}
      saveFile={vi.fn()}
      skipConfiguredAllowlistLookup
    />,
  );

  expect(mockUseAllowedFileExtensions).toHaveBeenCalledWith(false);
});

it('keeps the server-configured allowlist lookup for the generic uploader', () => {
  render(<CameraMediaUploaderModal closeModal={vi.fn()} saveFile={vi.fn()} />);

  expect(mockUseAllowedFileExtensions).toHaveBeenCalledWith(true);
});
