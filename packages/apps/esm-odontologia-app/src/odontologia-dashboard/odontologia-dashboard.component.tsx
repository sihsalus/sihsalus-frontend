import React from 'react';

import OdontogramDashboard from '../odontogram-dashboard/odontogram-dashboard.component';
import styles from './odontologia-dashboard.scss';

type OdontologiaDashboardProps = {
  patientUuid: string;
};

const OdontologiaDashboard: React.FC<OdontologiaDashboardProps> = ({ patientUuid }) => (
  <div className={styles.page}>
    <section className={styles.section} aria-labelledby="odontologia-odontogram-section-title">
      <OdontogramDashboard patientUuid={patientUuid} />
    </section>
  </div>
);

export default OdontologiaDashboard;
