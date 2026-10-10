import { FormsSelectorWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import en from '../../../translations/en.json';
import es from '../../../translations/es.json';

vi.mock('react-i18next', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('react-i18next');
});
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-framework')>()),
  Workspace2: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

it.each([
  ['es', '@sihsalus/esm-cred-app', es, 'Cerrar formularios'],
  ['en', '@sihsalus/esm-cred-app', en, 'Close forms'],
] as const)(
  'labels the selection close action truthfully in %s for %s',
  async (language, namespace, translations, label) => {
    const i18n = createInstance();
    await i18n.use(initReactI18next).init({
      lng: language,
      fallbackLng: false,
      defaultNS: namespace,
      resources: { [language]: { [namespace]: translations } },
      interpolation: { escapeValue: false },
    });
    render(
      <I18nextProvider i18n={i18n} defaultNS={namespace}>
        <FormsSelectorWorkspace
          availableForms={[]}
          patientAge=""
          controlNumber={0}
          patientUuid="synthetic-patient"
          onFormLaunch={vi.fn()}
          closeWorkspace={vi.fn()}
          closeWorkspaceWithSavedChanges={vi.fn()}
          promptBeforeClosing={vi.fn()}
          setTitle={vi.fn()}
        />
      </I18nextProvider>,
    );
    expect(screen.getByRole('button', { name: label })).toBeVisible();
    expect(screen.queryByRole('button', { name: /firmar|sign|save|guardar/i })).not.toBeInTheDocument();
  },
);
