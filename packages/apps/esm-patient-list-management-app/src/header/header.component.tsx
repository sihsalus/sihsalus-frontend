import { Button } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { PageHeader, PageHeaderContent, PatientListsPictogram } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './header.scss';

interface HeaderProps {
  canEdit: boolean;
  handleShowNewListOverlay: () => void;
}

const Header: React.FC<HeaderProps> = ({ canEdit, handleShowNewListOverlay }) => {
  const { t } = useTranslation();
  return (
    <PageHeader className={styles.header}>
      <PageHeaderContent title={t('patientLists', 'Patient lists')} illustration={<PatientListsPictogram />} />
      {canEdit && (
        <Button
          className={styles.newListButton}
          data-openmrs-role="New List"
          kind="ghost"
          iconDescription={t('newList', 'New list')}
          renderIcon={(props) => <Add {...props} size={16} />}
          onClick={handleShowNewListOverlay}
          size="sm"
        >
          {t('newList', 'New list')}
        </Button>
      )}
    </PageHeader>
  );
};

export default Header;
