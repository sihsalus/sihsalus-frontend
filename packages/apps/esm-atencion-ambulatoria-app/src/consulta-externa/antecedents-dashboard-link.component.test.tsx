import { useAssignedExtensions } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import AntecedentsDashboardLink from './antecedents-dashboard-link.component';

it('avoids a second sidebar item when the conditions entry is assigned', () => {
  vi.mocked(useAssignedExtensions).mockReturnValue([
    { id: 'conditions-summary-dashboard' } as ReturnType<typeof useAssignedExtensions>[number],
  ]);
  const { container } = render(<AntecedentsDashboardLink basePath="/patient/synthetic/chart" />);
  expect(container).toBeEmptyDOMElement();
});

it('keeps the grouped entry for social-only access or an absent conditions module', () => {
  vi.mocked(useAssignedExtensions).mockReturnValue([]);
  render(<AntecedentsDashboardLink basePath="/patient/synthetic/chart" />);
  expect(screen.getByRole('link')).toHaveAttribute('href', '/patient/synthetic/chart/social-history-dashboard');
  expect(screen.getByRole('link')).toHaveTextContent(/antecedents/i);
});
