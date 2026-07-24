import { ConfigurableLink, getPatientName, PatientPhoto, useConfig } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { forwardRef, useCallback, useContext, useMemo } from 'react';

import { type PatientSearchConfig } from '../config-schema';
import { PatientSearchContext } from '../patient-search-context';
import { mapSearchedPatientToFhir } from '../patient-search-mapper';
import { SihsalusPatientInfo } from '../sihsalus-patient-info/sihsalus-patient-info.component';
import type { FHIRPatientType, SearchedPatient } from '../types';

import styles from './compact-patient-banner.scss';

interface ClickablePatientContainerProps {
  children: React.ReactNode;
  patient: SearchedPatient;
}

interface CompactPatientBannerProps {
  patients: Array<SearchedPatient>;
}

const CompactPatientBanner = forwardRef<HTMLDivElement, CompactPatientBannerProps>(({ patients }, ref) => {
  const fhirMappedPatients: Array<FHIRPatientType> = useMemo(() => {
    // TODO: If/When the online patient search is migrated to the FHIR API at some point, this could
    // be removed. In fact, it could maybe be done at this point already, but doing it when the
    // search returns FHIR objects is much simpler because the code which uses the `fhirPatients`
    // doesn't have to be touched then.
    return patients.map(mapSearchedPatientToFhir);
  }, [patients]);

  const renderPatient = useCallback(
    (patient: FHIRPatientType, index: number) => {
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
        aria-label={patient.person.personName.display}
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
      aria-label={patient.person.personName.display}
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
