import { InlineNotification } from '@carbon/react';
import { ExtensionSlot, type Location } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import useWardLocation from '../hooks/useWardLocation';
import WardLocationSelector from './ward-location-selector.component';
import { useWardConfig } from './ward-view.resource';
import styles from './ward-view.scss';

const WardView: React.FC<{}> = () => {
  const response = useWardLocation();
  const { isLoadingLocation, invalidLocation, location } = response;
  const { t } = useTranslation();

  if (isLoadingLocation) {
    return <></>;
  }

  if (invalidLocation) {
    return <InlineNotification kind="error" title={t('invalidLocationSpecified', 'Invalid location specified')} />;
  }

  if (!location) {
    return <WardLocationSelector />;
  }

  return <ConfiguredWardView location={location} />;
};

const ConfiguredWardView = ({ location }: { location: Location }) => {
  const wardConfig = useWardConfig(location.uuid);

  const wardId = wardConfig.id;

  return (
    <div className={classNames(styles.wardView, styles.verticalTiling)}>
      <ExtensionSlot name={wardId} />
    </div>
  );
};

export default WardView;
