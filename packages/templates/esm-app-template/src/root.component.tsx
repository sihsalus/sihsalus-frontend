import { useConfig } from '@openmrs/esm-framework';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import { useTranslation } from 'react-i18next';

import type { TemplateConfig } from './config-schema';
import { appName, moduleName } from './constants';
import styles from './root.scss';

export default function Root() {
  const { enabled, title } = useConfig<TemplateConfig>();
  const { t } = useTranslation(moduleName);

  return (
    <AppErrorBoundary appName={appName}>
      <main className={styles.root}>
        <section className={styles.header}>
          <p className={styles.eyebrow}>{t('templateEyebrow', 'SIHSALUS frontend')}</p>
          <h1>{t('templateTitle', title)}</h1>
          <p>{t('templateDescription', 'Replace this placeholder with the module workflow.')}</p>
        </section>

        {enabled ? (
          <section className={styles.content}>
            <p>{t('templateReady', 'The app shell, route, translations and tests are ready.')}</p>
          </section>
        ) : (
          <p className={styles.notice}>{t('templateDisabled', 'This app is disabled by configuration.')}</p>
        )}
      </main>
    </AppErrorBoundary>
  );
}
