import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { type ConfigSchema, configSchema } from '../../config-schema';

import Logo from './logo.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  __esModule: true,
  useConfig: vi.fn(),
  interpolateUrl: vi.fn((url: string) => url),
}));

const mockUseConfig = vi.mocked(useConfig<ConfigSchema>);
const defaultConfig: ConfigSchema = getDefaultsFromConfigSchema(configSchema);

describe('Logo', () => {
  it('should display the Sihsalus wordmark when no image or organization name is configured', () => {
    mockUseConfig.mockReturnValue({
      ...defaultConfig,
      logo: { ...defaultConfig.logo, src: '', name: '' },
    });

    render(<Logo />);

    expect(screen.getByText('Sihsalus')).toBeInTheDocument();
  });

  it('should display name', () => {
    mockUseConfig.mockReturnValue({
      ...defaultConfig,
      logo: { ...defaultConfig.logo, src: '', name: 'Some weird EMR' },
    });

    render(<Logo />);

    expect(screen.getByText(/Some weird EMR/i)).toBeInTheDocument();
  });

  it('should display image logo', () => {
    const mockConfig = {
      ...defaultConfig,
      logo: {
        ...defaultConfig.logo,
        src: 'https://someimage.png',
        alt: 'alternative text',
      },
    };

    mockUseConfig.mockReturnValue(mockConfig);

    render(<Logo />);

    const logo = screen.getByRole('img');

    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('alt');
  });

  it('should handle image load errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockConfig = {
      ...defaultConfig,
      logo: {
        ...defaultConfig.logo,
        src: 'invalid-image.png',
        alt: 'alt text',
      },
    };

    mockUseConfig.mockReturnValue(mockConfig);

    render(<Logo />);

    const img = screen.getByRole('img');

    const errorEvent = new Event('error');
    img.dispatchEvent(errorEvent);

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load logo image:', expect.any(Object));
    consoleSpy.mockRestore();
  });
});
