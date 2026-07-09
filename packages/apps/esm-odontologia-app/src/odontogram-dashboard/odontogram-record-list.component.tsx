import { Add } from '@carbon/icons-react';
import { Button, Tag } from '@carbon/react';
import { formatDate } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { OdontogramBaseGroup, OdontogramRecord } from '../types/odontogram-record';
import styles from './odontogram-record-list.scss';

interface OdontogramRecordListProps {
  /** Base groups, oldest→newest (rendered newest-first). */
  groups: OdontogramBaseGroup[];
  vigenteBaseUuid: string | null;
  selectedEncounterUuid: string | null;
  canEdit: boolean;
  onSelectBase: (base: OdontogramRecord) => void;
  onSelectAttention: (attention: OdontogramRecord, base: OdontogramRecord) => void;
  onAddAttention: (base: OdontogramRecord) => void;
}

function fullDateTime(iso: string): string {
  return formatDate(new Date(iso), { mode: 'wide', time: true });
}

const OdontogramRecordList: React.FC<OdontogramRecordListProps> = ({
  groups,
  vigenteBaseUuid,
  selectedEncounterUuid,
  canEdit,
  onSelectBase,
  onSelectAttention,
  onAddAttention,
}) => {
  const { t } = useTranslation();
  const orderedGroups = [...groups].reverse();

  return (
    <nav className={styles.list} aria-label={t('odontogramList', 'Lista de odontogramas')}>
      {orderedGroups.map((group) => {
        const isVigente = group.base.encounterUuid === vigenteBaseUuid;
        const baseSelected = group.base.encounterUuid === selectedEncounterUuid;
        const attentionsNewestFirst = group.attentions
          .map((record, index) => ({ record, number: index + 1 }))
          .reverse();

        return (
          <div key={group.base.encounterUuid} className={styles.group}>
            <button
              type="button"
              className={`${styles.baseRow} ${baseSelected ? styles.selected : ''}`}
              aria-current={baseSelected}
              onClick={() => onSelectBase(group.base)}
            >
              <span className={styles.rowTitle}>{group.base.label}</span>
              {isVigente ? (
                <Tag type="blue" size="sm" className={styles.vigenteTag}>
                  {t('current', 'Vigente')}
                </Tag>
              ) : null}
            </button>

            <div className={styles.attentions}>
              {attentionsNewestFirst.length === 0 ? (
                <p className={styles.emptyHint}>{t('noEvolutivesShort', 'Sin odontogramas evolutivos')}</p>
              ) : (
                attentionsNewestFirst.map(({ record, number }, idx) => {
                  const selected = record.encounterUuid === selectedEncounterUuid;
                  const isCurrentEvolutive = isVigente && idx === 0;
                  return (
                    <button
                      key={record.encounterUuid}
                      type="button"
                      className={`${styles.attentionRow} ${selected ? styles.selected : ''}`}
                      aria-current={selected}
                      onClick={() => onSelectAttention(record, group.base)}
                    >
                      <span className={styles.rowTitleLine}>
                        <span className={styles.rowTitle}>{`${t('evolutiveShort', 'Evolutivo')} ${number}`}</span>
                        {isCurrentEvolutive ? (
                          <Tag type="teal" size="sm" className={styles.vigenteTag}>
                            {t('current', 'Vigente')}
                          </Tag>
                        ) : null}
                      </span>
                      <span className={styles.rowMeta}>{fullDateTime(record.date)}</span>
                    </button>
                  );
                })
              )}

              {canEdit && isVigente ? (
                <Button
                  kind="ghost"
                  size="sm"
                  className={styles.addBtn}
                  renderIcon={Add}
                  onClick={() => onAddAttention(group.base)}
                  data-testid="add-attention-btn"
                >
                  {t('newEvolutive', 'Nuevo odontograma evolutivo')}
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </nav>
  );
};

export default OdontogramRecordList;
