import {
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
} from '@carbon/react';
import { formatDatetime, parseDate } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type FormattedEncounter } from '../../types/index';
import styles from '../past-visit.scss';

interface EncounterListProps {
  encounters: Array<FormattedEncounter>;
}

const EncounterList: React.FC<EncounterListProps> = ({ encounters }) => {
  const { t } = useTranslation();

  const formatEncounterDatetime = (datetime?: string) => {
    if (!datetime) {
      return '--';
    }
    try {
      return formatDatetime(parseDate(datetime), { mode: 'wide' });
    } catch {
      return '--';
    }
  };

  const structuredListBodyRowGenerator = () => {
    return encounters.map((encounter) => (
      <StructuredListRow key={encounter.id || `${encounter.datetime}-${encounter.encounterType}`}>
        <StructuredListCell>{formatEncounterDatetime(encounter.datetime)}</StructuredListCell>
        <StructuredListCell className={styles.textColor}>{encounter.encounterType}</StructuredListCell>
        <StructuredListCell>{encounter.provider}</StructuredListCell>
      </StructuredListRow>
    ));
  };

  if (encounters?.length) {
    return (
      <div className={styles.encounterListContainer}>
        <StructuredListWrapper>
          <StructuredListHead>
            <StructuredListRow head>
              <StructuredListCell head>{t('date&Time', 'Date & time')}</StructuredListCell>
              <StructuredListCell head>{t('encounterType', 'Encounter type')}</StructuredListCell>
              <StructuredListCell head>{t('provider', 'Provider')}</StructuredListCell>
            </StructuredListRow>
          </StructuredListHead>
          <StructuredListBody>{structuredListBodyRowGenerator()}</StructuredListBody>
        </StructuredListWrapper>
      </div>
    );
  }

  return (
    <p className={classNames(styles.bodyLong01, styles.text02)}>{t('noEncountersFound', 'No encounters found')}</p>
  );
};

export default EncounterList;
