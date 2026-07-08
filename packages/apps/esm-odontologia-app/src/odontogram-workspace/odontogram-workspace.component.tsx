import { Button, ButtonSet, InlineLoading, Tag } from '@carbon/react';
import { type DefaultWorkspaceProps, showSnackbar } from '@openmrs/esm-framework';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useOdontogramEncounter } from '../hooks/useOdontogramEncounter';
import OdontogramCanvas from '../odontogram/components/Odontogram';
import { adultConfig } from '../odontogram/config/adultConfig';
import useOdontogramDataStore from '../store/odontogramDataStore';
import type { OdontogramRecordType } from '../types/odontogram-record';
import styles from './odontogram-workspace.scss';

interface OdontogramWorkspaceProps extends DefaultWorkspaceProps {
  patientUuid: string;
  encounterUuid?: string;
  /** Passed by the dashboard when launching the workspace */
  workspaceMode?: OdontogramRecordType;
}

// Labels are provided via i18n — these are English fallbacks only
const modeTagI18nKeys: Record<OdontogramRecordType, { type: 'blue' | 'teal'; key: string; fallback: string }> = {
  base: { type: 'blue', key: 'baseOdontogramTag', fallback: 'Base odontogram' },
  attention: { type: 'teal', key: 'attentionOdontogramTag', fallback: 'Attention odontogram' },
};

const OdontogramWorkspace: React.FC<OdontogramWorkspaceProps> = ({
  patientUuid,
  encounterUuid,
  workspaceMode = 'base',
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const { save, isSaving } = useOdontogramEncounter();
  const setPatient = useOdontogramDataStore((s) => s.setPatient);
  const resetData = useOdontogramDataStore((s) => s.resetData);
  const setWorkspaceMode = useOdontogramDataStore((s) => s.setWorkspaceMode);
  const data = useOdontogramDataStore((s) => s.data);
  const setData = useOdontogramDataStore((s) => s.setData);

  useEffect(() => {
    setPatient(patientUuid);
    setWorkspaceMode(workspaceMode);
  }, [patientUuid, workspaceMode, setPatient, setWorkspaceMode]);

  const handleSave = async () => {
    try {
      await save({ patientUuid, encounterUuid });
      showSnackbar({
        title: t('odontogramSaved', 'Odontogram saved'),
        kind: 'success',
        subtitle:
          workspaceMode === 'base'
            ? t('odontogramBaseSavedSubtitle', 'Base odontogram findings have been saved.')
            : t('odontogramAttentionSavedSubtitle', 'Attention odontogram solutions have been saved.'),
      });
      if (!encounterUuid) {
        resetData();
      }
      closeWorkspace();
    } catch (err) {
      showSnackbar({
        title: t('odontogramSaveError', 'Error saving odontogram'),
        kind: 'error',
        subtitle:
          err instanceof Error
            ? err.message
            : t('odontogramSaveErrorSubtitle', 'Could not save odontogram. Please try again.'),
      });
    }
  };

  const tagMeta = modeTagI18nKeys[workspaceMode];

  return (
    <div className={styles.workspaceContainer}>
      <div className={styles.workspaceContent}>
        <div className={styles.tagContainer}>
          <Tag type={tagMeta.type} size="sm">
            {t(tagMeta.key, tagMeta.fallback)}
          </Tag>
        </div>
        <OdontogramCanvas config={adultConfig} data={data} onChange={setData} />
      </div>
      <ButtonSet className={styles.buttonSet}>
        <Button kind="secondary" onClick={() => closeWorkspace()} data-testid="odontogram-cancel-btn">
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="primary" onClick={handleSave} disabled={isSaving} data-testid="odontogram-save-btn">
          {isSaving ? (
            <InlineLoading description={t('saving', 'Saving...')} />
          ) : workspaceMode === 'base' ? (
            t('saveBase', 'Save base')
          ) : (
            t('saveAttention', 'Save attention')
          )}
        </Button>
      </ButtonSet>
    </div>
  );
};

export default OdontogramWorkspace;
