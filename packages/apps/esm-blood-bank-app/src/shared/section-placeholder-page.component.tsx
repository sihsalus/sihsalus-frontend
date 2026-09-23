import { Button, Tag, Tile } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';
import { PageHeader } from '../shared/page-header.component';
import styles from '../styles/app.scss';

interface SectionPlaceholderPageProps {
  title: string;
  description: string;
  primaryAction?: string;
}

export function SectionPlaceholderPage({ title, description, primaryAction = 'Registrar nuevo' }: SectionPlaceholderPageProps) {
  const { t } = useTranslation(moduleName);

  return (
    <div className={styles.page}>
      <PageHeader description={description} title={title} />
      <Tile className={styles.placeholder}>
        <div>
          <Tag type="cyan">{t('screenFoundation', 'Base de pantalla')}</Tag>
          <h2>{title}</h2>
          <p>{t('screenFoundationDescription', 'Este espacio está preparado para añadir los componentes del diseño, validaciones y consumo de API.')}</p>
        </div>
        <Button>{primaryAction === 'Registrar nuevo' ? t('registerNew', primaryAction) : primaryAction}</Button>
      </Tile>
    </div>
  );
}
