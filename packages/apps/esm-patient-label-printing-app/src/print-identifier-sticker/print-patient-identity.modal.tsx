import { Button, InlineLoading, InlineNotification, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getPatientName, restBaseUrl, usePatient, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { useStickerPdfPrinter } from '../hooks/useStickerPdfPrinter';

interface PrintPatientIdentityProps {
  patientUuid: string;
  context: 'appointments' | 'patient-chart-appointments';
  closeModal: () => void;
}

export default function PrintPatientIdentityModal(props: PrintPatientIdentityProps) {
  const { t } = useTranslation();
  const session = useSession();
  const contextPrivilege =
    props.context === 'appointments'
      ? 'app:home.citas'
      : props.context === 'patient-chart-appointments'
        ? 'app:hoja.clinica.citas'
        : null;
  const allowed = Boolean(
    props.patientUuid?.trim() &&
      contextPrivilege &&
      session?.user?.uuid &&
      session.authenticated !== false &&
      userHasAccess([contextPrivilege, 'App: Can generate a Patient Identity Sticker', 'Get Patients'], session.user),
  );

  if (!allowed) {
    return (
      <>
        <ModalHeader
          closeModal={props.closeModal}
          title={t('printPatientIdentification', 'Print patient identification')}
        />
        <ModalBody>
          <InlineNotification
            kind="error"
            hideCloseButton
            title={t(
              'patientPrintUnavailable',
              'Patient identification cannot be printed. Check your access and select the patient again.',
            )}
          />
        </ModalBody>
      </>
    );
  }

  // Replacing the patient or account unmounts the pending request and printer.
  return (
    <AuthorizedPrintPatientIdentity
      key={`${props.patientUuid}:${session.user.uuid}:${session.sessionLocation?.uuid}:${props.context}`}
      {...props}
    />
  );
}

function AuthorizedPrintPatientIdentity({ patientUuid, closeModal }: PrintPatientIdentityProps) {
  const { t } = useTranslation();
  const { patient, isLoading, error } = usePatient(patientUuid);
  const { mutate } = useSWRConfig();
  const { printPdf, isPrinting } = useStickerPdfPrinter(patientUuid);
  const [isPreparing, setIsPreparing] = useState(false);
  const [printError, setPrintError] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const ready = !isLoading && !error && patient?.id === patientUuid;

  useEffect(
    () => () => {
      requestRef.current?.abort();
      requestRef.current = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    },
    [],
  );

  const handlePrint = async () => {
    if (!ready || requestRef.current || isPrinting) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setIsPreparing(true);
    setPrintError(false);
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const base = globalThis.openmrsBase.replace(/\/$/, '');
      const response = await fetch(
        `${base}${restBaseUrl}/patientdocuments/patientIdSticker?patientUuid=${encodeURIComponent(patientUuid)}`,
        { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal },
      );
      if (
        !response.ok ||
        response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/pdf'
      ) {
        throw new Error('Patient PDF unavailable');
      }
      const blob = await response.blob();
      if (requestRef.current !== controller) return;
      if (!blob.size || controller.signal.aborted) throw new Error('Patient PDF unavailable');
      clearTimeout(timeout);
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      setIsPreparing(false);
      await printPdf(objectUrl);
    } catch {
      if (requestRef.current === controller) setPrintError(true);
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
        setIsPreparing(false);
      }
    }
  };

  return (
    <>
      <ModalHeader closeModal={closeModal} title={t('printPatientIdentification', 'Print patient identification')} />
      <ModalBody>
        {isLoading ? (
          <InlineLoading description={t('loadingPatientIdentification', 'Loading patient identification')} />
        ) : !ready ? (
          <>
            <InlineNotification
              kind="error"
              hideCloseButton
              title={t('patientIdentificationLoadFailed', 'The patient could not be loaded. Retry before printing.')}
            />
            <Button kind="tertiary" onClick={() => void mutate(['patient', patientUuid])}>
              {t('retry', 'Retry')}
            </Button>
          </>
        ) : (
          <>
            <p>{getPatientName(patient)}</p>
            <p>
              {t(
                'patientIdentityDocumentDescription',
                'Print the patient identification document generated by the hospital. This does not change the appointment or the clinical record.',
              )}
            </p>
          </>
        )}
        {(isPreparing || isPrinting) && (
          <InlineLoading description={t('preparingPatientPrint', 'Preparing patient identification for printing')} />
        )}
        {printError && (
          <InlineNotification
            kind="error"
            hideCloseButton
            title={t(
              'patientIdentityPrintFailed',
              'The identification document could not be printed. Retry or contact support if the problem continues.',
            )}
          />
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('close', 'Close')}
        </Button>
        <Button onClick={handlePrint} disabled={!ready || isPreparing || isPrinting}>
          {t('print', 'Print')}
        </Button>
      </ModalFooter>
    </>
  );
}
