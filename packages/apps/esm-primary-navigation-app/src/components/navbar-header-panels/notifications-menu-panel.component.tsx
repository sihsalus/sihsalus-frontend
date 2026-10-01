import { HeaderPanel, type HeaderPanelProps } from '@carbon/react';
import { ExtensionSlot } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type useDoctorResults } from '../../doctor-results.resource';
import { DoctorResultsPanel } from './doctor-results.component';

import styles from './notifications-menu.panel.scss';

interface NotificationsMenuPanelProps extends HeaderPanelProps {
  expanded: boolean;
  inbox?: ReturnType<typeof useDoctorResults>;
  offset?: number;
  setOffset?: (offset: number) => void;
}

const NotificationsMenuPanel: React.FC<NotificationsMenuPanelProps> = ({
  expanded,
  inbox,
  offset = 0,
  setOffset = () => undefined,
}) => {
  const { t } = useTranslation();
  const state = useMemo(() => ({ expanded }), [expanded]);

  return (
    <HeaderPanel
      className={inbox?.allowed ? styles.resultPanel : undefined}
      aria-label={t('notifications', 'Notifications')}
      expanded={expanded}
    >
      <h1 className={styles.heading}>{t('notifications', 'Notifications')}</h1>
      {inbox ? <DoctorResultsPanel inbox={inbox} offset={offset} setOffset={setOffset} /> : null}
      <ExtensionSlot name="notifications-nav-menu-slot" state={state} />
    </HeaderPanel>
  );
};

export default NotificationsMenuPanel;
