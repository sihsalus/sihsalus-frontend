import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, render, screen, within } from '@testing-library/react';
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
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <I18nextProvider i18n={i18n} defaultNS="other-module">
          <MaternalNtsCompliance patientUuid="synthetic-mother" />
        </I18nextProvider>
      </SWRConfig>,
    );
  });
}

it.each([
  ['en', en, /Feb/],
  ['es', es, /feb/],
] as const)('shows maternal record availability in %s inside a shared slot', async (language, messages, dateMonth) => {
  await renderWithLanguage(language);
  expect(await screen.findByText(messages['maternal-historyLabel'])).toBeVisible();
  expect(screen.getByText(messages['maternal-historyDescription'])).toBeVisible();
  expect(screen.getByText(messages['maternal-historySection'])).toBeVisible();
  expect(screen.getByText(dateMonth)).toBeVisible();
  expect(screen.queryByText('maternal-historyLabel')).not.toBeInTheDocument();
  const history = screen.getByText(messages['maternal-historyLabel']).closest('li');
  expect(within(history!).getByText(messages.maternalRecordAvailable)).toBeVisible();
  expect(screen.getByText(messages.maternalRecordsHelp)).toBeVisible();
  expect(screen.queryByText(messages.completed, { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  expect(screen.getAllByText(messages.maternalFormNotConfigured)).toHaveLength(20);
});

it('does not treat a record from before the current pregnancy as available', async () => {
  vi.mocked(useCurrentPregnancy).mockReturnValue({
    pregnancyStartDate: '2026-03-01',
    isLoading: false,
    error: null,
  } as ReturnType<typeof useCurrentPregnancy>);
  await renderWithLanguage('es');
  const history = (await screen.findByText(es['maternal-historyLabel'])).closest('li');
  expect(within(history!).getByText(es.maternalRecordMissing)).toBeVisible();
  expect(screen.queryByText(es.maternalRecordAvailable)).not.toBeInTheDocument();
});

it('does not report missing records when the pregnancy cannot be loaded', async () => {
  vi.mocked(useCurrentPregnancy).mockReturnValue({
    isLoading: false,
    error: new Error('synthetic failure'),
  } as ReturnType<typeof useCurrentPregnancy>);
  await renderWithLanguage('es');
  expect(screen.getByText(es.maternalRecordsLoadError)).toBeVisible();
  expect(screen.queryByText(es.maternalRecordsMissing)).not.toBeInTheDocument();
  expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
});
