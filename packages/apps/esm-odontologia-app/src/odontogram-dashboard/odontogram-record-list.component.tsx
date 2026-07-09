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
  activeBaseUuid: string | null;
  selectedEncounterUuid: string | null;
  canEdit: boolean;
  onSelectBase: (base: OdontogramRecord) => void;
  onSelectAttention: (attention: OdontogramRecord, base: OdontogramRecord) => void;
  onAddAttention: (base: OdontogramRecord) => void;
}

function shortDate(iso: string): string {
  return formatDate(new Date(iso), { mode: 'wide', noToday: true, time: false, year: false });
}

const OdontogramRecordList: React.FC<OdontogramRecordListProps> = ({
  groups,
  vigenteBaseUuid,
  activeBaseUuid,
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
        const isActiveGroup = group.base.encounterUuid === activeBaseUuid;
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
                <p className={styles.emptyHint}>{t('noAttentionsShort', 'Sin atenciones')}</p>
              ) : (
                attentionsNewestFirst.map(({ record, number }) => {
                  const selected = record.encounterUuid === selectedEncounterUuid;
                  return (
                    <button
                      key={record.encounterUuid}
                      type="button"
                      className={`${styles.attentionRow} ${selected ? styles.selected : ''}`}
                      aria-current={selected}
                      onClick={() => onSelectAttention(record, group.base)}
                    >
                      <span className={styles.rowTitle}>{`${t('attentionLabel', 'Atención')} ${number}`}</span>
                      <span className={styles.rowMeta}>{shortDate(record.date)}</span>
                    </button>
                  );
                })
              )}

              {canEdit && isActiveGroup ? (
                <Button
                  kind="ghost"
                  size="sm"
                  className={styles.addBtn}
                  renderIcon={Add}
                  onClick={() => onAddAttention(group.base)}
                  data-testid="add-attention-btn"
                >
                  {t('newAttention', 'Nueva atención')}
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
