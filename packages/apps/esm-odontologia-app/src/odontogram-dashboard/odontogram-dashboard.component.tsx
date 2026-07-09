import { Add, Edit, Information, Maximize, TrashCan } from '@carbon/icons-react';
import { Button, IconButton, Modal, SkeletonPlaceholder, SkeletonText, Tag, Tooltip } from '@carbon/react';
import {
  formatDate,
  launchWorkspace,
  showModal,
  showSnackbar,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { CardHeader } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { countSolutions } from './count-solutions';
import OdontogramRecordList from './odontogram-record-list.component';
import { useOdontogramHistory } from '../hooks/useOdontogramHistory';
import OdontogramCanvas from '../odontogram/components/Odontogram';
import { adultConfig } from '../odontogram/config/adultConfig';
import { createEmptyOdontogramData } from '../odontogram/types/odontogram';
import { deleteEncounter } from '../odontogram.resource';
import useOdontogramDataStore from '../store/odontogramDataStore';
import type { OdontogramRecord } from '../types/odontogram-record';
import DentalEmptyState from '../ui/dental-empty-state.component';
import styles from './odontogram-dashboard.scss';

interface OdontogramDashboardProps {
  patientUuid: string;
}

const WORKSPACE_NAME = 'odontologia-odontogram-form-workspace';
const noop = () => {};

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
      description={t('odontogramEmptyDescription', 'No hay odontograma base registrado para mostrar para este paciente.')}
      actionLabel={t('registerBaseOdontogram', 'Registrar odontograma base')}
      onAction={onGenerate}
    />
  );
};

const OdontogramDashboard: React.FC<OdontogramDashboardProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess('app:clinical.chart.dentistry.edit', session?.user);

  const setPatient = useOdontogramDataStore((s) => s.setPatient);
  const setSelectedEncounterUuid = useOdontogramDataStore((s) => s.setSelectedEncounterUuid);
  const setActiveBaseEncounterUuid = useOdontogramDataStore((s) => s.setActiveBaseEncounterUuid);
  const selectedEncounterUuid = useOdontogramDataStore((s) => s.selectedEncounterUuid);
  const activeBaseEncounterUuid = useOdontogramDataStore((s) => s.activeBaseEncounterUuid);

  const { groups, baseRecords, isLoading, error, mutate } = useOdontogramHistory(patientUuid);
  const hasBase = baseRecords.length > 0;
  const vigenteBaseUuid = hasBase ? baseRecords[baseRecords.length - 1].encounterUuid : null;

  const [isExpanded, setIsExpanded] = useState(false);

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

  // The preview reads straight from the selected record so it never collides
  // with the workspace, which owns the shared editing buffer in the store.
  const previewData = selectedRecord?.data ?? createEmptyOdontogramData(adultConfig);

  // --- Action eligibility rules ---------------------------------------------
  // Only the CURRENT (vigente) initial odontogram can be modified. Older initial
  // odontograms and all their evolutive odontograms are historical → read-only.
  const isVigenteActive = activeBase?.encounterUuid === vigenteBaseUuid;

  // Edit: only the latest evolutive odontogram of the vigente initial, or a
  // vigente initial that has no evolutives yet (still being set up).
  const canEditSelected =
    canEdit &&
    isVigenteActive &&
    Boolean(selectedRecord) &&
    (selectedRecord?.encounterUuid === latestAttentionUuid ||
      (selectedRecord?.type === 'base' && attentions.length === 0));

  // Delete: only within the vigente initial and only when the record has nothing
  // registered (created by mistake). An initial can only be removed with no evolutives.
  const canDeleteSelected =
    canEdit &&
    isVigenteActive &&
    Boolean(selectedRecord) &&
    countSolutions(selectedRecord?.data) === 0 &&
    (selectedRecord?.type === 'attention' || attentions.length === 0);

  useEffect(() => {
    setPatient(patientUuid);
  }, [patientUuid, setPatient]);

  // Open on the most recent attention of the vigente base (fallback: base findings)
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

  const launchNewBase = useCallback(() => {
    launchWorkspace(WORKSPACE_NAME, {
      patientUuid,
      workspaceMode: 'base',
      initialData: createEmptyOdontogramData(adultConfig),
      onSaved: mutate,
    });
  }, [patientUuid, mutate]);

  const handleSelectBase = useCallback(
    (base: OdontogramRecord) => {
      setActiveBaseEncounterUuid(base.encounterUuid);
      setSelectedEncounterUuid(base.encounterUuid);
    },
    [setActiveBaseEncounterUuid, setSelectedEncounterUuid],
  );

  const handleSelectAttention = useCallback(
    (attention: OdontogramRecord, base: OdontogramRecord) => {
      setActiveBaseEncounterUuid(base.encounterUuid);
      setSelectedEncounterUuid(attention.encounterUuid);
    },
    [setActiveBaseEncounterUuid, setSelectedEncounterUuid],
  );

  const handleAddAttention = useCallback(
    (base: OdontogramRecord) => {
      launchWorkspace(WORKSPACE_NAME, {
        patientUuid,
        workspaceMode: 'attention',
        baseEncounterUuid: base.encounterUuid,
        initialData: createEmptyOdontogramData(adultConfig),
        onSaved: mutate,
      });
    },
    [patientUuid, mutate],
  );

  const handleEditRecord = useCallback(() => {
    if (!selectedRecord?.data || !activeBase) {
      return;
    }
    launchWorkspace(WORKSPACE_NAME, {
      patientUuid,
      workspaceMode: selectedRecord.type,
      encounterUuid: selectedRecord.encounterUuid,
      baseEncounterUuid: activeBase.encounterUuid,
      initialData: selectedRecord.data,
      onSaved: mutate,
    });
  }, [selectedRecord, activeBase, patientUuid, mutate]);

  const handleDeleteRecord = useCallback(() => {
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
    return <OdontogramEmpty onGenerate={canEdit ? launchNewBase : undefined} />;
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

  return (
    <div className={styles.dashboardWrapper}>
      <CardHeader title={t('odontogram', 'Odontograma')}>
        <div className={styles.headerActions}>
          <Tooltip
            align="bottom-right"
            label={t(
              'baseOdontogramTooltip',
              'El odontograma inicial es el diagnóstico odontológico del periodo (normalmente al inicio del año): registra el estado de todas las piezas dentales y se conserva como referencia. Las soluciones se registran después en cada odontograma evolutivo.',
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
          {canEdit ? (
            <Button kind="ghost" size="sm" renderIcon={Add} onClick={launchNewBase} data-testid="add-base-btn">
              {t('newInitialOdontogram', 'Nuevo odontograma inicial')}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <div className={styles.masterDetail}>
        <aside className={styles.master}>
          <OdontogramRecordList
            groups={groups}
            vigenteBaseUuid={vigenteBaseUuid}
            selectedEncounterUuid={selectedEncounterUuid}
            canEdit={canEdit}
            onSelectBase={handleSelectBase}
            onSelectAttention={handleSelectAttention}
            onAddAttention={handleAddAttention}
          />
        </aside>

        <section className={styles.detail}>
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
                label={t('viewLarge', 'Ver en grande')}
                onClick={() => setIsExpanded(true)}
                data-testid="expand-odontogram-btn"
              >
                <Maximize />
              </IconButton>
              {canEditSelected ? (
                <Button kind="tertiary" size="sm" renderIcon={Edit} onClick={handleEditRecord} data-testid="edit-odontogram-btn">
                  {t('edit', 'Editar')}
                </Button>
              ) : null}
              {canDeleteSelected ? (
                <Button
                  kind="danger--tertiary"
                  size="sm"
                  renderIcon={TrashCan}
                  onClick={handleDeleteRecord}
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
        </section>
      </div>

      {isExpanded ? (
        <Modal
          open
          passiveModal
          isFullWidth
          size="lg"
          className={styles.viewModal}
          modalHeading={`${detailLabel}${detailMeta ? ` · ${detailMeta}` : ''}`}
          modalLabel={t('odontogram', 'Odontograma')}
          onRequestClose={() => setIsExpanded(false)}
        >
          <div className={styles.modalCanvas}>
            <OdontogramCanvas config={adultConfig} data={previewData} onChange={noop} readOnly />
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

export default OdontogramDashboard;
