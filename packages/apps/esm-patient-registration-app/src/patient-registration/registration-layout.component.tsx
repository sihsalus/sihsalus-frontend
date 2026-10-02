import { Link } from '@carbon/react';
import { XAxis } from '@carbon/react/icons';
import { isDesktop, PageHeader, PageHeaderContent, RegistrationPictogram, useLayoutType } from '@openmrs/esm-framework';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../constants';
import styles from './patient-registration.scss';

interface RegistrationLayoutProps {
  title: string;
  sections: Array<{ id: string; label: string }>;
  onSectionSelect: (id: string) => void;
  actions: ReactNode;
  auxiliary?: ReactNode;
  children: ReactNode;
}

export function RegistrationLayout({
  title,
  sections,
  onSectionSelect,
  actions,
  auxiliary,
  children,
}: RegistrationLayoutProps) {
  const { t } = useTranslation(moduleName);
  const isDesktopLayout = isDesktop(useLayoutType());

  return (
    <>
      <PageHeader className={styles.registrationHeader}>
        <PageHeaderContent
          title={
            <span role="heading" aria-level={1}>
              {title}
            </span>
          }
          illustration={<RegistrationPictogram />}
        />
      </PageHeader>
      <div className={styles.formContainer}>
        <div className={styles.sidebar}>
          <div className={styles.stickyColumn}>
            {auxiliary}
            {isDesktopLayout && <div className={styles.actionPanel}>{actions}</div>}
            <nav className={styles.sectionNav} aria-label={t('jumpTo', 'Jump to')}>
              <p className={styles.label01}>{t('jumpTo', 'Jump to')}</p>
              {sections.map((section) => (
                <div className={styles.space05} key={section.id}>
                  <Link
                    className={styles.linkName}
                    href={`#${section.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onSectionSelect(section.id);
                    }}
                  >
                    <XAxis size={16} aria-hidden /> {section.label}
                  </Link>
                </div>
              ))}
            </nav>
          </div>
        </div>
        <div className={styles.infoGrid}>{children}</div>
      </div>
      {!isDesktopLayout && <div className={styles.bottomActionPanel}>{actions}</div>}
    </>
  );
}
