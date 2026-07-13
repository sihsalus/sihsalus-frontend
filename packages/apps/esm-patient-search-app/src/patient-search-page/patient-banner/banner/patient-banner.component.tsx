import { SkeletonIcon, SkeletonText } from '@carbon/react';
import {
  ConfigurableLink,
  ExtensionSlot,
  PatientBannerActionsMenu,
  PatientBannerContactDetails,
  PatientBannerToggleContactDetailsButton,
  PatientPhoto,
  useConfig,
  useLayoutType,
  useVisit,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { type PatientSearchConfig } from '../../../config-schema';
import { PatientSearchContext, usePatientSearchContext2 } from '../../../patient-search-context';
import { SihsalusPatientInfo } from '../../../sihsalus-patient-info/sihsalus-patient-info.component';
import { type FHIRPatientType, type SearchedPatient } from '../../../types';

import styles from './patient-banner.scss';

interface ClickablePatientContainerProps {
  children: React.ReactNode;
  patient: fhir.Patient;
  patientUuid: string;
}

interface PatientBannerProps {
  patient: SearchedPatient;
  patientUuid: string;
  hideActionsOverflow?: boolean;
}

const getGender = (gender: string) => {
  switch (gender) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
      return 'other';
    case 'U':
      return 'unknown';
    default:
      return gender;
  }
};

const PatientBanner: React.FC<PatientBannerProps> = ({
  patient,
  patientUuid,
  hideActionsOverflow: hideActionsOverflowProp,
}) => {
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const { activeVisit, currentVisit } = useVisit(patientUuid);
  const effectiveVisit = currentVisit ?? activeVisit;
  const { nonNavigationSelectPatientAction } = useContext(PatientSearchContext);
  const patientSearchContext2 = usePatientSearchContext2();
  const hideActionsOverflow = hideActionsOverflowProp ?? Boolean(patientSearchContext2?.onPatientSelected);

  const patientName = patient.person.personName.display;
  const isDeceased = !!patient.person.deathDate;

  const [showContactDetails, setShowContactDetails] = useState(false);

  const handleToggleContactDetails = useCallback(() => {
    setShowContactDetails((value) => !value);
  }, []);

  const fhirMappedPatient: FHIRPatientType = useMemo(() => {
    const preferredAddress = patient.person.addresses?.find((address) => address.preferred);
    const addressId = uuidv4();
    const nameId = uuidv4();

    return {
      address: preferredAddress
        ? [
            {
              id: addressId,
              city: preferredAddress.cityVillage,
              country: preferredAddress.country,
              state: preferredAddress.stateProvince,
              use: 'home',
            },
          ]
        : [],
      birthDate: patient.person.birthdate,
      deceasedBoolean: patient.person.dead,
      deceasedDateTime: patient.person.deathDate,
      gender: getGender(patient.person.gender),
      id: patient.uuid,
      identifier: patient.identifiers.map((identifier) => ({
        id: identifier.uuid,
        type: {
          coding: [
            {
              code: identifier.identifierType.uuid,
            },
          ],
          text: identifier.identifierType.display,
        },
        use: 'official',
        value: identifier.identifier,
      })),
      name: [
        {
          family: [patient.person.personName.familyName, patient.person.personName.familyName2]
            .filter(Boolean)
            .join(' '),
          given: [patient.person.personName.givenName, patient.person.personName.middleName],
          id: nameId,
          text: patient.person.personName.display,
        },
      ],
      telecom: patient.attributes?.filter((attribute) => attribute.attributeType.display === 'Telephone Number'),
    };
  }, [patient]);

  const handleSelectPatient = useCallback(
    (selectedPatientUuid: string) => {
      if (patientSearchContext2?.onPatientSelected) {
        patientSearchContext2.onPatientSelected(
          selectedPatientUuid,
          fhirMappedPatient,
          patientSearchContext2.launchChildWorkspace,
          patientSearchContext2.closeWorkspace,
        );
        return;
      }

      nonNavigationSelectPatientAction?.(selectedPatientUuid);
    },
    [fhirMappedPatient, nonNavigationSelectPatientAction, patientSearchContext2],
  );
  const selectPatientAction =
    nonNavigationSelectPatientAction || patientSearchContext2?.onPatientSelected ? handleSelectPatient : undefined;
  const startVisitButtonSlotName = patientSearchContext2?.startVisitWorkspaceName
    ? 'start-visit-button-slot2'
    : 'start-visit-button-slot';
  const startVisitButtonSlotState = patientSearchContext2?.startVisitWorkspaceName
    ? {
        patient: fhirMappedPatient,
        patientUuid,
        launchChildWorkspace: patientSearchContext2.launchChildWorkspace,
        startVisitWorkspaceName: patientSearchContext2.startVisitWorkspaceName,
        startVisitWorkspaceProps: {
          ...patientSearchContext2.startVisitWorkspaceProps,
          onQueueEntryAdded: () => {
            void patientSearchContext2.closeWorkspace({ closeWindow: true, discardUnsavedChanges: true });
          },
        },
      }
    : {
        patientUuid,
      };

  return (
    <>
      <div
        className={classNames(styles.container, {
          [styles.deceasedPatientContainer]: isDeceased,
          [styles.activePatientContainer]: !isDeceased,
        })}
        role="banner"
      >
        <ClickablePatientContainer patient={fhirMappedPatient} patientUuid={patientUuid}>
          <div className={styles.patientAvatar} role="img">
            <PatientPhoto patientUuid={patientUuid} patientName={patientName} />
          </div>
          <SihsalusPatientInfo patient={fhirMappedPatient} renderedFrom="patient-search" />
        </ClickablePatientContainer>
        <div className={styles.actionButtons}>
          <PatientBannerToggleContactDetailsButton
            className={styles.toggleContactDetailsButton}
            showContactDetails={showContactDetails}
            toggleContactDetails={handleToggleContactDetails}
          />
          <div className={styles.rightActions}>
            {!hideActionsOverflow ? (
              <PatientBannerActionsMenu
                actionsSlotName="patient-search-actions-slot"
                additionalActionsSlotState={{
                  selectPatientAction,
                  launchPatientChart: true,
                }}
                patient={fhirMappedPatient}
                patientUuid={patientUuid}
              />
            ) : null}
            {!isDeceased && !effectiveVisit && (
              <ExtensionSlot name={startVisitButtonSlotName} state={startVisitButtonSlotState} />
            )}
          </div>
        </div>
        <div>
          {showContactDetails && (
            <div
              className={classNames(styles.contactDetails, {
                [styles.deceasedContactDetails]: isDeceased,
                [styles.tabletContactDetails]: isTablet,
              })}
            >
              <PatientBannerContactDetails deceased={isDeceased} patientId={patientUuid} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const ClickablePatientContainer = ({ patient, patientUuid, children }: ClickablePatientContainerProps) => {
  const { nonNavigationSelectPatientAction, patientClickSideEffect } = useContext(PatientSearchContext);
  const patientSearchContext2 = usePatientSearchContext2();
  const config = useConfig<PatientSearchConfig>();

  const handleClick = useCallback(() => {
    if (patientSearchContext2?.onPatientSelected) {
      patientSearchContext2.onPatientSelected(
        patientUuid,
        patient,
        patientSearchContext2.launchChildWorkspace,
        patientSearchContext2.closeWorkspace,
      );
    } else {
      nonNavigationSelectPatientAction?.(patientUuid);
    }
    patientClickSideEffect?.(patientUuid);
  }, [nonNavigationSelectPatientAction, patient, patientClickSideEffect, patientSearchContext2, patientUuid]);

  const handleBeforeNavigate = useCallback(() => {
    patientClickSideEffect?.(patientUuid);
  }, [patientClickSideEffect, patientUuid]);

  if (nonNavigationSelectPatientAction || patientSearchContext2?.onPatientSelected) {
    return (
      <button
        type="button"
        className={classNames(styles.patientBannerButton, styles.patientBanner, {
          [styles.patientAvatarButton]: nonNavigationSelectPatientAction,
        })}
        key={patientUuid}
        onClick={handleClick}
      >
        {children}
      </button>
    );
  } else {
    return (
      <ConfigurableLink
        className={styles.patientBanner}
        onBeforeNavigate={handleBeforeNavigate}
        to={config.search.patientChartUrl}
        templateParams={{ patientUuid: patientUuid }}
      >
        {children}
      </ConfigurableLink>
    );
  }
};

export const PatientBannerSkeleton = () => {
  return (
    <div className={styles.container} role="banner">
      <div className={styles.patientBanner}>
        <SkeletonIcon className={styles.patientAvatar} />
        <div className={classNames(styles.patientNameRow, styles.patientInfo)}>
          <div className={styles.flexRow}>
            <SkeletonText />
          </div>
          <div className={styles.identifiers}>
            <SkeletonText />
          </div>
        </div>
      </div>
      <div className={styles.emptyStateActionButtonsContainer}>
        <SkeletonText />
      </div>
    </div>
  );
};

export default PatientBanner;
