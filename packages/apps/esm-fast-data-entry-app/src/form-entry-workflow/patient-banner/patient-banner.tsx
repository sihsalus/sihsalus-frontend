import { SkeletonPlaceholder, SkeletonText } from '@carbon/react';
import { ExtensionSlot } from '@openmrs/esm-framework';
import { useContext } from 'react';
import FormWorkflowContext from '../../context/form-workflow-context';
import useGetPatient from '../../hooks/use-get-patient';
import styles from './styles.scss';

const SkeletonPatientInfo = () => {
  return (
    <div className={styles.container}>
      <SkeletonPlaceholder className={styles.photoPlaceholder} />
      <div className={styles.patientInfoContent}>
        <div className={styles.patientInfoRow}>
          <SkeletonText width="7rem" lineCount={1} />
        </div>
        <div className={styles.patientInfoRow}>
          <span>
            <SkeletonText width="1rem" lineCount={1} />
          </span>
          <span>&middot;</span>
          <span>
            <SkeletonText width="1rem" lineCount={1} />
          </span>
          <span>&middot;</span>
          <span>
            <SkeletonText width="1rem" lineCount={1} />
          </span>
        </div>
      </div>
    </div>
  );
};

const PatientBanner = () => {
  const { activePatientUuid, workflowState } = useContext(FormWorkflowContext);
  const patient = useGetPatient(activePatientUuid);

  if (workflowState === 'NEW_PATIENT') return null;

  if (!patient) {
    return <SkeletonPatientInfo />;
  }

  return <Banner patient={patient} hideActionsOverflow />;
};

const Banner = ({ patient, hideActionsOverflow }) => {
  return (
    <div className={styles.patientBannerContainer}>
      <ExtensionSlot
        name="patient-header-slot"
        state={{
          patient,
          patientUuid: patient.id,
          hideActionsOverflow,
        }}
      />
    </div>
  );
};

export default PatientBanner;
