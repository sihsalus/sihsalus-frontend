import { useConfig, useConnectivity } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReferenceLinks from './reference-links.component';

vi.mock('@openmrs/esm-framework', () => ({
  useConfig: vi.fn(),
  useConnectivity: vi.fn(),
}));

vi.mock('@carbon/react/icons', () => ({
  Launch: (props: { className?: string }) => <span {...props}>Launch</span>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string): ReactNode => defaultValue ?? key,
  }),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUseConnectivity = vi.mocked(useConnectivity);

const clinicalReferenceLinks = [
  { label: 'MDCalc', description: 'Calculadoras y scores clínicos', url: 'https://www.mdcalc.com/' },
  { label: 'CIE-10 (OMS)', url: 'https://icd.who.int/browse10/2019/en' },
];

describe('ReferenceLinks', () => {
  beforeEach(() => {
    mockUseConnectivity.mockReturnValue(true);
    mockUseConfig.mockReturnValue({ clinicalReferenceLinks });
  });

  it('opens every reference in a new tab without leaking the SIH Salus URL', () => {
    render(<ReferenceLinks />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://www.mdcalc.com/',
      'https://icd.who.int/browse10/2019/en',
    ]);

    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      // noreferrer keeps the referring SIH Salus URL out of the third party's
      // logs; noopener denies the opened tab a handle on this window.
      expect(link.getAttribute('rel')).toContain('noreferrer');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });

  it('says these are not part of SIH Salus', () => {
    render(<ReferenceLinks />);

    expect(screen.getByRole('heading', { name: 'Enlaces de referencia' })).toBeVisible();
    expect(screen.getByText(/Servicios externos a SIH Salus/)).toBeVisible();
  });

  it('renders a link with no description', () => {
    render(<ReferenceLinks />);

    expect(screen.getByRole('link', { name: /CIE-10/ })).toBeVisible();
  });

  it('hides itself offline, where none of these could resolve', () => {
    mockUseConnectivity.mockReturnValue(false);

    const { container } = render(<ReferenceLinks />);

    expect(container).toBeEmptyDOMElement();
  });

  it('hides itself when an implementer configures no links', () => {
    mockUseConfig.mockReturnValue({ clinicalReferenceLinks: [] });

    const { container } = render(<ReferenceLinks />);

    expect(container).toBeEmptyDOMElement();
  });
});
