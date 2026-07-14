import { getPeruIdentityDocumentRule, type PeruIdentityDocumentRule } from '@openmrs/esm-utils';

import type { FetchedPatientIdentifierType, PatientIdentifierValue } from './patient-registration.types';
import {
  peruCarnetExtranjeriaPatientIdentifierTypeUuid,
  peruDiePatientIdentifierTypeUuid,
  peruDniPatientIdentifierTypeUuid,
  peruPassportPatientIdentifierTypeUuid,
} from './peru-registration-config';

export const peruDniPattern = /^\d{8}$/;

export type PeruIdentifierRule = PeruIdentityDocumentRule;

function normalizeIdentifierName(name?: string) {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function getPeruIdentifierRule(
  identifierType?: Pick<FetchedPatientIdentifierType, 'uuid' | 'name'> | null,
  identifier?: Pick<PatientIdentifierValue, 'identifierTypeUuid' | 'identifierName'> | null,
): PeruIdentifierRule | undefined {
  const uuid = identifierType?.uuid ?? identifier?.identifierTypeUuid;
  const name = normalizeIdentifierName(identifierType?.name ?? identifier?.identifierName);

  if (uuid === peruDniPatientIdentifierTypeUuid || name === 'DNI') {
    return getPeruIdentityDocumentRule('dni');
  }

  if (uuid === peruCarnetExtranjeriaPatientIdentifierTypeUuid || name === 'CE' || name.includes('EXTRANJERIA')) {
    return getPeruIdentityDocumentRule('ce');
  }

  if (name === 'CNV' || name.includes('CERTIFICADO DE NACIDO VIVO')) {
    return getPeruIdentityDocumentRule('cnv');
  }

  if (uuid === peruDiePatientIdentifierTypeUuid || name === 'DIE' || name.includes('IDENTIDAD EXTRANJERO')) {
    return getPeruIdentityDocumentRule('die');
  }

  if (uuid === peruPassportPatientIdentifierTypeUuid || name === 'PASS' || name.includes('PASAPORTE')) {
    return getPeruIdentityDocumentRule('passport');
  }

  return undefined;
}
