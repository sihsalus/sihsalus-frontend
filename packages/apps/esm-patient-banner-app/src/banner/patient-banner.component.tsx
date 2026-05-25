import {
  getPatientName,
  PatientBannerActionsMenu,
  PatientBannerContactDetails,
  PatientBannerPatientInfo,
  PatientBannerToggleContactDetailsButton,
  PatientPhoto,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './patient-banner.scss';

interface PatientBannerProps {
  patient?: fhir.Patient | null;
  patientUuid: string;
  hideActionsOverflow?: boolean;
}

const tabletViewportMaxWidthInPx = 1023;
const maxDesktopWorkspaceWidthInPx = 520;

const PatientBanner: React.FC<PatientBannerProps> = ({ patient, patientUuid, hideActionsOverflow }) => {
  const patientBannerRef = useRef<HTMLElement>(null);
  const [isTabletViewport, setIsTabletViewport] = useState(false);
  const [showDetailsButtonBelowHeader, setShowDetailsButtonBelowHeader] = useState(false);
  const [showContactDetails, setShowContactDetails] = useState(false);

  useEffect(() => {
    const currentRef = patientBannerRef.current;
    // eslint-disable-next-line no-console -- TODO debug temporal, quitar
    console.debug('[PatientBanner] effect run', { hasPatient: Boolean(patient), hasRef: Boolean(currentRef) });
    if (!currentRef) {
      return;
    }

    const applyWidth = (width: number, source: string) => {
      // eslint-disable-next-line no-console -- TODO debug temporal, quitar
      console.debug('[PatientBanner] width', {
        width,
        source,
        tablet: width < tabletViewportMaxWidthInPx,
        belowHeader: width <= maxDesktopWorkspaceWidthInPx,
      });
      setIsTabletViewport(width < tabletViewportMaxWidthInPx);
      setShowDetailsButtonBelowHeader(width <= maxDesktopWorkspaceWidthInPx);
    };

    // Medición inicial síncrona: el observer no siempre dispara al conectar.
    applyWidth(currentRef.getBoundingClientRect().width, 'initial');

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        applyWidth(entry.contentRect.width, 'observer');
      }
    });
    resizeObserver.observe(currentRef);
    return () => {
      resizeObserver.disconnect();
    };
    // Depende de `patient`: cuando pasa de null → cargado, el header recién se monta
    // y el effect debe re-correr para enganchar el observer al ref ya existente.
  }, [patient]);

  const patientName = patient ? getPatientName(patient) : '';

  const toggleContactDetails = useCallback(() => {
    setShowContactDetails((value) => {
      // eslint-disable-next-line no-console -- TODO debug temporal, quitar
      console.debug('[PatientBanner] toggleContactDetails', { from: value, to: !value });
      return !value;
    });
  }, []);

  const isDeceased = Boolean(patient?.deceasedDateTime);

  if (!patient) {
    return null;
  }

  return (
    <header
      className={classNames(
        styles.container,
        isDeceased ? styles.deceasedPatientContainer : styles.activePatientContainer,
      )}
      ref={patientBannerRef}
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
        <div
          className={classNames(styles.contactDetails, {
            [styles.deceasedContactDetails]: patient.deceasedBoolean,
            [styles.tabletContactDetails]: isTabletViewport,
          })}
        >
          <PatientBannerContactDetails deceased={isDeceased} patientId={patientUuid} />
        </div>
      )}
    </header>
  );
};

export default PatientBanner;
