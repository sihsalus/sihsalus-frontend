import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EmptyState } from '.';

const mockT = vi.hoisted(() =>
  vi.fn(
    (
      key: string,
      defaultValue?: string,
      options: { displayText?: string; interpolation?: { escapeValue?: boolean } } = {},
    ) => {
      let translation = defaultValue ?? key;
      if (options.displayText) {
        const displayText =
          options.interpolation?.escapeValue === false
            ? options.displayText
            : options.displayText.replaceAll('&', '&amp;').replaceAll('/', '&#x2F;');
        translation = translation.replace('{{displayText}}', displayText);
      }
      return translation;
    },
  ),
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

describe('EmptyState', () => {
  beforeEach(() => {
    mockT.mockClear();
  });

  it('renders an empty state widget card', () => {
    render(<EmptyState headerTitle="appointments" displayText="appointments" />);

    expect(screen.getByRole('heading', { name: /appointments/i })).toBeInTheDocument();
    expect(screen.getByTitle(/empty data illustration/i)).toBeInTheDocument();
    expect(screen.getByText(/There are no appointments to display for this patient/i)).toBeInTheDocument();
  });

  it('renders a link that launches a form in the workspace when the launchForm prop is provided', async () => {
    const user = userEvent.setup();
    const launchForm = vi.fn();

    render(<EmptyState headerTitle="appointments" displayText="appointments" launchForm={launchForm} />);

    const recordAppointmentsLink = screen.getByText(/record appointments/i);
    expect(recordAppointmentsLink).toBeInTheDocument();

    await user.click(recordAppointmentsLink);

    expect(launchForm).toHaveBeenCalledOnce();
  });

  it('preserves clinical acronyms and punctuation while React keeps markup inert', () => {
    const displayText = 'Registros de examen físico / SOAP <img src=x onerror=alert(1)>';
    const { container } = render(<EmptyState headerTitle="Examen físico / SOAP" displayText={displayText} />);

    const message = screen.getByText(/There are no registros de examen físico \/ SOAP/);
    expect(message).not.toHaveTextContent('&#x2F;');
    expect(message).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(mockT).toHaveBeenCalledWith(
      'emptyStateText',
      'There are no {{displayText}} to display for this patient',
      expect.objectContaining({
        displayText: 'registros de examen físico / SOAP <img src=x onerror=alert(1)>',
        interpolation: { escapeValue: false },
      }),
    );
  });
});
