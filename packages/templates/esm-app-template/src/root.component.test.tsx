import { useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import type { TemplateConfig } from './config-schema';
import Root from './root.component';

const mockUseConfig = vi.mocked(useConfig<TemplateConfig>);

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Root', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      enabled: true,
      title: 'Template app',
    });
  });

  it('renders the default template content', () => {
    render(<Root />);

    expect(screen.getByRole('heading', { name: 'Template app' })).toBeInTheDocument();
    expect(screen.getByText('The app shell, route, translations and tests are ready.')).toBeInTheDocument();
  });

  it('renders the disabled state', () => {
    mockUseConfig.mockReturnValue({
      enabled: false,
      title: 'Template app',
    });

    render(<Root />);

    expect(screen.getByText('This app is disabled by configuration.')).toBeInTheDocument();
  });
});
