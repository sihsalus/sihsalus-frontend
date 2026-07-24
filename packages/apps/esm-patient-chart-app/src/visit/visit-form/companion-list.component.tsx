import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonSet, InlineLoading, Tile } from '@carbon/react';
import { type CompanionRecord } from './companion.resource';
import styles from './visit-form.scss';

interface CompanionListProps {
  isLoading: boolean;
  onClearCompanion: () => void;
  onRegisterPerson?: () => void;
  onSearchPerson?: () => void;
  required?: boolean;
  selectedCompanion?: CompanionRecord;
}

const CompanionList: React.FC<CompanionListProps> = ({
  isLoading,
  onClearCompanion,
  onRegisterPerson,
  onSearchPerson,
  required = false,
  selectedCompanion,
}) => {
  const { t } = useTranslation();

  return (
    <section>
      <h1 className={styles.sectionTitle}>
        {t('companions', 'Acompañantes')}
        {required ? ' *' : ''}
      </h1>
      <div className={styles.sectionField}>
        {isLoading ? (
          <InlineLoading description={t('loading', 'Loading...')} />
        ) : selectedCompanion ? (
          <Tile className={styles.selectedCompanion}>
            <div>
              <p className={styles.selectedCompanionLabel}>
                {t('selectedCompanionForVisit', 'Acompañante de esta consulta')}
              </p>
              <p>{selectedCompanion.name}</p>
            </div>
            <Button kind="ghost" onClick={onClearCompanion} size="sm" type="button">
              {t('removeCompanionSelection', 'Quitar')}
            </Button>
          </Tile>
        ) : (
          <p>
            {required
              ? t('companionRequiredForMinor', 'Seleccione o registre un acompañante adulto para esta consulta.')
              : t('noCompanionSelected', 'No se ha seleccionado un acompañante para esta consulta')}
          </p>
        )}
        {onSearchPerson || onRegisterPerson ? (
          <ButtonSet className={styles.companionActions} stacked>
            {onSearchPerson ? (
              <Button kind="tertiary" onClick={onSearchPerson} size="sm" type="button">
                {t('selectExistingPerson', 'Seleccionar persona existente')}
              </Button>
            ) : null}
            {onRegisterPerson ? (
              <Button kind="ghost" onClick={onRegisterPerson} size="sm" type="button">
                {t('registerNewPerson', 'Registrar nueva persona')}
              </Button>
            ) : null}
          </ButtonSet>
        ) : null}
      </div>
    </section>
  );
};

export default CompanionList;
