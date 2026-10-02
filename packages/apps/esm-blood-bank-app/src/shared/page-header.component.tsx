import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';
import styles from '../styles/app.scss';

interface PageHeaderProps {
  title: string;
  description: string;
  eyebrow?: string;
}

export function PageHeader({ title, description, eyebrow = 'Banco de Sangre' }: PageHeaderProps) {
  const { t } = useTranslation(moduleName);

  return (
    <header className={styles.pageHeader}>
      <span>{eyebrow === 'Banco de Sangre' ? t('appTitle', eyebrow) : eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
