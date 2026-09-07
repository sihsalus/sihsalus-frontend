import { Link } from '@carbon/react';
import { ArrowUpRight } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { type ConfigObject, getSafeHelpUrl } from '../../config-schema';
import styles from './styles.scss';

const ContactUs = () => {
  const { t } = useTranslation();
  const { supportUrl } = useConfig<ConfigObject>();
  const safeSupportUrl = getSafeHelpUrl(supportUrl);
  const { helpButton } = styles as { helpButton: string };

  if (!safeSupportUrl) {
    return null;
  }

  return (
    <Link
      className={helpButton}
      href={safeSupportUrl}
      rel="noopener noreferrer"
      renderIcon={ArrowUpRight}
      target="_blank"
    >
      {t('support', 'Help and support')}
    </Link>
  );
};

export default ContactUs;
