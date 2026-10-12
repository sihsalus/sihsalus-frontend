import { openmrsFetch, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { SWRConfig } from 'swr';
import chartEn from '../../../../../esm-patient-chart-app/translations/en.json';
import chartEs from '../../../../../esm-patient-chart-app/translations/es.json';
import en from '../../../../translations/en.json';
import es from '../../../../translations/es.json';
import SupplementationTracker from './supplementation-tracker.component';

vi.mock('react-i18next', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('react-i18next');
});
const formState = vi.hoisted(() => ({ launchForm: vi.fn(), isLoading: false }));
vi.mock('../../../hooks/useCREDFormLauncher', () => ({
  useCREDFormLauncher: () => formState,
}));

beforeEach(() => {
  formState.isLoading = false;
  formState.launchForm.mockClear();
  vi.mocked(useConfig).mockReturnValue({
    supplementation: { mmnConceptUuid: 'synthetic-mmn', mmnTotalTarget: 360 },
  });
  vi.mocked(userHasAccess).mockReturnValue(false);
});

async function renderTracker(
  language: 'en' | 'es',
  delivered: number | null,
  { failNextPage = false, waitForResponse }: { failNextPage?: boolean; waitForResponse?: Promise<void> } = {},
) {
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    await waitForResponse;
    if (failNextPage && String(url).includes('startIndex=1')) throw new Error('Synthetic delivery page failure');
    return {
      data: {
        results:
          delivered === null
            ? []
            : [{ uuid: 'synthetic-delivery', value: delivered, obsDatetime: '2026-10-01T09:00:00Z' }],
        links: failNextPage ? [{ rel: 'next', uri: 'https://example.test/openmrs/ws/rest/v1/obs?startIndex=1' }] : [],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>;
  });
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: false,
    defaultNS: 'other-module',
    resources: {
      en: { '@sihsalus/esm-cred-app': en, '@sihsalus/esm-patient-chart-app': chartEn },
      es: { '@sihsalus/esm-cred-app': es, '@sihsalus/esm-patient-chart-app': chartEs },
    },
    interpolation: { escapeValue: false },
  });
  render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <I18nextProvider i18n={i18n} defaultNS="other-module">
        <SupplementationTracker patientUuid="synthetic-child" />
      </I18nextProvider>
    </SWRConfig>,
  );
}

describe.each(['en', 'es'] as const)('MMN delivery summary (%s)', (language) => {
  const messages = language === 'en' ? en : es;
  const chart = language === 'en' ? chartEn : chartEs;
  const emptyMessage = chart.emptyStateText.replace('{{displayText}}', messages.mmnDeliveries.toLowerCase());

  it('shows a confirmed empty state without implying that deliveries have started', async () => {
    await renderTracker(language, null);
    expect(await screen.findByText(emptyMessage)).toBeVisible();
    expect(screen.queryByText(messages.mmnDeliveriesInProgress)).not.toBeInTheDocument();
    expect(screen.queryByText(messages.mmnDeliveryTargetReached)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('preserves a recorded zero as data instead of presenting an empty history', async () => {
    await renderTracker(language, 0);
    expect(await screen.findByText(messages.mmnDeliveriesInProgress)).toBeVisible();
    expect(screen.getByText('0%')).toBeVisible();
    expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument();
  });

  it('waits for the response before displaying absence or delivery progress', async () => {
    await renderTracker(language, null, { waitForResponse: new Promise(() => {}) });
    await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    expect(screen.getByRole('progressbar', { name: messages.loadingData })).toBeVisible();
    expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(messages.mmnDeliveriesInProgress)).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('keeps the authorized form launcher available from the empty state', async () => {
    vi.mocked(userHasAccess).mockReturnValue(true);
    await renderTracker(language, null);
    expect(await screen.findByText(emptyMessage)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: `${chart.record} ${messages.mmnDeliveries.toLowerCase()}` }));
    expect(formState.launchForm).toHaveBeenCalledOnce();
    expect(formState.launchForm).toHaveBeenCalledWith();
  });

  it('waits for form metadata before offering the empty state action', async () => {
    vi.mocked(userHasAccess).mockReturnValue(true);
    formState.isLoading = true;
    await renderTracker(language, null);
    expect(await screen.findByText(emptyMessage)).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows 100% as a delivery target and preserves the recorded quantity', async () => {
    await renderTracker(language, 360);
    expect(await screen.findByText(messages.mmnDeliveryTargetReached)).toBeVisible();
    expect(
      screen.getByText(messages.mmnDeliveryProgress.replace('{{delivered}}', '360').replace('{{total}}', '360')),
    ).toBeVisible();
    expect(screen.getByText('100%')).toBeVisible();
    expect(screen.getByText(messages.mmnDescription)).toBeVisible();
    expect(screen.queryByText(language === 'en' ? 'Complete' : 'Completo')).not.toBeInTheDocument();
    expect(screen.queryByText(/1 (sobre|sachet)/)).not.toBeInTheDocument();
  });

  it('shows delivery progress below the configured target', async () => {
    await renderTracker(language, 180);
    expect(await screen.findByText(messages.mmnDeliveriesInProgress)).toBeVisible();
    expect(
      screen.getByText(messages.mmnDeliveryProgress.replace('{{delivered}}', '180').replace('{{total}}', '360')),
    ).toBeVisible();
    expect(screen.getByText('50%')).toBeVisible();
  });

  it('shows an error without zero or partial progress when a later delivery page fails', async () => {
    await renderTracker(language, 180, { failNextPage: true });
    expect(await screen.findByRole('heading', { name: messages.mmnSupplementation })).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
    expect(screen.queryByText(emptyMessage)).not.toBeInTheDocument();
    expect(screen.queryByText('Synthetic delivery page failure')).not.toBeInTheDocument();
    expect(screen.queryByText(messages.mmnDeliveriesInProgress)).not.toBeInTheDocument();
  });
});
