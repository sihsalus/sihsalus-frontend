import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { Search } from '@carbon/react/icons';
import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../../../constants';
import { PatientRegistrationContext } from '../../patient-registration-context';
import {
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationInactiveConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
} from '../../peru-registration-config';
import styles from '../field.scss';
import { dniPattern, getDniIdentifier } from './dni-identifier';
import { lookupSisInsuranceByDni, type SisInsuranceLookupResult } from './sis-lookup.resource';

type LookupStatus = {
  kind: 'success' | 'warning' | 'error';
  title: string;
};

export function applySisInsuranceToForm(
  insurance: SisInsuranceLookupResult,
  setFieldValue: (field: string, value: unknown, shouldValidate?: boolean) => void,
  setFieldTouched: (field: string, isTouched?: boolean, shouldValidate?: boolean) => void,
) {
  const accreditationStatus = insurance.active
    ? peruInsuranceAccreditationActiveConceptUuid
    : peruInsuranceAccreditationInactiveConceptUuid;
  const fieldValues: Array<[string, unknown]> = [
    [`attributes.${peruInsuranceCodeAttributeTypeUuid}`, insurance.insuranceCode],
    [`attributes.${peruInsuranceAccreditationStatusAttributeTypeUuid}`, accreditationStatus],
    [`attributes.${peruInsuranceAccreditationCheckedAtAttributeTypeUuid}`, insurance.checkedAt],
  ];

  fieldValues.forEach(([field, value]) => {
    setFieldValue(field, value, false);
    setFieldTouched(field, true, false);
  });
}

export const SisLookupField = () => {
  const { t } = useTranslation(moduleName);
  const { identifierTypes, values, setFieldValue, setFieldTouched, isOffline } = useContext(PatientRegistrationContext);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<LookupStatus | null>(null);
  const dniIdentifier = useMemo(
    () => getDniIdentifier(values.identifiers ?? {}, identifierTypes ?? []),
    [identifierTypes, values.identifiers],
  );
  const dni = dniIdentifier?.[1]?.identifierValue?.trim() ?? '';

  const handleLookup = async () => {
    const normalizedDni = dni.replace(/\s+/g, '');

    if (!dniIdentifier) {
      setStatus({
        kind: 'warning',
        title: t('sisLookupNoDniIdentifier', 'Seleccione DNI para consultar SIS'),
      });
      return;
    }

    if (!dniPattern.test(normalizedDni)) {
      setStatus({
        kind: 'warning',
        title: t('sisLookupInvalidDni', 'El DNI debe tener 8 dígitos'),
      });
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      const insurance = await lookupSisInsuranceByDni(normalizedDni);

      if (!insurance) {
        setStatus({
          kind: 'warning',
          title: t('sisLookupNoResults', 'No se encontraron datos SIS'),
        });
        return;
      }

      applySisInsuranceToForm(insurance, setFieldValue, setFieldTouched);
      setStatus({
        kind: 'success',
        title: insurance.active
          ? t('sisLookupActiveSuccess', 'Acreditación SIS vigente cargada')
          : t('sisLookupInactiveSuccess', 'Acreditación SIS no vigente cargada'),
      });
    } catch {
      setStatus({
        kind: 'error',
        title: t('sisLookupError', 'No se pudo consultar SIS'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.externalLookup}>
      <div className={styles.externalLookupHeader}>
        <h4 className={styles.productiveHeading02Light}>{t('sisLookupTitle', 'Consulta SIS')}</h4>
        {dni ? <span className={styles.externalLookupDocument}>DNI {dni}</span> : null}
      </div>
      <div className={styles.externalLookupAction}>
        <Button
          className={styles.externalLookupButton}
          kind="tertiary"
          size="sm"
          renderIcon={Search}
          onClick={handleLookup}
          disabled={isLoading || isOffline}
        >
          {t('sisLookupButton', 'Consultar SIS')}
        </Button>
        {isLoading ? <InlineLoading description={t('sisLookupLoading', 'Consultando SIS')} /> : null}
      </div>
      {isOffline ? (
        <InlineNotification
          className={styles.externalLookupNotification}
          kind="info"
          lowContrast
          title={t('sisLookupOffline', 'La consulta SIS requiere conexión')}
        />
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
