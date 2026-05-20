import { ExtensionSlot } from '@openmrs/esm-framework';

import styles from './index.scss';

export const SystemAdministrationDashboard = () => {
  return (
    <div className={styles.systemAdminPage}>
      <div className={styles.breadcrumbsContainer}>
        <ExtensionSlot name="breadcrumbs-slot" />
      </div>
      <div className={styles.cardsView}>
        <ExtensionSlot className={styles.cardLinks} name="system-admin-page-card-link-slot" />
      </div>
    </div>
  );
};
