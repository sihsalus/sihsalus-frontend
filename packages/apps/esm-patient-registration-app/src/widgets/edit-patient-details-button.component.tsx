import { navigate } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../constants';

interface EditPatientDetailsButtonProps {
  onTransition?: () => void;
  patientUuid: string;
}

const EditPatientDetailsButton: React.FC<EditPatientDetailsButtonProps> = ({ patientUuid, onTransition }) => {
  const { t } = useTranslation(moduleName);
  const handleClick = React.useCallback(() => {
    navigate({ to: `${globalThis.spaBase}/patient/${patientUuid}/edit` });
    onTransition && onTransition();
  }, [onTransition, patientUuid]);

  return (
    <li className="cds--overflow-menu-options__option">
      <button
        className="cds--overflow-menu-options__btn"
        type="button"
        role="menuitem"
        title={t('editPatientDetails', 'Edit patient details')}
        data-floating-menu-primary-focus
        onClick={handleClick}
      >
        <span className="cds--overflow-menu-options__option-content">
          {t('editPatientDetails', 'Edit patient details')}
        </span>
      </button>
    </li>
  );
};

export default EditPatientDetailsButton;
