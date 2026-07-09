import { Add } from '@carbon/icons-react';
import { Button, PaginationNav, Tag } from '@carbon/react';
import { formatDate } from '@openmrs/esm-framework';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { OdontogramBaseGroup, OdontogramRecord, OdontogramRecordType } from '../types/odontogram-record';
import styles from './odontogram-record-list.scss';

interface DraftDescriptor {
  type: OdontogramRecordType;
  baseEncounterUuid?: string | null;
}

interface OdontogramRecordListProps {
  /** Base groups, oldest→newest (rendered newest-first). */
  groups: OdontogramBaseGroup[];
  vigenteBaseUuid: string | null;
  selectedEncounterUuid: string | null;
  canEdit: boolean;
  /** Disables the "new" actions while another edit is in progress. */
  disableAdd?: boolean;
  /** A new (unsaved) record being created — shown as a temporary card. */
  draft?: DraftDescriptor | null;
  /** Whether the draft card is the one currently open in the editor. */
  draftActive?: boolean;
  onSelectDraft?: () => void;
  onAddBase: () => void;
  onSelectBase: (base: OdontogramRecord) => void;
  onSelectAttention: (attention: OdontogramRecord, base: OdontogramRecord) => void;
  onAddAttention: (base: OdontogramRecord) => void;
}

const INITIALS_PER_PAGE = 5;

function fullDateTime(iso: string): string {
  return formatDate(new Date(iso), { mode: 'wide', time: true });
}

const OdontogramRecordList: React.FC<OdontogramRecordListProps> = ({
  groups,
  vigenteBaseUuid,
  selectedEncounterUuid,
  canEdit,
  disableAdd = false,
  draft = null,
  draftActive = false,
  onSelectDraft,
  onAddBase,
  onSelectBase,
  onSelectAttention,
  onAddAttention,
}) => {
  const { t } = useTranslation();
  // Initial odontograms, newest first. Paginated so a patient with many of them
  // (up to ~50) never produces an endless scroll.
  const orderedGroups = useMemo(() => [...groups].reverse(), [groups]);
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(orderedGroups.length / INITIALS_PER_PAGE));

  // Keep the newest page in view when a draft appears or the range shrinks.
  useEffect(() => {
    if (draft?.type === 'base') {
      setPage(0);
    }
  }, [draft?.type]);
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  const pagedGroups = orderedGroups.slice(page * INITIALS_PER_PAGE, page * INITIALS_PER_PAGE + INITIALS_PER_PAGE);
  // While the draft card is the active editor, no saved row is highlighted.
  const highlightedUuid = draftActive ? null : selectedEncounterUuid;

  return (
    <nav className={styles.list} aria-label={t('odontogramList', 'Lista de odontogramas')}>
      {canEdit ? (
        <Button
          kind="ghost"
          size="sm"
          className={styles.addBaseBtn}
          renderIcon={Add}
          disabled={disableAdd}
          onClick={onAddBase}
          data-testid="add-base-btn"
        >
          {t('newInitialOdontogram', 'Nuevo odontograma inicial')}
        </Button>
      ) : null}

      {draft?.type === 'base' ? (
        <div className={styles.group}>
          <button
            type="button"
            className={`${styles.baseRow} ${styles.draftRow} ${draftActive ? styles.selected : ''}`}
            aria-current={draftActive}
            onClick={onSelectDraft}
            data-testid="draft-base-card"
          >
            <span className={styles.rowTitle}>{t('newInitialOdontogram', 'Nuevo odontograma inicial')}</span>
            <Tag type="blue" size="sm" className={styles.vigenteTag}>
              {t('draftTag', 'Borrador')}
            </Tag>
          </button>
        </div>
      ) : null}

      {pagedGroups.map((group) => {
        const isVigente = group.base.encounterUuid === vigenteBaseUuid;
        const baseSelected = group.base.encounterUuid === highlightedUuid;
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
              {canEdit && isVigente ? (
                <Button
                  kind="ghost"
                  size="sm"
                  className={styles.addBtn}
                  renderIcon={Add}
                  disabled={disableAdd}
                  onClick={() => onAddAttention(group.base)}
                  data-testid="add-attention-btn"
                >
                  {t('newEvolutive', 'Nuevo odontograma evolutivo')}
                </Button>
              ) : null}

              {draft?.type === 'attention' && draft.baseEncounterUuid === group.base.encounterUuid ? (
                <button
                  type="button"
                  className={`${styles.attentionRow} ${styles.draftRow} ${draftActive ? styles.selected : ''}`}
                  aria-current={draftActive}
                  onClick={onSelectDraft}
                  data-testid="draft-attention-card"
                >
                  <span className={styles.rowTitleLine}>
                    <span className={styles.rowTitle}>{t('newEvolutive', 'Nuevo odontograma evolutivo')}</span>
                    <Tag type="teal" size="sm" className={styles.vigenteTag}>
                      {t('draftTag', 'Borrador')}
                    </Tag>
                  </span>
                </button>
              ) : null}

              {attentionsNewestFirst.length === 0 ? (
                <p className={styles.emptyHint}>{t('noEvolutivesShort', 'Sin odontogramas evolutivos')}</p>
              ) : (
                attentionsNewestFirst.map(({ record, number }, idx) => {
                  const selected = record.encounterUuid === highlightedUuid;
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
            </div>
          </div>
        );
      })}

      {totalPages > 1 ? (
        <div className={styles.pagination}>
          <PaginationNav
            size="sm"
            page={page}
            totalItems={totalPages}
            itemsShown={5}
            onChange={setPage}
            aria-label={t('initialOdontogramPages', 'Páginas de odontogramas iniciales')}
          />
        </div>
      ) : null}
    </nav>
  );
};

export default OdontogramRecordList;
