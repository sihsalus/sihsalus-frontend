import { usePatient } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import en from '../../translations/en.json';
import es from '../../translations/es.json';
import { PrenatalCare } from './prenatal-care.component';

vi.mock('react-i18next', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('react-i18next');
});
vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  TabbedDashboard: (
    await import('../../../../libs/esm-patient-common-lib/src/tabbed-dashboard/tabbed-dashboard.component')
  ).default,
}));
vi.mock('./components/maternal-nts-compliance.component', () => ({ default: () => null }));

it.each([
  ['es', 'Control prenatal', 'Secciones de control prenatal', 'Antecedentes obstétricos', 'Atención prenatal'],
  ['en', 'Prenatal care', 'Prenatal care sections', 'Obstetric history', 'Prenatal attention'],
] as const)(
  'translates the prenatal dashboard and its accessible tabs in %s',
  async (language, title, tabs, history, attention) => {
    vi.mocked(usePatient).mockReturnValue({
      patient: { resourceType: 'Patient', id: 'synthetic-mother' },
      patientUuid: 'synthetic-mother',
    } as ReturnType<typeof usePatient>);
    const namespace = '@sihsalus/esm-salud-materna-app';
    const i18n = createInstance();
    await i18n.use(initReactI18next).init({
      lng: language,
      fallbackLng: false,
      defaultNS: 'other-module',
      resources: { en: { [namespace]: en }, es: { [namespace]: es } },
      interpolation: { escapeValue: false },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <PrenatalCare />
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: title })).toBeVisible();
    expect(screen.getByRole('tablist', { name: tabs })).toBeVisible();
    expect(screen.getByRole('tab', { name: history })).toBeVisible();
    expect(screen.getByRole('tab', { name: attention })).toBeVisible();
  },
);
