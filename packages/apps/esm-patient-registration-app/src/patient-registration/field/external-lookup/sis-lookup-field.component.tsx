import {
  Button,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  TextInput,
} from '@carbon/react';
import { Launch, Search } from '@carbon/react/icons';
import { showSnackbar, useConfig, useFeatureFlag } from '@openmrs/esm-framework';
import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type RegistrationConfig } from '../../../config-schema';
import { externalIdentityLookupsFlag, moduleName } from '../../../constants';
import { PatientRegistrationContext } from '../../patient-registration-context';
import {
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationPendingConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
  peruInsuranceSisConceptUuid,
  peruInsuranceTypeAttributeTypeUuid,
  peruInsuranceVerificationMethodAttributeTypeUuid,
  peruSisEessNameAttributeTypeUuid,
  peruSisProductConceptUuid,
  peruSisTypeDescriptionAttributeTypeUuid,
  replacePeruInsuranceCoverageInForm,
} from '../../peru-registration-config';
import styles from '../field.scss';
import { dniPattern, getDniIdentifier, getTemporaryAffiliationIdentifier } from './dni-identifier';
import {
  lookupSisInsuranceByDni,
  type SisInsuranceLookupResult,
  sisOnlineVerificationUrl,
  useSisProductAnswers,
} from './sis-lookup.resource';

type LookupStatus = {
  kind: 'success' | 'warning' | 'error' | 'info';
  title: string;
};

export type SisAccreditationSelection = 'active' | 'inactive' | 'pending';

/**
 * Valores del person attribute "Método de Verificación de Seguro"
 * (`bc1e5c92-…`, FreeText). `siteds` queda reservado para EPS/privados.
 */
export type SisVerificationMethod = 'manual-web' | 'setisis';

export interface SisVerificationResult {
  status: SisAccreditationSelection;
  method: SisVerificationMethod;
  insuranceCode?: string;
  productDisplay?: string;
  eessName?: string;
  checkedAt: string;
}

const accreditationStatusConceptUuids: Record<SisAccreditationSelection, string> = {
  active: peruInsuranceAccreditationActiveConceptUuid,
  inactive: peruInsuranceAccreditationInactiveConceptUuid,
  pending: peruInsuranceAccreditationPendingConceptUuid,
};

type SetFieldValue = (field: string, value: unknown, shouldValidate?: boolean) => void;
type SetFieldTouched = (field: string, isTouched?: boolean, shouldValidate?: boolean) => void;

/**
 * Writes a SIS verification result (manual or automatic) into the registration
 * form: financiador = SIS, estado de acreditación, fecha/hora de verificación,
 * método de verificación (manual-web | setisis) y, si están disponibles,
 * código de afiliado, producto SIS y EESS de adscripción.
 */
export function applySisVerificationToForm(
  result: SisVerificationResult,
  setFieldValue: SetFieldValue,
  setFieldTouched: SetFieldTouched,
) {
  const attributes: Record<string, string> = {
    [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
    [peruInsuranceAccreditationStatusAttributeTypeUuid]: accreditationStatusConceptUuids[result.status],
    [peruInsuranceAccreditationCheckedAtAttributeTypeUuid]: result.checkedAt,
    [peruInsuranceVerificationMethodAttributeTypeUuid]: result.method,
  };

  if (result.insuranceCode) {
    attributes[peruInsuranceCodeAttributeTypeUuid] = result.insuranceCode;
  }
  if (result.productDisplay) {
    attributes[peruSisTypeDescriptionAttributeTypeUuid] = result.productDisplay;
  }
  if (result.eessName) {
    attributes[peruSisEessNameAttributeTypeUuid] = result.eessName;
  }

  replacePeruInsuranceCoverageInForm(attributes, setFieldValue, setFieldTouched);
}

// Camino automático (mock en desarrollo hoy, SETISIS en el futuro): mismo
// contrato de escritura que la verificación manual, incluido insuranceType=SIS.
export function applySisInsuranceToForm(
  insurance: SisInsuranceLookupResult,
  setFieldValue: SetFieldValue,
  setFieldTouched: SetFieldTouched,
) {
  applySisVerificationToForm(
    {
      status: insurance.active ? 'active' : 'inactive',
      method: 'setisis',
      insuranceCode: insurance.insuranceCode,
      checkedAt: insurance.checkedAt,
    },
    setFieldValue,
    setFieldTouched,
  );
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // The async clipboard API can be unavailable or blocked; fall through.
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
}

export const SisLookupField = () => {
  const { t } = useTranslation(moduleName);
  const autoLookupEnabled = useFeatureFlag(externalIdentityLookupsFlag);
  const config = useConfig<RegistrationConfig>();
  const { identifierTypes, values, setFieldValue, setFieldTouched, isOffline } = useContext(PatientRegistrationContext);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [status, setStatus] = useState<LookupStatus | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<SisVerificationMethod>('manual-web');
  const [accreditation, setAccreditation] = useState<SisAccreditationSelection | ''>('');
  const [selectedProductUuid, setSelectedProductUuid] = useState('');
  const [affiliateCode, setAffiliateCode] = useState('');
  const [eessName, setEessName] = useState('');

  const onlineVerificationUrl = config?.sisVerification?.onlineVerificationUrl ?? sisOnlineVerificationUrl;
  const productConceptUuid = config?.sisVerification?.productConceptUuid ?? peruSisProductConceptUuid;
  const { answers: productAnswers, isLoading: isLoadingProducts } = useSisProductAnswers(productConceptUuid);

  const dniIdentifier = useMemo(
    () => getDniIdentifier(values.identifiers ?? {}, identifierTypes ?? []),
    [identifierTypes, values.identifiers],
  );
  const dni = dniIdentifier?.[1]?.identifierValue?.trim() ?? '';

  const temporaryAffiliationIdentifier = useMemo(
    () => getTemporaryAffiliationIdentifier(values.identifiers ?? {}, identifierTypes ?? []),
    [identifierTypes, values.identifiers],
  );
  const temporaryAffiliation = temporaryAffiliationIdentifier?.[1]?.identifierValue?.trim() ?? '';
  const sisIdentifier = dni
    ? { kind: 'dni' as const, value: dni }
    : temporaryAffiliation
      ? { kind: 'temporaryAffiliation' as const, value: temporaryAffiliation }
      : null;

  const validateSisIdentifier = () => {
    const normalizedIdentifier = sisIdentifier?.value.replace(/\s+/g, '').toUpperCase() ?? '';

    if (!sisIdentifier) {
      setStatus({
        kind: 'warning',
        title: t('sisLookupNoIdentifier', 'Seleccione DNI o Afiliación Temporal para consultar SIS'),
      });
      return null;
    }

    const isValid =
      sisIdentifier.kind === 'dni' ? dniPattern.test(normalizedIdentifier) : /^E-\d{8}$/.test(normalizedIdentifier);
    if (!isValid) {
      setStatus({
        kind: 'warning',
        title:
          sisIdentifier.kind === 'dni'
            ? t('sisLookupInvalidDni', 'El DNI debe tener 8 dígitos')
            : t('sisLookupInvalidTemporaryAffiliation', 'La Afiliación Temporal debe tener el formato E- seguido de 8 dígitos'),
      });
      return null;
    }

    return normalizedIdentifier;
  };

  const openManualForm = () => {
    setVerificationMethod('manual-web');
    setAccreditation((current) => current || (isOffline ? 'pending' : ''));
    setIsFormOpen(true);
  };

  const handleOpenOnlineVerification = async () => {
    const normalizedIdentifier = validateSisIdentifier();
    if (!normalizedIdentifier) {
      return;
    }

    setStatus(null);
    // Synchronously within the user gesture so popup blockers allow the tab.
    window.open(onlineVerificationUrl, '_blank', 'noopener');
    openManualForm();

    const copied = await copyTextToClipboard(normalizedIdentifier);
    if (copied) {
      showSnackbar({
        kind: 'success',
        isLowContrast: true,
        title: t('sisManualIdentifierCopied', 'Identificador copiado'),
      });
    } else {
      showSnackbar({
        kind: 'warning',
        isLowContrast: true,
        title: t('sisManualIdentifierCopyFailed', 'No se pudo copiar el identificador; cópielo manualmente'),
      });
    }
  };

  const handleAutoLookup = async () => {
    const normalizedIdentifier = validateSisIdentifier();
    if (!normalizedIdentifier) {
      return;
    }

    setIsAutoLoading(true);
    setStatus(null);

    try {
      const insurance = await lookupSisInsuranceByDni(normalizedIdentifier);

      if (!insurance) {
        setStatus({
          kind: 'warning',
          title: t('sisLookupNoResults', 'No se encontraron datos SIS'),
        });
        return;
      }

      // The automatic result prefills the mini-form (instead of writing the
      // form values directly) so the operator reviews it before applying.
      setVerificationMethod('setisis');
      setAccreditation(insurance.active ? 'active' : 'inactive');
      setAffiliateCode(insurance.insuranceCode);
      setIsFormOpen(true);
      setStatus({
        kind: 'info',
        title: insurance.active
          ? t('sisLookupPrefillActive', 'SIS vigente encontrado. Revise el resultado y aplíquelo al formulario.')
          : t('sisLookupPrefillInactive', 'SIS no vigente encontrado. Revise el resultado y aplíquelo al formulario.'),
      });
    } catch {
      setStatus({
        kind: 'error',
        title: t('sisLookupError', 'No se pudo consultar SIS'),
      });
    } finally {
      setIsAutoLoading(false);
    }
  };

  const handleApply = () => {
    if (!accreditation) {
      return;
    }

    const product = productAnswers.find((answer) => answer.uuid === selectedProductUuid);
    const currentInsuranceCode =
      values.attributes?.[peruInsuranceTypeAttributeTypeUuid] === peruInsuranceSisConceptUuid
        ? values.attributes?.[peruInsuranceCodeAttributeTypeUuid]?.trim()
        : '';
    applySisVerificationToForm(
      {
        status: accreditation,
        method: verificationMethod,
        insuranceCode: affiliateCode.trim() || currentInsuranceCode || undefined,
        productDisplay: product?.display,
        eessName: eessName.trim() || undefined,
        checkedAt: new Date().toISOString(),
      },
      setFieldValue,
      setFieldTouched,
    );

    setIsFormOpen(false);
    setStatus({
      kind: 'success',
      title:
        accreditation === 'pending'
          ? t('sisManualAppliedPending', 'Acreditación pendiente registrada en el formulario')
          : t('sisManualApplied', 'Verificación SIS aplicada al formulario'),
    });
  };

  return (
    <div className={styles.externalLookup}>
      <div className={styles.externalLookupHeader}>
        <h4 className={styles.productiveHeading02Light}>{t('sisLookupTitle', 'Verificación SIS')}</h4>
        {sisIdentifier ? (
          <span className={styles.externalLookupDocument}>
            {sisIdentifier.kind === 'dni' ? 'DNI' : t('temporaryAffiliationShortLabel', 'Afiliación Temporal')}{' '}
            {sisIdentifier.value}
          </span>
        ) : null}
      </div>
      <div className={styles.externalLookupAction}>
        <Button
          className={styles.externalLookupButton}
          kind="tertiary"
          size="sm"
          renderIcon={Launch}
          onClick={handleOpenOnlineVerification}
          disabled={isOffline}
        >
          {t('sisManualVerifyButton', 'Verificar SIS (en línea)')}
        </Button>
        {autoLookupEnabled ? (
          <Button
            className={styles.externalLookupButton}
            kind="tertiary"
            size="sm"
            renderIcon={Search}
            onClick={handleAutoLookup}
            disabled={isAutoLoading || isOffline}
          >
            {t('sisLookupButton', 'Consultar SIS')}
          </Button>
        ) : null}
        {isAutoLoading ? <InlineLoading description={t('sisLookupLoading', 'Consultando SIS')} /> : null}
      </div>
      {isOffline ? (
        <InlineNotification
          className={styles.externalLookupNotification}
          kind="info"
          lowContrast
          title={t(
            'sisManualOffline',
            'Sin conexión: no se puede abrir la consulta SIS en línea. Registre el resultado manualmente; quedará como acreditación pendiente.',
          )}
        />
      ) : null}
      {!isFormOpen ? (
        <Button kind="ghost" size="sm" onClick={openManualForm}>
          {t('sisManualRecordResult', 'Registrar resultado de verificación')}
        </Button>
      ) : null}
      {isFormOpen ? (
        <div className={styles.externalLookupForm}>
          <RadioButtonGroup
            legendText={t('sisManualStatusLegend', 'Resultado de la verificación')}
            name="sis-manual-accreditation-status"
            orientation="vertical"
            valueSelected={accreditation}
            onChange={(value) => setAccreditation(value as SisAccreditationSelection)}
          >
            <RadioButton
              id="sis-manual-status-active"
              labelText={t('sisManualStatusActive', 'Vigente')}
              value="active"
            />
            <RadioButton
              id="sis-manual-status-inactive"
              labelText={t('sisManualStatusInactive', 'No vigente')}
              value="inactive"
            />
            <RadioButton
              id="sis-manual-status-pending"
              labelText={t('sisManualStatusPending', 'No consultada / pendiente')}
              value="pending"
            />
          </RadioButtonGroup>
          <Select
            id="sis-manual-product"
            labelText={t('sisManualProductLabel', 'Producto SIS')}
            value={selectedProductUuid}
            onChange={(event) => setSelectedProductUuid(event.target.value)}
          >
            <SelectItem
              value=""
              text={
                isLoadingProducts
                  ? t('sisManualProductLoading', 'Cargando productos SIS…')
                  : t('sisManualProductPlaceholder', 'Seleccione (opcional)')
              }
            />
            {productAnswers.map((answer) => (
              <SelectItem key={answer.uuid} value={answer.uuid} text={answer.display} />
            ))}
          </Select>
          <TextInput
            id="sis-manual-eess"
            labelText={t('sisManualEess', 'EESS de adscripción (opcional)')}
            value={eessName}
            onChange={(event) => setEessName(event.target.value)}
          />
          <div className={styles.externalLookupAction}>
            <Button kind="primary" size="sm" onClick={handleApply} disabled={!accreditation}>
              {t('sisManualApply', 'Aplicar al formulario')}
            </Button>
            <Button kind="ghost" size="sm" onClick={() => setIsFormOpen(false)}>
              {t('sisManualClose', 'Cerrar')}
            </Button>
          </div>
        </div>
      ) : null}
      {status ? (
        <InlineNotification
          className={styles.externalLookupNotification}
          kind={status.kind}
          lowContrast
          title={status.title}
        />
      ) : null}
    </div>
  );
};
