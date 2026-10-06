import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import en from '../../../translations/en.json';
import es from '../../../translations/es.json';
import PatientObservationGroupTable from './patient-observation-group-table.component';

vi.mock('react-i18next', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('react-i18next');
});

const mockUseFilteredEncounter = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-framework', () => ({
  AddIcon: () => null,
  formatDate: () => '05/10/2026',
  isDesktop: () => true,
  launchWorkspace2: vi.fn(),
  useLayoutType: () => 'desktop',
  useSession: () => ({ user: {} }),
  userHasAccess: () => false,
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const { createElement } = await import('react');
  return {
    CardHeader: ({ title, children }: { title: string; children?: React.ReactNode }) =>
      createElement('div', null, title, children),
    EmptyState: () => null,
    ErrorState: () => null,
    useFilteredEncounter: mockUseFilteredEncounter,
  };
});

vi.mock('./observation-group-details.component', () => ({ default: () => null }));

const namespace = '@sihsalus/esm-cred-app';

async function renderTable(language: 'en' | 'es', observationCount: number) {
  mockUseFilteredEncounter.mockReturnValue({
    prenatalEncounter: {
      uuid: 'synthetic-encounter',
      encounterDatetime: '2026-10-05T10:00:00Z',
      obs: [
        {
          uuid: 'synthetic-group',
          display: 'Growth: Follow-up',
          groupMembers: Array.from({ length: observationCount }, (_, index) => ({
            uuid: `synthetic-observation-${index}`,
            display: `Measurement ${index + 1}: Recorded`,
          })),
        },
      ],
    },
    isLoading: false,
    error: null,
    mutate: vi.fn(),
  });

  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: false,
    defaultNS: 'other-module',
    resources: { en: { [namespace]: en }, es: { [namespace]: es } },
    interpolation: { escapeValue: false },
  });

  render(
    <I18nextProvider i18n={i18n} defaultNS="other-module">
      <PatientObservationGroupTable
        patientUuid="synthetic-child"
        headerTitle="Synthetic observations"
        displayText="Synthetic observations"
        encounterType="synthetic-encounter-type"
        formUuid="synthetic-form"
      />
    </I18nextProvider>,
  );
}

describe.each([
  ['en', 1, '1 observation', 'Date of care'],
  ['en', 2, '2 observations', 'Date of care'],
  ['es', 1, '1 observación', 'Fecha de atención'],
  ['es', 2, '2 observaciones', 'Fecha de atención'],
] as const)('CRED observation groups (%s, count %i)', (language, count, expectedCount, expectedDate) => {
  it('shows a translated count and only the populated columns', async () => {
    await renderTable(language, count);

    expect(screen.getByText(expectedCount)).toBeVisible();
    expect(screen.getByRole('columnheader', { name: expectedDate })).toBeVisible();
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
  });
});
