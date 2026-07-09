import { ConfigurableLink } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { spaBasePath } from '../constants';

const QueueScreenLink = () => {
  const { t } = useTranslation();
  return (
    <ConfigurableLink to={`${spaBasePath}/service-queues/screen`}>{t('queueScreen', 'Queue screen')}</ConfigurableLink>
  );
};

export default QueueScreenLink;
