import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { SWRConfig } from 'swr';
import chartEn from '../../../../../../esm-patient-chart-app/translations/en.json';
import chartEs from '../../../../../../esm-patient-chart-app/translations/es.json';
import en from '../../../../../translations/en.json';
import es from '../../../../../translations/es.json';
import PrenatalSupplementation from './prenatal-supplementation.component';

vi.mock('react-i18next', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('react-i18next');
});
vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  useOpenmrsFetchAll: (await import('../../../../../../../libs/esm-react-utils/src/useOpenmrsFetchAll'))
    .useOpenmrsFetchAll,
}));
vi.mock('../../../../hooks/useCurrentPregnancy', () => ({
  useCurrentPregnancy: () => ({ pregnancyStartDate: '2026-01-01', isLoading: false, error: null }),
}));

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue({
    supplementation: {
      folicAcidConceptUuid: 'synthetic-folic',
      ironConceptUuid: 'synthetic-iron-folic',
      calciumConceptUuid: 'synthetic-calcium',
    },
  });
});

async function renderWidget(language: 'en' | 'es') {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: false,
    defaultNS: 'other-module',
    resources: {
      en: { '@sihsalus/esm-salud-materna-app': en, '@sihsalus/esm-patient-chart-app': chartEn },
      es: { '@sihsalus/esm-salud-materna-app': es, '@sihsalus/esm-patient-chart-app': chartEs },
    },
    interpolation: { escapeValue: false },
  });
  render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <I18nextProvider i18n={i18n} defaultNS="other-module">
        <PrenatalSupplementation patientUuid="synthetic-mother" />
      </I18nextProvider>
    </SWRConfig>,
  );
}

describe.each(['en', 'es'] as const)('Prenatal indications (%s)', (language) => {
  const messages = language === 'en' ? en : es;

  it('shows tablet indications and a recorded zero without implying dispensing or adherence', async () => {
    vi.mocked(openmrsFetch).mockImplementation(async (url) => {
      const concept = new URL(String(url), 'https://example.test').searchParams.get('concept');
      return {
        data: {
          results:
            concept === 'synthetic-calcium'
              ? []
              : [
                  {
                    uuid: 'synthetic-indication',
                    value: concept === 'synthetic-folic' ? 0 : 30,
                    obsDatetime: '2026-06-01',
                  },
                ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>;
    });
    await renderWidget(language);
    expect(await screen.findByText(messages.prenatalIndicatedTablets_other.replace('{{count}}', '30'))).toBeVisible();
    expect(screen.getByText(messages.prenatalIndicatedTablets_other.replace('{{count}}', '0'))).toBeVisible();
    expect(screen.getByText(messages.prenatalIronFolicAcid)).toBeVisible();
    expect(screen.getByText(messages.prenatalFolicAcid)).toBeVisible();
    expect(screen.getByText(messages.maternalNoRecordedForms)).toBeVisible();
    expect(screen.getByText(messages.prenatalIndicationsHelp)).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/%|30\/180|0\/90/)).not.toBeInTheDocument();
  });

  it('shows the shared empty state when no indication is recorded', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: { results: [] } } as Awaited<ReturnType<typeof openmrsFetch>>);
    await renderWidget(language);
    expect(await screen.findByText(new RegExp(messages.prenatalSupplementIndications))).toBeVisible();
    expect(
      screen.queryByText(messages.prenatalIndicatedTablets_other.replace('{{count}}', '0')),
    ).not.toBeInTheDocument();
  });

  it('shows loading while a later page is pending, then an error without a partial quantity', async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise<Awaited<ReturnType<typeof openmrsFetch>>>((_, fail) => {
      reject = fail;
    });
    vi.mocked(openmrsFetch).mockImplementation(async (url) => {
      if (String(url).includes('startIndex=100')) return pending;
      return {
        data: {
          results: [{ uuid: 'synthetic-partial', value: 30, obsDatetime: '2026-06-01' }],
          links: [{ rel: 'next', uri: 'https://example.test/openmrs/ws/rest/v1/obs?startIndex=100' }],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>;
    });
    await renderWidget(language);
    await waitFor(() =>
      expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('startIndex=100'))).toBe(true),
    );
    expect(screen.getByRole('progressbar', { name: messages.loadingData })).toBeVisible();
    reject(new Error('Synthetic private page failure'));
    expect(await screen.findByRole('heading', { name: messages.prenatalSupplementation })).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.prenatalIndicatedTablets_other.replace('{{count}}', '30')),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Synthetic private page failure/)).not.toBeInTheDocument();
  });
});
