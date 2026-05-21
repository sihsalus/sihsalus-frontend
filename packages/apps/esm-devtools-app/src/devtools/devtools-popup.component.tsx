import { IconButton } from '@carbon/react';
import { CloseIcon, getCoreTranslation } from '@openmrs/esm-framework';

import styles from './devtools-popup.styles.scss';
import ImportMap from './import-map.component';

type DevToolsPopupProps = {
  close: () => void;
  toggleOverridden: (isOverridden: boolean) => void;
};

function DevToolsPopup(props: DevToolsPopupProps) {
  return (
    <div className={styles.popup}>
      <ImportMap toggleOverridden={props.toggleOverridden} />
      <div className={styles.farRight}>
        <IconButton kind="ghost" label={getCoreTranslation('close')} onClick={props.close} size="sm">
          <CloseIcon size={16} />
        </IconButton>
      </div>
    </div>
  );
}

export default DevToolsPopup;
