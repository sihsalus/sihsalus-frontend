import { Link } from '@carbon/react';
import { ArrowUpRight } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './styles.scss';

const ContactUs = () => {
  const { t } = useTranslation();
  const { helpButton } = styles as { helpButton: string };
  return (
    <Link
      className={helpButton}
      href="https://hii1sc.inf.pucp.edu.pe/"
      rel="noopener noreferrer"
      renderIcon={ArrowUpRight}
      target="_blank"
    >
      {t('communityforum', 'Community forum')}
    </Link>
  );
};

export default ContactUs;
