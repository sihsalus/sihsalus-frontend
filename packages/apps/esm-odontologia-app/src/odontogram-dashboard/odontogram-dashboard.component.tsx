import { Add, Edit, Information } from '@carbon/icons-react';
import {
  IconButton,
  Select,
  SelectItem,
  SelectItemGroup,
  SkeletonPlaceholder,
  SkeletonText,
  Tooltip,
} from '@carbon/react';
import { launchWorkspace, useSession, userHasAccess } from '@openmrs/esm-framework';
import { CardHeader } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOdontogramHistory } from '../hooks/useOdontogramHistory';
import OdontogramCanvas from '../odontogram/components/Odontogram';
import { adultConfig } from '../odontogram/config/adultConfig';
import { createEmptyOdontogramData } from '../odontogram/types/odontogram';
import useOdontogramDataStore from '../store/odontogramDataStore';
import type { OdontogramBaseGroup, OdontogramRecord } from '../types/odontogram-record';
import DentalEmptyState from '../ui/dental-empty-state.component';
import styles from './odontogram-dashboard.scss';

interface OdontogramDashboardProps {
  patientUuid: string;
  embedded?: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

const OdontogramSkeleton: React.FC = () => (
  <div className={styles.skeletonWrapper}>
    <div className={styles.skeletonHeader}>
      <SkeletonText width="160px" />
      <SkeletonText width="220px" />
    </div>
    <SkeletonPlaceholder className={styles.skeletonCanvas} />
  </div>
);

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const OdontogramEmpty: React.FC<{ onGenerate: () => void }> = ({ onGenerate }) => {
  const { t } = useTranslation();

  return (
    <DentalEmptyState
      title={t('odontogram', 'Odontograma')}
      description={t(
        'odontogramEmptyDescription',
        'No hay odontograma base registrado para mostrar para este paciente.',
      )}
      actionLabel={t('registerBaseOdontogram', 'Registrar odontograma base')}
      onAction={onGenerate}
    />
  );
};

// ---------------------------------------------------------------------------
// Record selector (top-right of CardHeader)
// ---------------------------------------------------------------------------

interface RecordSelectorProps {
  groups: OdontogramBaseGroup[];
  selectedEncounterUuid: string | null;
  onSelect: (record: OdontogramRecord, parentBase: OdontogramRecord) => void;
  onAdd: () => void;
  onEdit: (record: OdontogramRecord, parentBase: OdontogramRecord) => void;
}

const RecordSelector: React.FC<RecordSelectorProps> = ({ groups, selectedEncounterUuid, onSelect, onAdd, onEdit }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess('app:clinical.chart.dentistry.edit', session?.user);

  // Resolve which record is currently selected to build the tooltip text
  const selectedRecord = useMemo(() => {
    for (const g of groups) {
      if (g.base.encounterUuid === selectedEncounterUuid) return g.base;
      for (const a of g.attentions) {
        if (a.encounterUuid === selectedEncounterUuid) return a;
      }
    }
    return groups[0]?.base ?? null;
  }, [groups, selectedEncounterUuid]);

  const tooltipLabel =
    selectedRecord?.type === 'base'
      ? t(
          'baseOdontogramTooltip',
          'Base odontogram: records clinical findings. Kept as reference and not modified with each consultation.',
        )
      : t(
          'attentionOdontogramTooltip',
          'Attention odontogram: records solutions or interventions performed during this consultation.',
        );

  // Build the value→(record, parentBase) lookup so onChange can resolve both
  const recordMap = useMemo(() => {
    const map = new Map<string, { record: OdontogramRecord; parentBase: OdontogramRecord }>();
    for (const g of groups) {
      map.set(g.base.encounterUuid, { record: g.base, parentBase: g.base });
      g.attentions.forEach((a) => {
        map.set(a.encounterUuid, { record: a, parentBase: g.base });
      });
    }
    return map;
  }, [groups]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const entry = recordMap.get(e.target.value);
    if (entry) {
      onSelect(entry.record, entry.parentBase);
    }
  };

  const defaultValue = selectedEncounterUuid ?? groups[0]?.base?.encounterUuid ?? '';
  const selectedEntry = recordMap.get(defaultValue);

  return (
    <div className={styles.selectorRow}>
      <Select
        id="odontogram-record-selector"
        labelText=""
        hideLabel
        size="sm"
        value={defaultValue}
        onChange={handleChange}
        className={styles.recordSelect}
      >
        {groups.map((g) => (
          <SelectItemGroup key={g.base.encounterUuid} label={g.base.label}>
            <SelectItem value={g.base.encounterUuid} text={t('baseLabel', 'Base')} />
            {g.attentions.map((a, aIdx) => (
              <SelectItem
                key={a.encounterUuid}
                value={a.encounterUuid}
                text={`${t('attentionLabel', 'Atención')} ${aIdx + 1}`}
              />
            ))}
          </SelectItemGroup>
        ))}
      </Select>

      <Tooltip align="bottom-right" label={tooltipLabel} enterDelayMs={100} leaveDelayMs={150}>
        <button className={styles.infoButton} type="button" aria-label={t('odontogramInfo', 'Odontogram info')}>
          <Information size={16} />
        </button>
      </Tooltip>

      {canEdit ? (
        <>
          <IconButton
            kind="ghost"
            size="sm"
            label={t('editOdontogram', 'Edit odontogram')}
            onClick={() => selectedEntry && onEdit(selectedEntry.record, selectedEntry.parentBase)}
            disabled={!selectedEntry?.record.data}
            data-testid="edit-odontogram-btn"
          >
            <Edit />
          </IconButton>
          <IconButton
            kind="ghost"
            size="sm"
            label={t('addAttention', 'New attention')}
            onClick={onAdd}
            data-testid="add-attention-btn"
          >
            <Add />
          </IconButton>
        </>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const OdontogramDashboard: React.FC<OdontogramDashboardProps> = ({ patientUuid, embedded = false }) => {
  const { t } = useTranslation();
  const data = useOdontogramDataStore((s) => s.data);
  const setData = useOdontogramDataStore((s) => s.setData);
  const setPatient = useOdontogramDataStore((s) => s.setPatient);
  const setWorkspaceMode = useOdontogramDataStore((s) => s.setWorkspaceMode);
  const setSelectedEncounterUuid = useOdontogramDataStore((s) => s.setSelectedEncounterUuid);
  const setActiveBaseEncounterUuid = useOdontogramDataStore((s) => s.setActiveBaseEncounterUuid);
  const selectedEncounterUuid = useOdontogramDataStore((s) => s.selectedEncounterUuid);
  const activeBaseEncounterUuid = useOdontogramDataStore((s) => s.activeBaseEncounterUuid);

  const { groups, baseRecords, isLoading, error, mutate: _mutate } = useOdontogramHistory(patientUuid);
  const hasBase = baseRecords.length > 0;

  const selectedRecord = useMemo(() => {
    for (const group of groups) {
      if (group.base.encounterUuid === selectedEncounterUuid) {
        return group.base;
      }

      const attention = group.attentions.find((record) => record.encounterUuid === selectedEncounterUuid);
      if (attention) {
        return attention;
      }
    }

    return groups[0]?.base ?? null;
  }, [groups, selectedEncounterUuid]);

  // Sync patient into store
  useEffect(() => {
    setPatient(patientUuid);
  }, [patientUuid, setPatient]);

  // Auto-select the most recent base when history loads for the first time
  useEffect(() => {
    if (!selectedEncounterUuid && hasBase) {
      const mostRecentBase = baseRecords[baseRecords.length - 1];
      setSelectedEncounterUuid(mostRecentBase.encounterUuid);
      setActiveBaseEncounterUuid(mostRecentBase.encounterUuid);
    }
  }, [hasBase, baseRecords, selectedEncounterUuid, setSelectedEncounterUuid, setActiveBaseEncounterUuid]);

  useEffect(() => {
    if (selectedRecord?.data) {
      setData(selectedRecord.data);
    }
  }, [selectedRecord, setData]);

  const handleGenerateBase = useCallback(() => {
    setData(createEmptyOdontogramData(adultConfig));
    setWorkspaceMode('base');
    launchWorkspace('odontologia-odontogram-form-workspace', { patientUuid, workspaceMode: 'base' });
  }, [patientUuid, setData, setWorkspaceMode]);

  const handleAddClick = useCallback(() => {
    if (!hasBase) {
      // No base yet → create one
      setData(createEmptyOdontogramData(adultConfig));
      setWorkspaceMode('base');
      launchWorkspace('odontologia-odontogram-form-workspace', { patientUuid, workspaceMode: 'base' });
    } else {
      // Base exists → create an attention linked to the active base
      setWorkspaceMode('attention');
      launchWorkspace('odontologia-odontogram-form-workspace', {
        patientUuid,
        workspaceMode: 'attention',
        baseEncounterUuid: activeBaseEncounterUuid,
      });
    }
  }, [hasBase, patientUuid, activeBaseEncounterUuid, setData, setWorkspaceMode]);

  const handleSelectRecord = useCallback(
    (record: OdontogramRecord, parentBase: OdontogramRecord) => {
      setSelectedEncounterUuid(record.encounterUuid);
      setActiveBaseEncounterUuid(parentBase.encounterUuid);
    },
    [setSelectedEncounterUuid, setActiveBaseEncounterUuid],
  );

  const handleEditRecord = useCallback(
    (record: OdontogramRecord, parentBase: OdontogramRecord) => {
      if (!record.data) {
        return;
      }

      setData(record.data);
      setWorkspaceMode(record.type);
      setSelectedEncounterUuid(record.encounterUuid);
      setActiveBaseEncounterUuid(parentBase.encounterUuid);
      launchWorkspace('odontologia-odontogram-form-workspace', {
        patientUuid,
        workspaceMode: record.type,
        encounterUuid: record.encounterUuid,
        baseEncounterUuid: parentBase.encounterUuid,
      });
    },
    [patientUuid, setData, setWorkspaceMode, setSelectedEncounterUuid, setActiveBaseEncounterUuid],
  );

  // ------ Render ------

  if (isLoading) {
    return <OdontogramSkeleton />;
  }

  if (error) {
    return <OdontogramEmpty onGenerate={handleGenerateBase} />;
  }

  if (!hasBase) {
    return <OdontogramEmpty onGenerate={handleGenerateBase} />;
  }

  return (
    <div className={styles.dashboardWrapper}>
      {embedded ? (
        <div className={styles.embeddedToolbar}>
          <RecordSelector
            groups={groups}
            selectedEncounterUuid={selectedEncounterUuid}
            onSelect={handleSelectRecord}
            onAdd={handleAddClick}
            onEdit={handleEditRecord}
          />
        </div>
      ) : (
        <CardHeader title={t('odontogram', 'Odontograma')}>
          <RecordSelector
            groups={groups}
            selectedEncounterUuid={selectedEncounterUuid}
            onSelect={handleSelectRecord}
            onAdd={handleAddClick}
            onEdit={handleEditRecord}
          />
        </CardHeader>
      )}
      <div className={styles.canvasWrapper}>
        <OdontogramCanvas config={adultConfig} data={data} onChange={setData} readOnly />
      </div>
    </div>
  );
};

export default OdontogramDashboard;
