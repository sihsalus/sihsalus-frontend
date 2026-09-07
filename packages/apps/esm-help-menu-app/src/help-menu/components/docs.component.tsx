import { Link } from '@carbon/react';
import { ArrowUpRight } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { type ConfigObject, getSafeHelpUrl } from '../../config-schema';
import styles from './styles.scss';

const Docs = () => {
  const { t } = useTranslation();
  const { documentationUrl } = useConfig<ConfigObject>();
  const safeDocumentationUrl = getSafeHelpUrl(documentationUrl);

  if (!safeDocumentationUrl) {
    return null;
  }

  return (
    <Link
      className={styles.helpButton}
      href={safeDocumentationUrl}
      rel="noopener noreferrer"
      renderIcon={ArrowUpRight}
      target="_blank"
    >
      {t('docs', 'Docs')}
    </Link>
  );
};

export default Docs;
