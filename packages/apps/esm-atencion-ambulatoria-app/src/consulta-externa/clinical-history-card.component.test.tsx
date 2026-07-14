import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClinicalHistoryCard from './clinical-history-card.component';

const mockT = vi.hoisted(() =>
  vi.fn(
    (
      key: string,
      defaultValue?: string,
      options: {
        displayText?: string;
        interpolation?: { escapeValue?: boolean };
        title?: string;
      } = {},
    ) => {
      let translation = defaultValue ?? key;
      for (const variableName of ['displayText', 'title'] as const) {
        const interpolationValue = options[variableName];
        if (interpolationValue) {
          const value =
            options.interpolation?.escapeValue === false
              ? interpolationValue
              : interpolationValue.replaceAll('&', '&amp;').replaceAll('/', '&#x2F;');
          translation = translation.replace(`{{${variableName}}}`, value);
        }
      }
      return translation;
    },
  ),
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

interface EmptyStateMockProps {
  displayText: string;
  headerTitle: string;
  launchForm?: () => void;
}

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  CardHeader: ({ children, title }: { children?: React.ReactNode; title: string }) => (
    <header>
      <h4>{title}</h4>
      {children}
    </header>
  ),
  EmptyState: ({ displayText, headerTitle, launchForm }: EmptyStateMockProps) => (
    <section data-testid="empty-state" data-display-text={displayText} aria-label={headerTitle}>
      <button type="button" onClick={launchForm}>
        Registrar
      </button>
    </section>
  ),
  ErrorState: ({ headerTitle }: { headerTitle: string }) => <div role="alert">{headerTitle}</div>,
}));

const defaultProps = {
  emptyDisplayText: 'registros clínicos',
  title: 'Historial clínico',
};

describe('ClinicalHistoryCard', () => {
  beforeEach(() => {
    mockT.mockClear();
  });

  it('renders a table skeleton with the configured columns', () => {
    const skeletonHeaders = [
      { key: 'date', header: 'Fecha' },
      { key: 'value', header: 'Valor' },
    ];

    render(<ClinicalHistoryCard {...defaultProps} isLoading skeletonHeaders={skeletonHeaders} />);

    const skeleton = screen.getByRole('progressbar', { name: defaultProps.title });
    expect(within(skeleton).getByText('Fecha')).toBeInTheDocument();
    expect(within(skeleton).getByText('Valor')).toBeInTheDocument();
    expect(skeleton.querySelectorAll('thead th')).toHaveLength(2);
    expect(skeleton.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('renders an accordion skeleton for expandable histories', () => {
    render(<ClinicalHistoryCard {...defaultProps} isLoading loadingVariant="accordion" />);

    const skeleton = screen.getByRole('progressbar', { name: defaultProps.title });
    expect(skeleton.querySelector('.cds--accordion.cds--skeleton')).toBeInTheDocument();
    expect(skeleton.querySelectorAll('.cds--accordion__item')).toHaveLength(3);
  });

  it('delegates empty content and its action to the shared EmptyState', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(<ClinicalHistoryCard {...defaultProps} empty onAction={onAction} />);

    const emptyState = screen.getByTestId('empty-state');
    expect(emptyState).toHaveAttribute('data-display-text', defaultProps.emptyDisplayText);
    await user.click(within(emptyState).getByRole('button', { name: 'Registrar' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('renders errors before empty or content states', () => {
    render(
      <ClinicalHistoryCard {...defaultProps} empty error={new Error('No se pudo cargar')}>
        Contenido clínico
      </ClinicalHistoryCard>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(defaultProps.title);
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    expect(screen.queryByText('Contenido clínico')).not.toBeInTheDocument();
  });

  it('renders an accessible card and exposes background revalidation', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <ClinicalHistoryCard {...defaultProps} actionLabel="Registrar dato" isValidating onAction={onAction}>
        Contenido clínico
      </ClinicalHistoryCard>,
    );

    const card = screen.getByRole('region', { name: defaultProps.title });
    expect(within(card).getByText('Contenido clínico')).toBeInTheDocument();
    expect(card.querySelector('.cds--inline-loading')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Registrar dato' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('keeps pagination available when the current page has no section data', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const emptyDisplayText = 'registros de examen físico / SOAP';
    const title = 'Historial de examen físico / SOAP';

    render(
      <ClinicalHistoryCard
        {...defaultProps}
        empty
        emptyDisplayText={emptyDisplayText}
        pagination={{ currentPage: 1, totalPages: 3, onPageChange }}
        title={title}
      />,
    );

    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No hay registros de examen físico / SOAP en esta página.');
    expect(screen.getByRole('status')).not.toHaveTextContent('&#x2F;');
    expect(screen.getByLabelText(`Páginas de ${title}`)).toBeInTheDocument();
    expect(mockT).toHaveBeenCalledWith('noClinicalHistoryOnThisPage', 'No hay {{displayText}} en esta página.', {
      displayText: emptyDisplayText,
      interpolation: { escapeValue: false },
    });
    expect(mockT).toHaveBeenCalledWith('clinicalHistoryPagination', 'Páginas de {{title}}', {
      title,
      interpolation: { escapeValue: false },
    });
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
