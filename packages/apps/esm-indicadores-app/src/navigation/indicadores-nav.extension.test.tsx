import { fireEvent, render, screen } from '@testing-library/react';
import { navigate } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import IndicadoresNav from './indicadores-nav.extension';

vi.mock('@openmrs/esm-framework', () => ({ navigate: vi.fn() }));

const mockNavigate = vi.mocked(navigate);
const indicatorsBaseUrl = '/openmrs/spa/indicators';

const renderAt = (path: string) => {
  window.history.replaceState({}, '', `${indicatorsBaseUrl}${path}`);
  render(<IndicadoresNav />);
};

describe('IndicadoresNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
  });

  it('renders one module-scoped rail link per section, in product order', () => {
    renderAt('');

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      indicatorsBaseUrl,
      `${indicatorsBaseUrl}/indicadores`,
      `${indicatorsBaseUrl}/resultados`,
      `${indicatorsBaseUrl}/metas`,
    ]);
    expect(links.map((link) => link.textContent)).toEqual(['Panel', 'Indicadores', 'Resultados', 'Metas']);
  });

  it('marks only the current section as the active page', () => {
    renderAt('/resultados');

    const links = screen.getAllByRole('link');
    const active = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute('href', `${indicatorsBaseUrl}/resultados`);
  });

  it('navigates through the shell router when a section link is clicked', () => {
    renderAt('');

    fireEvent.click(screen.getAllByRole('link')[2]);

    expect(mockNavigate).toHaveBeenCalledWith({ to: `${indicatorsBaseUrl}/resultados` });
  });
});
