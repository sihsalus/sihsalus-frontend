import { Button, Layer, Tile } from '@carbon/react';
import { UserFollow } from '@carbon/react/icons';
import { navigate, UserHasAccess } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { isValidSearchedPatient } from '../patient-search-result.utils';
import { type SearchedPatient } from '../types';
import EmptyDataIllustration from '../ui-components/empty-data-illustration.component';

import PatientBanner, { PatientBannerSkeleton } from './patient-banner/banner/patient-banner.component';
import styles from './patient-search-lg.scss';

interface PatientSearchResultsProps {
  searchResults: SearchedPatient[];
}

interface EmptyStateProps {
  showAddPatient?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ showAddPatient = true }) => {
  const { t } = useTranslation();
  const goToPatientRegistration = React.useCallback(() => {
    navigate({ to: `${globalThis.getOpenmrsSpaBase()}patient-registration` });
  }, []);

  return (
    <Layer>
      <Tile className={styles.emptySearchResultsTile}>
        <EmptyDataIllustration />
        <p className={styles.emptyResultText}>
          {t('noPatientChartsFoundMessage', 'Sorry, no patient charts were found')}
        </p>
        <p className={styles.actionText}>
          <span>{t('trySearchWithPatientUniqueID', "Try to search again using the patient's unique ID number")}</span>
        </p>
        {showAddPatient ? (
          <UserHasAccess privilege="app:opciones.registrarPaciente">
            <Button
              className={styles.addPatientButton}
              kind="primary"
              renderIcon={UserFollow}
              onClick={goToPatientRegistration}
            >
              {t('addPatient', 'Agregar paciente')}
            </Button>
          </UserHasAccess>
        ) : null}
      </Tile>
    </Layer>
  );
};

export const LoadingState: React.FC = () => {
  return (
    <div className={styles.results}>
      <PatientBannerSkeleton />
      <PatientBannerSkeleton />
      <PatientBannerSkeleton />
      <PatientBannerSkeleton />
      <PatientBannerSkeleton />
    </div>
  );
};

export const ErrorState: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Layer>
      <Tile className={styles.emptySearchResultsTile}>
        <EmptyDataIllustration />
        <div>
          <p className={styles.errorMessage}>{t('error', 'Error')}</p>
          <p className={styles.errorCopy}>
            {t(
              'errorCopy',
              'Sorry, there was an error. Please try again or contact the site administrator.',
            )}
          </p>
        </div>
      </Tile>
    </Layer>
  );
};

export const PatientSearchResults: React.FC<PatientSearchResultsProps> = ({ searchResults }) => {
  const validSearchResults = searchResults.filter(isValidSearchedPatient);

  return (
    <div data-openmrs-role="Search Results">
      {validSearchResults.map((patient) => (
        <PatientBanner key={patient.uuid} patientUuid={patient.uuid} patient={patient} />
      ))}
    </div>
  );
};
