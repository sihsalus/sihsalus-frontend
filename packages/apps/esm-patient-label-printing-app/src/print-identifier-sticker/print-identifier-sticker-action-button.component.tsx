import { OverflowMenuItem } from '@carbon/react';
import { getCoreTranslation, restBaseUrl, showSnackbar, UserHasAccess, useConfig } from '@openmrs/esm-framework';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useStickerPdfPrinter } from '../hooks/useStickerPdfPrinter';
import styles from './print-identifier-sticker-action-button.scss';

interface PrintIdentifierStickerOverflowMenuItemProps {
  patient: fhir.Patient;
  closeMenu?: () => void;
}

const PrintIdentifierStickerOverflowMenuItem: React.FC<PrintIdentifierStickerOverflowMenuItemProps> = ({
  patient,
  closeMenu,
}) => {
  const { t } = useTranslation();
  const { showPrintIdentifierStickerButton } = useConfig<ConfigObject>();
  const { printPdf, isPrinting } = useStickerPdfPrinter(patient?.id);

  const isVisible = useMemo(() => {
    if (!patient?.id) return false;
    return showPrintIdentifierStickerButton;
  }, [showPrintIdentifierStickerButton, patient?.id]);

  const getPdfUrl = useCallback(() => {
    if (!patient?.id) {
      throw new Error(t('patientIdNotFound', 'Patient ID not found'));
    }
    return `${window.openmrsBase}${restBaseUrl}/patientdocuments/patientIdSticker?patientUuid=${patient.id}`;
  }, [patient?.id, t]);

  const handlePrint = useCallback(async () => {
    if (isPrinting) return;

    try {
      await printPdf(getPdfUrl());
    } catch {
      showSnackbar({
        kind: 'error',
        title: getCoreTranslation('printError', 'Print Error'),
        subtitle: t(
          'patientIdentityPrintFailed',
          'The identification document could not be printed. Retry or contact support if the problem continues.',
        ),
      });
    }
  }, [getPdfUrl, printPdf, isPrinting, t]);

  const buttonText = useMemo(() => {
    return isPrinting
      ? getCoreTranslation('printing', 'Printing...')
      : getCoreTranslation('printIdentifierSticker', 'Print identifier sticker');
  }, [isPrinting]);

  if (!isVisible) {
    return null;
  }

  return (
    <UserHasAccess privilege="App: Can generate a Patient Identity Sticker">
      <OverflowMenuItem
        className={styles.menuitem}
        itemText={buttonText}
        onClick={handlePrint}
        closeMenu={closeMenu}
        disabled={isPrinting}
      />
    </UserHasAccess>
  );
};

export default PrintIdentifierStickerOverflowMenuItem;
