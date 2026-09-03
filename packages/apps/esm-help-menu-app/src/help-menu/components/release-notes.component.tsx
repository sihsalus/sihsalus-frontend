import { Link } from '@carbon/react';
import { ArrowUpRight } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { type ConfigObject, getSafeHelpUrl } from '../../config-schema';
import styles from './styles.scss';

const ReleaseNotes = () => {
  const { t } = useTranslation();
  const { releaseNotesUrl } = useConfig<ConfigObject>();
  const safeReleaseNotesUrl = getSafeHelpUrl(releaseNotesUrl);

  if (!safeReleaseNotesUrl) {
    return null;
  }

  return (
    <Link
      className={styles.helpButton}
      href={safeReleaseNotesUrl}
      rel="noopener noreferrer"
      renderIcon={ArrowUpRight}
      target="_blank"
    >
      {t('releaseNotes', 'Release notes')}
    </Link>
  );
};

export default ReleaseNotes;
