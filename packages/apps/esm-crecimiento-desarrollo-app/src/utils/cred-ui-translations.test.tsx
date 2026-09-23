import { userHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import en from '../../translations/en.json';
import es from '../../translations/es.json';
import chartEn from '../../../esm-patient-chart-app/translations/en.json';
import chartEs from '../../../esm-patient-chart-app/translations/es.json';
import SlotPlaceholder from '../ui/slot-placeholder/slot-placeholder.component';
import AdverseReactionsSummary from '../well-child-care/components/adverse-reactions-summary/adverse-reactions-summary.component';
import AnemiaScreening from '../well-child-care/components/anemia-screening/anemia-screening.component';
import CredTile from '../well-child-care/components/cred-controls-timeline/cred-tile';

vi.mock('react-i18next', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('react-i18next');
});
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  usePatient: () => ({ patientUuid: 'synthetic-child' }),
  useSession: () => ({ user: {} }),
  useConfig: () => ({}),
  userHasAccess: vi.fn(() => true),
}));
vi.mock('../hooks/useAnemiaScreening', () => ({
  useAnemiaScreening: () => ({
    lastHb: null,
    lastDate: null,
    nextDueDate: null,
    isLoading: false,
  }),
}));
vi.mock('../hooks/useCREDFormLauncher', () => ({
  useCREDFormLauncher: () => ({ launchForm: vi.fn(), isLoading: false }),
}));
vi.mock('../well-child-care/workspace/adverse-reaction/adverse-reaction.resource', () => ({
  useAdverseReactions: () => ({ reactions: [], isLoading: false }),
}));

const namespace = '@sihsalus/esm-cred-app';

async function renderInSharedSlot(ui: React.ReactElement, language: 'en' | 'es') {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: false,
    defaultNS: 'other-module',
    resources: {
      en: { [namespace]: en, '@sihsalus/esm-patient-chart-app': chartEn },
      es: { [namespace]: es, '@sihsalus/esm-patient-chart-app': chartEs },
    },
    interpolation: { escapeValue: false },
  });
  render(
    <I18nextProvider i18n={i18n} defaultNS="other-module">
      {ui}
    </I18nextProvider>,
  );
}

beforeEach(() => vi.mocked(userHasAccess).mockReturnValue(true));

describe.each(['en', 'es'] as const)('CRED UI in a shared slot (%s)', (language) => {
  const messages = language === 'en' ? en : es;

  it('translates control status using the CRED catalog', async () => {
    await renderInSharedSlot(<CredTile controlNumber={1} label="1" status="overdue" />, language);
    expect(screen.getByText(messages.idealAgeSlot)).toBeVisible();
    expect(screen.getByText(messages.statusOverdue)).toBeVisible();
  });

  it('translates missing values and the available action consistently', async () => {
    await renderInSharedSlot(<AnemiaScreening patientUuid="synthetic-child" />, language);
    expect(screen.getByText(messages.anemiaScreening)).toBeVisible();
    expect(screen.getAllByText(messages.noData)).toHaveLength(2);
    expect(screen.getByText(messages.pending)).toBeVisible();
    expect(screen.getByRole('button', { name: messages.add })).toBeVisible();
  });

  it('uses the shared empty state without duplicating the absence message', async () => {
    vi.mocked(userHasAccess).mockReturnValue(false);
    await renderInSharedSlot(<AdverseReactionsSummary />, language);
    const chart = language === 'en' ? chartEn : chartEs;
    expect(
      screen.getByText(chart.emptyStateText.replace('{{displayText}}', messages.adverseReactions.toLowerCase())),
    ).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a readable placeholder instead of translation keys', async () => {
    await renderInSharedSlot(<SlotPlaceholder />, language);
    expect(
      screen.getByRole('heading', {
        name: language === 'en' ? 'Section unavailable' : 'Sección no disponible',
      }),
    ).toBeVisible();
    expect(screen.queryByText('slotComingSoonDescription')).not.toBeInTheDocument();
  });
});
