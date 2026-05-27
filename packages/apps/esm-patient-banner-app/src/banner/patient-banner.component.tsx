import {
  getPatientName,
  PatientBannerActionsMenu,
  PatientBannerPatientInfo,
  PatientBannerToggleContactDetailsButton,
  PatientPhoto,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { PatientBannerContactDetails } from './patient-banner-contact-details.component';
import styles from './patient-banner.scss';

interface PatientBannerProps {
  patient?: fhir.Patient | null;
  patientUuid: string;
  hideActionsOverflow?: boolean;
}

const PatientBanner: React.FC<PatientBannerProps> = ({ patient, patientUuid, hideActionsOverflow }) => {
  const [patientBannerElement, setPatientBannerElement] = useState<HTMLElement | null>(null);
  const [patientBannerWidth, setPatientBannerWidth] = useState<number>();
  const [showContactDetails, setShowContactDetails] = useState(false);

  useEffect(() => {
    if (!patientBannerElement) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPatientBannerWidth(Math.round(entry.contentRect.width));
      }
    });
    resizeObserver.observe(patientBannerElement);

    return () => {
      resizeObserver.unobserve(patientBannerElement);
    };
  }, [patientBannerElement]);

  const patientName = patient ? getPatientName(patient) : '';

  const toggleContactDetails = useCallback(() => {
    setShowContactDetails((value) => !value);
  }, []);

  const isDeceased = Boolean(patient?.deceasedDateTime);
  const isTabletViewport = typeof patientBannerWidth === 'number' && patientBannerWidth < 1023;
  const maxDesktopWorkspaceWidthInPx = 520;
  const showDetailsButtonBelowHeader =
    typeof patientBannerWidth === 'number' && patientBannerWidth <= maxDesktopWorkspaceWidthInPx;

  if (!patient) {
    return null;
  }

  return (
    <header
      className={classNames(
        styles.container,
        isDeceased ? styles.deceasedPatientContainer : styles.activePatientContainer,
      )}
      ref={setPatientBannerElement}
    >
      <div className={styles.patientBanner}>
        <div className={styles.patientAvatar}>
          <PatientPhoto patientUuid={patientUuid} patientName={patientName} />
        </div>
        <PatientBannerPatientInfo patient={patient} renderedFrom="patient-chart" />
        <div className={styles.buttonCol}>
          <div className={styles.buttonRow}>
            {!hideActionsOverflow ? (
              <PatientBannerActionsMenu
                actionsSlotName="patient-actions-slot"
                patient={patient}
                patientUuid={patientUuid}
              />
            ) : null}
          </div>
          {!showDetailsButtonBelowHeader ? (
            <PatientBannerToggleContactDetailsButton
              className={styles.toggleContactDetailsButton}
              showContactDetails={showContactDetails}
              toggleContactDetails={toggleContactDetails}
            />
          ) : null}
        </div>
      </div>
      {showDetailsButtonBelowHeader ? (
        <PatientBannerToggleContactDetailsButton
          className={styles.toggleContactDetailsButton}
          showContactDetails={showContactDetails}
          toggleContactDetails={toggleContactDetails}
        />
      ) : null}
      {showContactDetails && (
        <Suspense fallback={null}>
          <div
            className={classNames(styles.contactDetails, {
              [styles.deceasedContactDetails]: patient.deceasedBoolean,
              [styles.tabletContactDetails]: isTabletViewport,
            })}
          >
            <PatientBannerContactDetails deceased={isDeceased} patientId={patient?.id} />
          </div>
        </Suspense>
      )}
    </header>
  );
};

export default PatientBanner;
