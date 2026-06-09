import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { Search } from '@carbon/react/icons';
import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../../../constants';
import type { PatientIdentifierType, PatientIdentifierValue } from '../../patient-registration.types';
import { PatientRegistrationContext } from '../../patient-registration-context';
import { peruDniPatientIdentifierTypeUuid } from '../../peru-registration-config';
import styles from '../field.scss';
import { lookupMinsaIdentityByDni, type MinsaIdentityLookupResult } from './minsa-lookup.resource';

type LookupStatus = {
  kind: 'success' | 'warning' | 'error';
  title: string;
};

const dniPattern = /^\d{8}$/;

export function getDniIdentifier(
  identifiers: Record<string, PatientIdentifierValue> = {},
  identifierTypes: Array<PatientIdentifierType> = [],
) {
  return Object.entries(identifiers).find(([fieldName, identifier]) => {
    const identifierType = identifierTypes.find(
      (type) => type.fieldName === fieldName || type.uuid === identifier.identifierTypeUuid,
    );

    return (
      fieldName === 'dni' ||
      identifier.identifierTypeUuid === peruDniPatientIdentifierTypeUuid ||
      identifier.identifierName?.toLowerCase() === 'dni' ||
      identifierType?.uuid === peruDniPatientIdentifierTypeUuid ||
      identifierType?.name?.toLowerCase() === 'dni'
    );
  });
}

function parseLocalDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function applyMinsaIdentityToForm(
  identity: MinsaIdentityLookupResult,
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

export const MinsaLookupField = () => {
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
        title: t('minsaLookupNoDniIdentifier', 'Seleccione DNI para buscar en MINSA'),
      });
      return;
    }

    if (!dniPattern.test(normalizedDni)) {
      setStatus({
        kind: 'warning',
        title: t('minsaLookupInvalidDni', 'El DNI debe tener 8 dígitos'),
      });
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      const identity = await lookupMinsaIdentityByDni(normalizedDni);

      if (!identity) {
        setStatus({
          kind: 'warning',
          title: t('minsaLookupNoResults', 'No se encontraron datos MINSA'),
        });
        return;
      }

      applyMinsaIdentityToForm(identity, setFieldValue, setFieldTouched);
      setStatus({
        kind: 'success',
        title: t('minsaLookupSuccess', 'Datos MINSA cargados'),
      });
    } catch {
      setStatus({
        kind: 'error',
        title: t('minsaLookupError', 'No se pudo consultar MINSA'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.fullWidthInDesktopView}>
      <div className={styles.minsaLookup}>
        <div className={styles.minsaLookupHeader}>
          <h4 className={styles.productiveHeading02Light}>{t('minsaLookupTitle', 'Consulta MINSA')}</h4>
          {dni ? <span className={styles.minsaLookupDocument}>DNI {dni}</span> : null}
        </div>
        <div className={styles.minsaLookupAction}>
          <Button kind="tertiary" size="sm" renderIcon={Search} onClick={handleLookup} disabled={isLoading}>
            {t('minsaLookupButton', 'Buscar en MINSA')}
          </Button>
          {isLoading ? <InlineLoading description={t('minsaLookupLoading', 'Consultando MINSA')} /> : null}
        </div>
        {status ? (
          <InlineNotification
            className={styles.minsaLookupNotification}
            kind={status.kind}
            lowContrast
            title={status.title}
          />
        ) : null}
      </div>
    </div>
  );
};
