import { ConfigurableLink, getPatientName, PatientPhoto, useConfig } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { forwardRef, useCallback, useContext, useMemo } from 'react';

import { type PatientSearchConfig } from '../config-schema';
import { PatientSearchContext } from '../patient-search-context';
import {
  getSearchedPatientDisplayName,
  mapSearchedPatientToFhir,
} from '../patient-search-result.utils';
import { SihsalusPatientInfo } from '../sihsalus-patient-info/sihsalus-patient-info.component';
import type { SearchedPatient } from '../types';

import styles from './compact-patient-banner.scss';

interface ClickablePatientContainerProps {
  children: React.ReactNode;
  patient: SearchedPatient;
}

interface CompactPatientBannerProps {
  patients: Array<SearchedPatient>;
}

const CompactPatientBanner = forwardRef<HTMLDivElement, CompactPatientBannerProps>(({ patients }, ref) => {
  const fhirMappedPatients = useMemo(() => patients.map(mapSearchedPatientToFhir), [patients]);

  const renderPatient = useCallback(
    (patient: fhir.Patient & { id: string }, index: number) => {
      const patientName = getPatientName(patient);

      return (
        <ClickablePatientContainer key={patient.id} patient={patients[index]}>
          <div className={styles.patientAvatar} role="img">
            <PatientPhoto patientUuid={patient.id} patientName={patientName} />
          </div>
          <SihsalusPatientInfo patient={patient} renderedFrom="patient-search" />
        </ClickablePatientContainer>
      );
    },
    [patients],
  );

  return <div ref={ref}>{fhirMappedPatients.map((patient, index) => renderPatient(patient, index))}</div>;
});

const ClickablePatientContainer = ({ patient, children }: ClickablePatientContainerProps) => {
  const { nonNavigationSelectPatientAction, patientClickSideEffect } = useContext(PatientSearchContext);
  const config = useConfig<PatientSearchConfig>();
  const isDeceased = Boolean(patient?.person?.dead || patient?.person?.deathDate);

  if (nonNavigationSelectPatientAction) {
    return (
      <button
        aria-label={getSearchedPatientDisplayName(patient)}
        type="button"
        className={classNames(styles.patientSearchResult, styles.patientSearchResultButton, {
          [styles.deceased]: isDeceased,
        })}
        onClick={() => {
          nonNavigationSelectPatientAction(patient.uuid);
          patientClickSideEffect?.(patient.uuid);
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <ConfigurableLink
      aria-label={getSearchedPatientDisplayName(patient)}
      className={classNames(styles.patientSearchResult, {
        [styles.deceased]: isDeceased,
      })}
      onBeforeNavigate={() => patientClickSideEffect?.(patient.uuid)}
      to={config.search.patientChartUrl}
      templateParams={{ patientUuid: patient.uuid }}
    >
      {children}
    </ConfigurableLink>
  );
};

export default CompactPatientBanner;
