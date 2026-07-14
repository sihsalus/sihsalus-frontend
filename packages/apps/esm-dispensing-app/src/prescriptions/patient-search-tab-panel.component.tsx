import { Button, Search, TabPanel } from '@carbon/react';
import { PatientSearchPictogram } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './patient-search-tab-panel.scss';
import PrescriptionsTable from './prescriptions-table.component';

const PatientSearchTabPanel: React.FC = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('');

  return (
    <TabPanel>
      <div className={styles.searchTabPanel}>
        <form
          className={styles.searchBar}
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedSearchTerm(searchTerm.trim());
          }}
        >
          <Search
            closeButtonLabelText={t('clearSearchInput', 'Clear search input')}
            value={searchTerm}
            placeholder={t('patientSearchPlaceholder', 'Ingrese apellidos, nombres, DNI, CE o pasaporte')}
            labelText={t('patientSearchCriteria', 'Apellidos y nombres o documento de identidad')}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            onClear={() => {
              setSearchTerm('');
              setSubmittedSearchTerm('');
            }}
            size="lg"
          />
          <Button kind="secondary" type="submit" disabled={!searchTerm.trim()}>
            {t('search', 'Search')}
          </Button>
        </form>
        {submittedSearchTerm ? (
          <PrescriptionsTable
            loadData={true}
            status={'ACTIVE'}
            debouncedSearchTerm={submittedSearchTerm}
            locations={[]}
          />
        ) : (
          <div className={styles.searchForPatientPlaceholder}>
            <div>
              <PatientSearchPictogram />
              <h5>{t('searchForPatientHeader', 'Search for a patient')}</h5>
              <div>{t('patientSearchPlaceholder', 'Ingrese apellidos, nombres, DNI, CE o pasaporte')}</div>
            </div>
          </div>
        )}
      </div>
    </TabPanel>
  );
};

export default PatientSearchTabPanel;
