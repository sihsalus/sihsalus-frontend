import { InlineNotification, Stack } from '@carbon/react';
import { formatDatetime, parseDate, useConfig, type Visit } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { consultaExternaPrivilege, moduleName, patientVisitsPrivilege } from '../utils/constants';
import OutpatientVisitSummaryDownload from './outpatient-visit-summary-download.component';

interface HistoricalOutpatientDocumentsProps {
  patientUuid: string;
  visit: Visit;
}

/** The Visits dashboard owns selection and pagination; this panel never starts or switches a visit. */
export default function HistoricalOutpatientDocuments({ patientUuid, visit }: HistoricalOutpatientDocumentsProps) {
  const { t } = useTranslation(moduleName);
  const config = useConfig<ConfigObject>();
  const isFinalizedOutpatient = Boolean(
    visit?.uuid &&
      visit.stopDatetime &&
      visit.startDatetime &&
      Number.isFinite(Date.parse(visit.startDatetime)) &&
      Number.isFinite(Date.parse(visit.stopDatetime)) &&
      Date.parse(visit.stopDatetime) >= Date.parse(visit.startDatetime) &&
      config.visitTypes.ambulatory &&
      visit.visitType?.uuid?.toLowerCase() === config.visitTypes.ambulatory.toLowerCase(),
  );

  return (
    <RequirePrivilege privilege={[patientVisitsPrivilege, consultaExternaPrivilege]}>
      {isFinalizedOutpatient ? (
        <Stack gap={5}>
          <h4>
            {t('outpatientHistoricalVisitDate', 'Consulta del {{date}}', {
              date: formatDatetime(parseDate(visit.startDatetime)),
            })}
          </h4>
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title={t('outpatientHistoricalDocuments', 'Documentos de Consulta Externa')}
            subtitle={t(
              'outpatientHistoricalDocumentNotice',
              'Copia informativa de una consulta finalizada, generada con los datos disponibles en su registro. No acredita un tratamiento vigente ni reproduce un documento emitido previamente.',
            )}
          />
          <OutpatientVisitSummaryDownload patientUuid={patientUuid} historicalVisitUuid={visit.uuid} />
        </Stack>
      ) : (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={t('outpatientHistoricalDocuments', 'Documentos de Consulta Externa')}
          subtitle={t(
            'outpatientHistoricalVisitRequired',
            'Seleccione una consulta ambulatoria finalizada para obtener su resumen e indicaciones.',
          )}
        />
      )}
    </RequirePrivilege>
  );
}
