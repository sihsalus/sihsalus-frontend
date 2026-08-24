import { Button, Tile } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { EmptyDataIllustration } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './search-empty-state.scss';

type SearchEmptyStateProps = {
  searchValue?: string;
  message: string;
  onAdd?: () => void;
};

const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({ searchValue: _searchValue, message, onAdd }) => {
  const { t } = useTranslation();

  return (
    <Tile className={styles.container}>
      <EmptyDataIllustration height="50" width="50" />
      <p>{t(message)}</p>
      {typeof onAdd === 'function' && (
        <Button kind="ghost" renderIcon={Add} onClick={onAdd}>
          {t('createRelative', 'Crear familiar')}
        </Button>
      )}
    </Tile>
  );
};

export default SearchEmptyState;
