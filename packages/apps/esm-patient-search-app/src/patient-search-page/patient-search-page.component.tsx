import { navigate, useLayoutType } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PatientSearchContext } from '../patient-search-context';
import PatientSearchOverlay from '../patient-search-overlay/patient-search-overlay.component';
import { getPatientSearchReturnUrl } from '../search-return-url';

import AdvancedPatientSearchComponent from './advanced-patient-search.component';
import styles from './patient-search-page.scss';

interface PatientSearchPageComponentProps {}

const PatientSearchPageComponent: React.FC<PatientSearchPageComponentProps> = () => {
  const [searchParams] = useSearchParams();
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const searchQuery = searchParams?.get('query') ?? '';

  // If a user directly falls on openmrs/spa/search?query= in a tablet view.
  // On clicking the <- on the overlay should take the user on the home page.
  // P.S. The user will never be directed to the patient search page (above URL) in a tablet view otherwise.
  const handleCloseOverlay = useCallback(() => {
    navigate({
      to: getPatientSearchReturnUrl(),
    });
    globalThis.sessionStorage.removeItem('searchReturnUrl');
  }, []);

  if (isTablet) {
    return <PatientSearchOverlay onClose={handleCloseOverlay} query={searchQuery} />;
  }

  return (
    <div className={styles.patientSearchPage}>
      <div className={styles.patientSearchComponent}>
        <PatientSearchContext.Provider value={{}}>
          <AdvancedPatientSearchComponent inTabletOrOverlay={isTablet} query={searchQuery} stickyPagination />
        </PatientSearchContext.Provider>
      </div>
    </div>
  );
};

export default PatientSearchPageComponent;
