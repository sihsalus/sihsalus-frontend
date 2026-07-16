import { Edit, Information, Maximize, TrashCan } from '@carbon/icons-react';
import {
  Button,
  ButtonSet,
  IconButton,
  InlineLoading,
  SkeletonPlaceholder,
  SkeletonText,
  Tag,
  Tooltip,
} from '@carbon/react';
import {
  formatDate,
  launchWorkspace,
  showModal,
  showSnackbar,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { countSolutions } from './count-solutions';
import OdontogramRecordList from './odontogram-record-list.component';
import { useOdontogramEncounter } from '../hooks/useOdontogramEncounter';
import { useOdontogramHistory } from '../hooks/useOdontogramHistory';
import OdontogramCanvas from '../odontogram/components/Odontogram';
import { adultConfig } from '../odontogram/config/adultConfig';
import { createEmptyOdontogramData } from '../odontogram/types/odontogram';
import { deleteEncounter } from '../odontogram.resource';
import useOdontogramDataStore from '../store/odontogramDataStore';
import type { OdontogramRecord, OdontogramRecordType } from '../types/odontogram-record';
import DentalEmptyState from '../ui/dental-empty-state.component';
import styles from './odontogram-dashboard.scss';

interface OdontogramDashboardProps {
  patientUuid: string;
}

const WORKSPACE_NAME = 'odontologia-odontogram-form-workspace';
const noop = () => {};

/** Identity of the in-progress edit. Its data buffer lives in the shared store. */
interface EditContext {
  recordType: OdontogramRecordType;
  encounterUuid?: string;
  baseEncounterUuid?: string;
}

const OdontogramSkeleton: React.FC = () => (
  <div className={styles.skeletonWrapper}>
    <div className={styles.skeletonHeader}>
      <SkeletonText width="160px" />
      <SkeletonText width="220px" />
    </div>
    <SkeletonPlaceholder className={styles.skeletonCanvas} />
  </div>
);

const OdontogramEmpty: React.FC<{ onGenerate?: () => void }> = ({ onGenerate }) => {
  const { t } = useTranslation();
  return (
    <DentalEmptyState
      title={t('odontogram', 'Odontograma')}
      description={t(
        'odontogramEmptyDescription',
        'No hay odontograma inicial registrado para mostrar para este paciente.',
      )}
      actionLabel={t('registerBaseOdontogram', 'Registrar odontograma inicial')}
      onAction={onGenerate}
    />
  );
};

const OdontogramDashboard: React.FC<OdontogramDashboardProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess('app:hoja.clinica.odontologia.editar', session?.user);
  const { save, isSaving } = useOdontogramEncounter();

  const setPatient = useOdontogramDataStore((s) => s.setPatient);
  const setSelectedEncounterUuid = useOdontogramDataStore((s) => s.setSelectedEncounterUuid);
  const setActiveBaseEncounterUuid = useOdontogramDataStore((s) => s.setActiveBaseEncounterUuid);
  const setWorkspaceMode = useOdontogramDataStore((s) => s.setWorkspaceMode);
  const selectedEncounterUuid = useOdontogramDataStore((s) => s.selectedEncounterUuid);
  const activeBaseEncounterUuid = useOdontogramDataStore((s) => s.activeBaseEncounterUuid);
  // The store's `data` is the shared editing buffer (inline editor + expanded workspace).
  const editData = useOdontogramDataStore((s) => s.data);
  const setData = useOdontogramDataStore((s) => s.setData);
  // Shared form selection so the active finding/color survives navigation and
  // transfers between the inline editor and the expanded workspace.
  const formSelection = useOdontogramDataStore((s) => s.formSelection);
  const setFormSelection = useOdontogramDataStore((s) => s.setFormSelection);
  const resetFormSelection = useOdontogramDataStore((s) => s.resetFormSelection);

  const { groups, baseRecords, isLoading, error, mutate } = useOdontogramHistory(patientUuid);
  const hasBase = baseRecords.length > 0;
  const vigenteBaseUuid = hasBase ? baseRecords[baseRecords.length - 1].encounterUuid : null;

  const [editContext, setEditContext] = useState<EditContext | null>(null);
  // Whether the body is showing the editor, or a read-only record while the edit is parked.
  const [viewingEdit, setViewingEdit] = useState(false);
  const isEditing = Boolean(editContext);
  const showEditor = isEditing && viewingEdit;
  // A brand-new (unsaved) record shows a temporary "draft" card in the list so
  // navigation has somewhere to return to while it is being created.
  const draft =
    editContext && !editContext.encounterUuid
      ? { type: editContext.recordType, baseEncounterUuid: editContext.baseEncounterUuid ?? null }
      : null;
  const draftActive = Boolean(draft) && viewingEdit;

  const activeGroup = useMemo(() => {
    if (!groups.length) {
      return null;
    }
    return groups.find((group) => group.base.encounterUuid === activeBaseEncounterUuid) ?? groups[groups.length - 1];
  }, [groups, activeBaseEncounterUuid]);

  const activeBase = activeGroup?.base ?? null;
  const attentions = activeGroup?.attentions ?? [];
  const latestAttentionUuid = attentions.length ? attentions[attentions.length - 1].encounterUuid : null;

  const selectedRecord = useMemo(() => {
    if (!activeGroup) {
      return null;
    }
    if (activeGroup.base.encounterUuid === selectedEncounterUuid) {
      return activeGroup.base;
    }
    return activeGroup.attentions.find((record) => record.encounterUuid === selectedEncounterUuid) ?? activeGroup.base;
  }, [activeGroup, selectedEncounterUuid]);

  const isViewingAttention = selectedRecord?.type === 'attention';
  const selectedAttentionNumber = useMemo(() => {
    if (!isViewingAttention || !selectedRecord) {
      return null;
    }
    return attentions.findIndex((record) => record.encounterUuid === selectedRecord.encounterUuid) + 1;
  }, [attentions, isViewingAttention, selectedRecord]);

  const previewData = selectedRecord?.data ?? createEmptyOdontogramData(adultConfig);

  // --- Action eligibility (only the vigente initial can be modified) --------
  const isVigenteActive = activeBase?.encounterUuid === vigenteBaseUuid;
  const canEditSelected =
    canEdit &&
    isVigenteActive &&
    Boolean(selectedRecord) &&
    (selectedRecord?.encounterUuid === latestAttentionUuid ||
      (selectedRecord?.type === 'base' && attentions.length === 0));
  const canDeleteSelected =
    canEdit &&
    isVigenteActive &&
    Boolean(selectedRecord) &&
    countSolutions(selectedRecord?.data) === 0 &&
    (selectedRecord?.type === 'attention' || attentions.length === 0);

  useEffect(() => {
    setPatient(patientUuid);
  }, [patientUuid, setPatient]);

  // Open on the most recent evolutive of the vigente initial (fallback: the initial)
  useEffect(() => {
    if (selectedEncounterUuid || !vigenteBaseUuid) {
      return;
    }
    const vigenteGroup = groups.find((group) => group.base.encounterUuid === vigenteBaseUuid);
    if (!vigenteGroup) {
      return;
    }
    const latestAttention = vigenteGroup.attentions[vigenteGroup.attentions.length - 1];
    setActiveBaseEncounterUuid(vigenteBaseUuid);
    setSelectedEncounterUuid((latestAttention ?? vigenteGroup.base).encounterUuid);
  }, [groups, vigenteBaseUuid, selectedEncounterUuid, setActiveBaseEncounterUuid, setSelectedEncounterUuid]);

  // --- Navigation (parks the editor without discarding the buffer) ----------
  // Selecting the record currently being edited resumes the editor (with its
  // in-progress buffer); selecting any other record parks it read-only.
  const handleSelectBase = useCallback(
    (base: OdontogramRecord) => {
      setActiveBaseEncounterUuid(base.encounterUuid);
      setSelectedEncounterUuid(base.encounterUuid);
      setViewingEdit(editContext?.encounterUuid != null && editContext.encounterUuid === base.encounterUuid);
    },
    [editContext, setActiveBaseEncounterUuid, setSelectedEncounterUuid],
  );

  const handleSelectAttention = useCallback(
    (attention: OdontogramRecord, base: OdontogramRecord) => {
      setActiveBaseEncounterUuid(base.encounterUuid);
      setSelectedEncounterUuid(attention.encounterUuid);
      setViewingEdit(editContext?.encounterUuid != null && editContext.encounterUuid === attention.encounterUuid);
    },
    [editContext, setActiveBaseEncounterUuid, setSelectedEncounterUuid],
  );

  // Return to the record being edited (re-selects it in the list) and resume.
  const handleContinueEditing = useCallback(() => {
    if (!editContext) {
      return;
    }
    if (editContext.baseEncounterUuid) {
      setActiveBaseEncounterUuid(editContext.baseEncounterUuid);
    }
    if (editContext.encounterUuid) {
      setSelectedEncounterUuid(editContext.encounterUuid);
    }
    setViewingEdit(true);
  }, [editContext, setActiveBaseEncounterUuid, setSelectedEncounterUuid]);

  // --- Start editing (inline; buffer seeded into the store) -----------------
  const startNewBase = useCallback(() => {
    setData(createEmptyOdontogramData(adultConfig));
    resetFormSelection();
    setWorkspaceMode('base');
    setEditContext({ recordType: 'base' });
    setViewingEdit(true);
  }, [setData, resetFormSelection, setWorkspaceMode]);

  const startNewAttention = useCallback(
    (base: OdontogramRecord) => {
      setActiveBaseEncounterUuid(base.encounterUuid);
      setSelectedEncounterUuid(base.encounterUuid);
      setData(createEmptyOdontogramData(adultConfig));
      resetFormSelection();
      setWorkspaceMode('attention');
      setEditContext({ recordType: 'attention', baseEncounterUuid: base.encounterUuid });
      setViewingEdit(true);
    },
    [setActiveBaseEncounterUuid, setSelectedEncounterUuid, setData, resetFormSelection, setWorkspaceMode],
  );

  const startEditSelected = useCallback(() => {
    if (!selectedRecord?.data || !activeBase) {
      return;
    }
    setData(selectedRecord.data);
    resetFormSelection();
    setWorkspaceMode(selectedRecord.type);
    setActiveBaseEncounterUuid(activeBase.encounterUuid);
    setEditContext({
      recordType: selectedRecord.type,
      encounterUuid: selectedRecord.encounterUuid,
      baseEncounterUuid: activeBase.encounterUuid,
    });
    setViewingEdit(true);
  }, [selectedRecord, activeBase, setData, resetFormSelection, setWorkspaceMode, setActiveBaseEncounterUuid]);

  const handleSaveEdit = useCallback(async () => {
    if (!editContext) {
      return;
    }
    try {
      await save({
        patientUuid,
        encounterUuid: editContext.encounterUuid,
        data: editData,
        recordType: editContext.recordType,
        baseEncounterUuid: editContext.baseEncounterUuid,
      });
      showSnackbar({
        kind: 'success',
        title: t('odontogramSaved', 'Odontograma guardado'),
        subtitle:
          editContext.recordType === 'base'
            ? t('odontogramBaseSavedSubtitle', 'Se guardó el odontograma inicial.')
            : t('odontogramAttentionSavedSubtitle', 'Se guardó el odontograma evolutivo.'),
      });
      const wasNew = !editContext.encounterUuid;
      setEditContext(null);
      setViewingEdit(false);
      resetFormSelection();
      await mutate();
      if (wasNew) {
        setSelectedEncounterUuid(null);
      }
    } catch (err) {
      showSnackbar({
        kind: 'error',
        title: t('odontogramSaveError', 'Error al guardar odontograma'),
        subtitle:
          err instanceof Error
            ? err.message
            : t('odontogramSaveErrorSubtitle', 'No se pudo guardar. Intente nuevamente.'),
      });
    }
  }, [editContext, save, patientUuid, editData, t, mutate, setSelectedEncounterUuid, resetFormSelection]);

  const handleCancelEdit = useCallback(() => {
    setEditContext(null);
    setViewingEdit(false);
    resetFormSelection();
  }, [resetFormSelection]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedRecord || !activeBase) {
      return;
    }
    const record = selectedRecord;
    const encounterTypeName =
      record.type === 'base'
        ? t('initialOdontogram', 'Odontograma inicial')
        : t('evolutiveOdontogram', 'Odontograma evolutivo');

    const close = showModal('delete-encounter-modal', {
      close: () => close(),
      encounterTypeName,
      onConfirmation: () => {
        const abortController = new AbortController();
        deleteEncounter(record.encounterUuid, abortController)
          .then(() => {
            setSelectedEncounterUuid(activeBase.encounterUuid);
            mutate();
            showSnackbar({
              isLowContrast: true,
              kind: 'success',
              title: t('odontogramDeleted', 'Odontograma eliminado'),
              subtitle: t('odontogramDeletedSubtitle', 'El odontograma fue eliminado correctamente.'),
            });
          })
          .catch(() => {
            showSnackbar({
              isLowContrast: false,
              kind: 'error',
              title: t('error', 'Error'),
              subtitle: t('odontogramDeleteError', 'No se pudo eliminar el odontograma.'),
            });
          });
        close();
      },
    });
  }, [selectedRecord, activeBase, t, setSelectedEncounterUuid, mutate]);

  if (isLoading) {
    return <OdontogramSkeleton />;
  }

  if (error || !hasBase || !activeBase) {
    return <OdontogramEmpty onGenerate={canEdit ? startNewBase : undefined} />;
  }

  const detailLabel = isViewingAttention
    ? `${t('evolutiveOdontogram', 'Odontograma evolutivo')} ${selectedAttentionNumber}`
    : t('initialOdontogram', 'Odontograma inicial');
  const detailMeta = [
    selectedRecord ? formatDate(new Date(selectedRecord.date), { mode: 'wide', time: true }) : null,
    selectedRecord?.provider ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  const editTypeLabel =
    editContext?.recordType === 'base'
      ? t('initialOdontogram', 'Odontograma inicial')
      : t('evolutiveOdontogram', 'Odontograma evolutivo');
  const editLabel = editContext
    ? `${editContext.encounterUuid ? t('editingTag', 'Editando') : t('newTag', 'Nuevo')} · ${editTypeLabel}`
    : '';

  // Expand: while editing → full-screen editable (same buffer); otherwise → read-only view.
  const handleExpand = () => {
    if (showEditor && editContext) {
      launchWorkspace(WORKSPACE_NAME, {
        patientUuid,
        workspaceMode: editContext.recordType,
        encounterUuid: editContext.encounterUuid,
        baseEncounterUuid: editContext.baseEncounterUuid,
        initialData: editData,
        workspaceTitle: editLabel,
        onSaved: () => {
          const wasNew = !editContext.encounterUuid;
          setEditContext(null);
          setViewingEdit(false);
          resetFormSelection();
          mutate();
          if (wasNew) {
            setSelectedEncounterUuid(null);
          }
        },
      });
      return;
    }
    if (selectedRecord) {
      launchWorkspace(WORKSPACE_NAME, {
        patientUuid,
        workspaceMode: selectedRecord.type,
        initialData: selectedRecord.data ?? createEmptyOdontogramData(adultConfig),
        readOnly: true,
        workspaceTitle: detailLabel,
      });
    }
  };

  return (
    <div className={styles.dashboardWrapper}>
      <div className={styles.cardHeader}>
        <h4 className={styles.cardTitle}>{t('attentions', 'Atenciones')}</h4>
        <Tooltip
          align="bottom-left"
          label={t(
            'attentionsInfoTooltip',
            'El odontograma inicial es un diagnóstico completo de todas las piezas dentales que se realiza al inicio del periodo y se conserva como referencia. A partir de él, cada visita registra en un odontograma evolutivo los tratamientos y soluciones que se van aplicando.',
          )}
          enterDelayMs={100}
          leaveDelayMs={150}
        >
          <button
            className={styles.infoButton}
            type="button"
            aria-label={t('odontogramInfo', 'Información del odontograma')}
          >
            <Information size={16} />
          </button>
        </Tooltip>
      </div>

      <div className={styles.masterDetail}>
        <aside className={styles.master}>
          <OdontogramRecordList
            groups={groups}
            vigenteBaseUuid={vigenteBaseUuid}
            selectedEncounterUuid={selectedEncounterUuid}
            canEdit={canEdit}
            disableAdd={isEditing}
            draft={draft}
            draftActive={draftActive}
            onSelectDraft={handleContinueEditing}
            onAddBase={startNewBase}
            onSelectBase={handleSelectBase}
            onSelectAttention={handleSelectAttention}
            onAddAttention={startNewAttention}
          />
        </aside>

        <section className={styles.detail}>
          {showEditor && editContext ? (
            <>
              <div className={styles.detailHeader}>
                <div className={styles.detailInfo}>
                  <Tag type={editContext.recordType === 'attention' ? 'teal' : 'blue'} size="sm">
                    {editLabel}
                  </Tag>
                </div>
                <div className={styles.detailActions}>
                  <IconButton
                    kind="ghost"
                    size="sm"
                    align="left"
                    label={t('editFullScreen', 'Editar en pantalla completa')}
                    onClick={handleExpand}
                    data-testid="expand-odontogram-btn"
                  >
                    <Maximize />
                  </IconButton>
                </div>
              </div>

              <div className={styles.editCanvas}>
                <OdontogramCanvas
                  config={adultConfig}
                  data={editData}
                  onChange={setData}
                  formSelection={formSelection}
                  onFormSelectionChange={setFormSelection}
                />
              </div>

              <ButtonSet className={styles.editButtons}>
                <Button
                  kind="secondary"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  data-testid="cancel-edit-btn"
                >
                  {t('cancel', 'Cancelar')}
                </Button>
                <Button
                  kind="primary"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  data-testid="save-edit-btn"
                >
                  {isSaving ? <InlineLoading description={t('saving', 'Guardando...')} /> : t('save', 'Guardar')}
                </Button>
              </ButtonSet>
            </>
          ) : (
            <>
              {isEditing ? (
                <div className={styles.editingBanner}>
                  <div className={styles.editingBannerInfo}>
                    <Information size={16} className={styles.editingBannerIcon} />
                    <div className={styles.editingBannerText}>
                      <span className={styles.editingBannerTitle}>{t('editingInProgress', 'Edición en progreso')}</span>
                      <span className={styles.editingBannerSubtitle}>{editTypeLabel}</span>
                    </div>
                  </div>
                  <Button kind="ghost" size="sm" onClick={handleContinueEditing} data-testid="continue-edit-btn">
                    {t('continueEditing', 'Continuar edición')}
                  </Button>
                </div>
              ) : null}

              <div className={styles.detailHeader}>
                <div className={styles.detailInfo}>
                  <Tag type={isViewingAttention ? 'teal' : 'blue'} size="sm">
                    {detailLabel}
                  </Tag>
                  {detailMeta ? <span className={styles.detailMeta}>{detailMeta}</span> : null}
                </div>
                <div className={styles.detailActions}>
                  <IconButton
                    kind="ghost"
                    size="sm"
                    align="left"
                    label={t('viewLarge', 'Ver en grande')}
                    onClick={handleExpand}
                    data-testid="expand-odontogram-btn"
                  >
                    <Maximize />
                  </IconButton>
                  {!isEditing && canEditSelected ? (
                    <Button
                      kind="tertiary"
                      size="sm"
                      renderIcon={Edit}
                      onClick={startEditSelected}
                      data-testid="edit-odontogram-btn"
                    >
                      {t('edit', 'Editar')}
                    </Button>
                  ) : null}
                  {!isEditing && canDeleteSelected ? (
                    <Button
                      kind="danger--tertiary"
                      size="sm"
                      renderIcon={TrashCan}
                      onClick={handleDeleteSelected}
                      data-testid="delete-odontogram-btn"
                    >
                      {t('delete', 'Eliminar')}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className={styles.preview}>
                <OdontogramCanvas config={adultConfig} data={previewData} onChange={noop} readOnly />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default OdontogramDashboard;
