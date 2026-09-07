import { Accordion, AccordionItem, Button, Link } from '@carbon/react';
import { Launch } from '@carbon/react/icons';
import { navigate } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useTranslation } from 'react-i18next';
import { moduleName, patientAttachmentsPrivilege, patientResultsPrivilege } from '../utils/constants';
import styles from './consulta-externa-dashboard.scss';

/** Public portal links published by the INS. Never append patient data or credentials. */
export const netlabPortalUrls = {
  netlab1: 'https://www.netlab.ins.gob.pe/FrmNewLogin.aspx',
  netlab2: 'https://netlabv2.ins.gob.pe/Login',
} as const;

export default function ExternalLabResults({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation(moduleName);

  return (
    <RequirePrivilege privilege={patientResultsPrivilege} hideUnauthorized>
      <Accordion className={styles.externalReports}>
        <AccordionItem title={t('externalLabReports', 'External laboratory reports')}>
          <p>
            {t(
              'externalLabNoAutomaticImport',
              'Results from the reference laboratory, Netlab 1 and Netlab 2 are not automatically imported into this chart. Sign in to the official portal separately; SIH Salus does not request or store your Netlab password.',
            )}
          </p>
          <div className={styles.externalReportActions}>
            <Link
              href={netlabPortalUrls.netlab1}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              renderIcon={Launch}
            >
              {t('openNetlab1', 'Netlab 1 (opens in a new tab)')}
            </Link>
            <Link
              href={netlabPortalUrls.netlab2}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              renderIcon={Launch}
            >
              {t('openNetlab2', 'Netlab 2 (opens in a new tab)')}
            </Link>
          </div>
          <p>
            {t(
              'externalLabReportVerification',
              'Before attaching a report, verify the patient, requested test, sample identifier and report date. Keep the original document and identify the issuing laboratory and report date in the attachment name. Uploading requires attachment permissions and an allowed file type.',
            )}
          </p>
          <p>
            {t(
              'externalLabAttachmentBoundary',
              'An attachment is a supporting document: it does not create structured results or complete or approve a laboratory order. If the report does not match this patient or sample, do not attach it; ask the laboratory to reconcile it.',
            )}
          </p>
          <RequirePrivilege privilege={patientAttachmentsPrivilege} hideUnauthorized>
            <Button
              kind="tertiary"
              size="sm"
              onClick={() => navigate({ to: `\${openmrsSpaBase}/patient/${patientUuid}/chart/Attachments` })}
            >
              {t('viewAttachedReports', 'View attached reports')}
            </Button>
          </RequirePrivilege>
        </AccordionItem>
      </Accordion>
    </RequirePrivilege>
  );
}
