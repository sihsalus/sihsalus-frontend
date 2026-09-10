import { Accordion, AccordionItem, Button, TextArea } from '@carbon/react';
import { Copy } from '@carbon/react/icons';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../dashboard.meta';
import styles from './order-basket-search.scss';

/** A local administrative draft, deliberately independent of patients, orders and persistence. */
export default function MissingCatalogItem() {
  const { t } = useTranslation(moduleName);
  const inputId = useId();
  const [description, setDescription] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const requestText = description.trim()
    ? `${t('catalogRequestHeading', 'Catalog review request — NOT a prescription')}\n\n${description.trim()}`
    : '';

  const copyDraft = async () => {
    if (!requestText || copyStatus === 'copying') return;
    setCopyStatus('copying');
    try {
      await navigator.clipboard.writeText(requestText);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return (
    <Accordion className={styles.catalogRequest}>
      <AccordionItem title={t('missingCatalogItem', 'Cannot find a medication or supply?')}>
        <p>
          {t(
            'catalogSearchHelp',
            'Try the generic name or a synonym and check the strength and dosage form. This search uses the local catalog; a missing result does not establish whether an item belongs to the MINSA list. For supplies, specify the type, size and presentation for Pharmacy to review.',
          )}
        </p>
        <p id={`${inputId}-notice`}>
          {t(
            'catalogRequestNotice',
            'This is a local draft for catalog review, not a prescription. It is not saved in the chart or sent to Pharmacy and is discarded when you close the prescription workspace or change patient, consultation or account. Do not include patient information. Send the reviewed text through your approved institutional channel.',
          )}
        </p>
        <TextArea
          id={inputId}
          aria-describedby={`${inputId}-notice`}
          labelText={t('catalogRequestItem', 'Item to request')}
          helperText={t(
            'catalogRequestItemHelp',
            'Include the generic name, strength and dosage form, or the supply specifications. Maximum 1,000 characters.',
          )}
          autoComplete="off"
          maxLength={1000}
          rows={3}
          value={description}
          readOnly={copyStatus === 'copying'}
          onChange={(event) => {
            setDescription(event.target.value);
            setCopyStatus('idle');
          }}
        />
        {requestText ? (
          <TextArea
            id={`${inputId}-preview`}
            className={styles.catalogRequestPreview}
            labelText={t('catalogRequestPreview', 'Draft for review (not sent)')}
            readOnly
            rows={4}
            value={requestText}
          />
        ) : null}
        <Button
          type="button"
          kind="tertiary"
          size="sm"
          renderIcon={Copy}
          disabled={!requestText || copyStatus === 'copying'}
          onClick={copyDraft}
        >
          {t('copyCatalogRequest', 'Copy draft for Pharmacy')}
        </Button>
        <p role="status" aria-live="polite">
          {copyStatus === 'copied'
            ? t('catalogRequestCopied', 'Draft copied. It has not been sent to Pharmacy.')
            : copyStatus === 'failed'
              ? t('catalogRequestCopyFailed', 'Could not copy the draft. Select and copy the preview manually.')
              : ''}
        </p>
      </AccordionItem>
    </Accordion>
  );
}
