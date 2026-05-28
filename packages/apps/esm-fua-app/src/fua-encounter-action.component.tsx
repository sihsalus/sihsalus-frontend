import { Button, IconButton } from '@carbon/react';
import { Receipt } from '@carbon/react/icons';
import { openmrsFetch, restBaseUrl, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import {
  type PatientChartWorkspaceActionButtonProps,
  useStartVisitIfNeeded,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ModuleFuaRestURL } from './constant';

interface VisitSearchResponse {
  results?: Array<{
    uuid?: string;
  }>;
}

const FuaEncounterAction: React.FC<PatientChartWorkspaceActionButtonProps> = ({
  groupProps: { patientUuid, visitContext, mutateVisitContext },
}) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const startVisitIfNeeded = useStartVisitIfNeeded(patientUuid);
  const { currentVisit, activeVisit, mutate } = useVisitOrOfflineVisit(patientUuid);
  const [isGenerating, setIsGenerating] = useState(false);

  const getActiveVisitUuid = useCallback(async () => {
    const localVisitUuid = visitContext?.uuid ?? currentVisit?.uuid ?? activeVisit?.uuid;

    if (localVisitUuid) {
      return localVisitUuid;
    }

    const response = await openmrsFetch<VisitSearchResponse>(
      `${restBaseUrl}/visit?patient=${encodeURIComponent(patientUuid)}&includeInactive=false&v=custom:(uuid)`,
    );

    return response.data?.results?.[0]?.uuid;
  }, [activeVisit?.uuid, currentVisit?.uuid, patientUuid, visitContext?.uuid]);

  const handleCreateFua = useCallback(async () => {
    if (isGenerating) {
      return;
    }

    setIsGenerating(true);

    try {
      const canContinue = await startVisitIfNeeded();

      if (!canContinue) {
        return;
      }

      const visitUuid = await getActiveVisitUuid();

      if (!visitUuid) {
        showSnackbar({
          kind: 'error',
          title: t('errorGeneratingFua', 'Ocurrió un error al generar el FUA'),
          subtitle: t('noActiveVisitForFua', 'No hay una consulta activa para crear FUA'),
        });
        return;
      }

      await openmrsFetch(`${ModuleFuaRestURL}/generateFromVisit/${encodeURIComponent(visitUuid)}`, {
        method: 'POST',
      });

      showSnackbar({
        kind: 'success',
        title: t('success', 'Éxito'),
        subtitle: t('fuaGeneratedSuccessfully', 'El FUA se generó correctamente'),
      });

      mutateVisitContext?.();
      await mutate?.();
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: t('errorGeneratingFua', 'Ocurrió un error al generar el FUA'),
        subtitle: error instanceof Error ? error.message : t('errorGeneratingFua', 'Ocurrió un error al generar el FUA'),
      });
    } finally {
      setIsGenerating(false);
    }
  }, [getActiveVisitUuid, isGenerating, mutate, mutateVisitContext, startVisitIfNeeded, t]);

  if (layout === 'tablet' || layout === 'phone') {
    return (
      <Button
        disabled={isGenerating}
        iconDescription={t('createFua', 'Crear FUA')}
        kind="ghost"
        onClick={() => void handleCreateFua()}
        renderIcon={Receipt}
        role="button"
        size="md"
        tabIndex={0}
      >
        {isGenerating ? t('generatingFua', 'Generando FUA...') : t('createFua', 'Crear FUA')}
      </Button>
    );
  }

  return (
    <IconButton
      align="left"
      aria-label={isGenerating ? t('generatingFua', 'Generando FUA...') : t('createFua', 'Crear FUA')}
      disabled={isGenerating}
      enterDelayMs={300}
      kind="ghost"
      label={isGenerating ? t('generatingFua', 'Generando FUA...') : t('createFua', 'Crear FUA')}
      onClick={() => void handleCreateFua()}
      size="md"
    >
      <Receipt size={16} />
    </IconButton>
  );
};

export default FuaEncounterAction;
