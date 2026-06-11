import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { Search } from '@carbon/react/icons';
import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../../../constants';
import { PatientRegistrationContext } from '../../patient-registration-context';
import styles from '../field.scss';
import { dniPattern, getDniIdentifier } from './dni-identifier';
import { lookupReniecIdentityByDni, type ReniecIdentityLookupResult } from './reniec-lookup.resource';

type LookupStatus = {
  kind: 'success' | 'warning' | 'error';
  title: string;
};

function parseLocalDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function applyReniecIdentityToForm(
  identity: ReniecIdentityLookupResult,
  setFieldValue: (field: string, value: unknown, shouldValidate?: boolean) => void,
  setFieldTouched: (field: string, isTouched?: boolean, shouldValidate?: boolean) => void,
) {
  const fieldValues: Array<[string, unknown]> = [
    ['givenName', identity.givenName],
    ['middleName', identity.middleName ?? ''],
    ['familyName', identity.familyName],
    ['familyName2', identity.familyName2 ?? ''],
    ['birthdate', parseLocalDate(identity.birthdate)],
    ['birthdateEstimated', false],
    ['yearsEstimated', 0],
    ['monthsEstimated', ''],
    ['gender', identity.gender],
  ];

  fieldValues.forEach(([field, value]) => {
    setFieldValue(field, value, false);
    setFieldTouched(field, true, false);
  });
}

export const ReniecLookupField = () => {
  const { t } = useTranslation(moduleName);
  const { identifierTypes, values, setFieldValue, setFieldTouched } = useContext(PatientRegistrationContext);
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
        title: t('reniecLookupNoDniIdentifier', 'Seleccione DNI para buscar en RENIEC'),
      });
      return;
    }

    if (!dniPattern.test(normalizedDni)) {
      setStatus({
        kind: 'warning',
        title: t('reniecLookupInvalidDni', 'El DNI debe tener 8 dígitos'),
      });
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      const identity = await lookupReniecIdentityByDni(normalizedDni);

      if (!identity) {
        setStatus({
          kind: 'warning',
          title: t('reniecLookupNoResults', 'No se encontraron datos RENIEC'),
        });
        return;
      }

      applyReniecIdentityToForm(identity, setFieldValue, setFieldTouched);
      setStatus({
        kind: 'success',
        title: t('reniecLookupSuccess', 'Datos RENIEC cargados'),
      });
    } catch {
      setStatus({
        kind: 'error',
        title: t('reniecLookupError', 'No se pudo consultar RENIEC'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.externalLookup}>
      <div className={styles.externalLookupHeader}>
        <h4 className={styles.productiveHeading02Light}>{t('reniecLookupTitle', 'Consulta RENIEC')}</h4>
        {dni ? <span className={styles.externalLookupDocument}>DNI {dni}</span> : null}
      </div>
      <div className={styles.externalLookupAction}>
        <Button kind="tertiary" size="sm" renderIcon={Search} onClick={handleLookup} disabled={isLoading}>
          {t('reniecLookupButton', 'Buscar en RENIEC')}
        </Button>
        {isLoading ? <InlineLoading description={t('reniecLookupLoading', 'Consultando RENIEC')} /> : null}
      </div>
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
