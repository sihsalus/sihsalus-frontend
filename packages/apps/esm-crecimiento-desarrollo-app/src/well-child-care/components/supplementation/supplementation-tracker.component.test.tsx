import { openmrsFetch, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { SWRConfig } from 'swr';
import en from '../../../../translations/en.json';
import es from '../../../../translations/es.json';
import SupplementationTracker from './supplementation-tracker.component';

vi.mock('react-i18next', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('react-i18next');
});
vi.mock('../../../hooks/useCREDFormLauncher', () => ({
  useCREDFormLauncher: () => ({ launchForm: vi.fn(), isLoading: false }),
}));

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue({
    supplementation: { mmnConceptUuid: 'synthetic-mmn', mmnTotalTarget: 360 },
  });
  vi.mocked(userHasAccess).mockReturnValue(false);
});

async function renderTracker(language: 'en' | 'es', delivered: number, failNextPage = false) {
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    if (failNextPage && String(url).includes('startIndex=1')) throw new Error('Synthetic delivery page failure');
    return {
      data: {
        results: [{ uuid: 'synthetic-delivery', value: delivered, obsDatetime: '2026-10-01T09:00:00Z' }],
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
      en: { '@sihsalus/esm-cred-app': en },
      es: { '@sihsalus/esm-cred-app': es },
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
    await renderTracker(language, 180, true);
    expect(await screen.findByRole('heading', { name: messages.mmnSupplementation })).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
    expect(screen.queryByText(messages.mmnDeliveriesInProgress)).not.toBeInTheDocument();
  });
});
