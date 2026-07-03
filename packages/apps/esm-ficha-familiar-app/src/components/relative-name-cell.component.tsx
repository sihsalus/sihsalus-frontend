import { Tag } from '@carbon/react';
import { ConfigurableLink } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface RelativeNameCellProps {
  name: string;
  isPatient: boolean;
  patientUuid: string | null;
  /** Person uuid of the relative; used to offer promotion when they are not a patient. */
  relativeUuid?: string;
  dead?: boolean;
}

/**
 * Name of a related person in the relationship tables. Links to the patient chart only
 * when the relative actually is a Patient; a plain Person (e.g. a responsible adult
 * registered during admission) has no chart to open, so it renders as text with a tag
 * and, while alive, a link to register them as a patient reusing their record
 * (promotion via `patient-registration?promotePerson=<uuid>`).
 */
const RelativeNameCell: React.FC<RelativeNameCellProps> = ({ name, isPatient, patientUuid, relativeUuid, dead }) => {
  const { t } = useTranslation();

  if (isPatient && patientUuid) {
    return (
      <ConfigurableLink
        style={{ textDecoration: 'none' }}
        to={globalThis.getOpenmrsSpaBase() + `patient/${patientUuid}/chart/Patient Summary`}
      >
        {name}
      </ConfigurableLink>
    );
  }

  return (
    <>
      {name}{' '}
      <Tag type="cool-gray" size="sm">
        {t('personWithoutRecord', 'Sin historia clínica')}
      </Tag>
      {relativeUuid && !dead ? (
        <ConfigurableLink to={globalThis.getOpenmrsSpaBase() + `patient-registration?promotePerson=${relativeUuid}`}>
          {t('registerRelativeAsPatient', 'Registrar como paciente')}
        </ConfigurableLink>
      ) : null}
    </>
  );
};

export default RelativeNameCell;
