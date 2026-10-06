import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { SWRConfig } from 'swr';
import en from '../../../translations/en.json';
import es from '../../../translations/es.json';
import { useCurrentPregnancy } from '../../hooks/useCurrentPregnancy';
import MaternalNtsCompliance from './maternal-nts-compliance.component';

vi.mock('react-i18next', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('react-i18next');
});
vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../hooks/useCurrentPregnancy', () => ({
  useCurrentPregnancy: vi.fn(),
}));

const namespace = '@sihsalus/esm-salud-materna-app';

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue({
    formsList: { maternalHistory: 'synthetic-maternal-history' },
  });
  vi.mocked(useCurrentPregnancy).mockReturnValue({
    pregnancyStartDate: '2026-01-01',
    isLoading: false,
    error: null,
  } as ReturnType<typeof useCurrentPregnancy>);
  vi.mocked(openmrsFetch).mockResolvedValue({
    data: {
      results: [
        {
          uuid: 'synthetic-encounter',
          encounterDatetime: '2026-02-03T12:00:00Z',
          form: { uuid: 'synthetic-maternal-history' },
        },
      ],
    },
  } as Awaited<ReturnType<typeof openmrsFetch>>);
});

async function renderWithLanguage(language: 'en' | 'es') {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: false,
    defaultNS: 'other-module',
    resources: { en: { [namespace]: en }, es: { [namespace]: es } },
    interpolation: { escapeValue: false },
  });
  render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <I18nextProvider i18n={i18n} defaultNS="other-module">
        <MaternalNtsCompliance patientUuid="synthetic-mother" />
      </I18nextProvider>
    </SWRConfig>,
  );
}

it.each([
  ['en', en, /Feb/],
  ['es', es, /feb/],
] as const)('shows the NTS panel in %s inside a shared slot', async (language, messages, dateMonth) => {
  await renderWithLanguage(language);
  expect(await screen.findByText(messages['maternal-historyLabel'])).toBeVisible();
  expect(screen.getByText(messages['maternal-historyDescription'])).toBeVisible();
  expect(screen.getByText(messages['maternal-historySection'])).toBeVisible();
  expect(screen.getByText(dateMonth)).toBeVisible();
  expect(screen.queryByText('maternal-historyLabel')).not.toBeInTheDocument();
});
