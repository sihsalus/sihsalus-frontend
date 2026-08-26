import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../../../constants';
import { searchLocalIdentityByDocument } from '../../identity/identity-search.resource';
import type { FormValues, PatientIdentifierType } from '../../patient-registration.types';
import { PatientRegistrationContext } from '../../patient-registration-context';
import {
  peruInsuranceAccreditationActiveConceptUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationNotConsultedConceptUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
  peruFinancerDependentAttributeTypeUuids,
  peruInsuranceSisConceptUuid,
  peruInsuranceTypeAttributeTypeUuid,
  peruInsuranceVerificationMethodAttributeTypeUuid,
  peruSisOnlyAttributeTypeUuids,
  peruTemporaryAffiliationPatientIdentifierTypeUuid,
  replacePeruInsuranceCoverageInForm,
} from '../../peru-registration-config';
import {
  hasTrustedSisVerificationEvidence,
  isValidIsoDateTime,
  normalizeTemporarySisCode,
  peruTemporarySisSiasisVerificationMethod,
} from '../../temporary-sis-affiliation';
import styles from '../field.scss';
import {
  getTemporaryAffiliationIdentifierEntry,
  isValidIdentityIdentifier,
  normalizeIdentityIdentifier,
} from './dni-identifier';

export { peruTemporarySisSiasisVerificationMethod } from '../../temporary-sis-affiliation';

export interface NewTemporarySisAffiliationCandidate {
  code: string;
  fieldName: string;
}

export type TemporarySisCoverageState = 'available' | 'already-recorded' | 'conflict';

type TemporarySisStatus = {
  kind: 'success' | 'warning' | 'error' | 'info';
  title: string;
};

type AppliedTemporarySisSnapshot = {
  appliedCoverage: Record<string, string>;
  code: string;
  previousCoverage: Record<string, string>;
};

function getIdentifierType(
  fieldName: string,
  identifierTypeUuid: string,
  identifierTypes: Array<PatientIdentifierType>,
) {
  return identifierTypes.find((type) => type.fieldName === fieldName || type.uuid === identifierTypeUuid);
}

/**
 * Only a code entered during the current registration/edit session is eligible.
 * Persisted, imported/hydrated, and auto-generated values must never be
 * reinterpreted as a fresh SIASIS result.
 */
export function getNewTemporarySisAffiliationCandidate(
  identifiers: FormValues['identifiers'],
  identifierTypes: Array<PatientIdentifierType>,
): NewTemporarySisAffiliationCandidate | null {
  const entry = getTemporaryAffiliationIdentifierEntry(identifiers, identifierTypes);
  if (!entry) {
    return null;
  }

  const [fieldName, identifier] = entry;
  if (identifier.identifierUuid || identifier.initialValue?.trim() || identifier.autoGeneration) {
    return null;
  }

  const identifierType = getIdentifierType(fieldName, identifier.identifierTypeUuid, identifierTypes);
  const code = normalizeIdentityIdentifier(
    identifier.identifierValue,
    peruTemporaryAffiliationPatientIdentifierTypeUuid,
    identifier.identifierName,
    identifierType,
  );

  if (
    !isValidIdentityIdentifier(
      code,
      peruTemporaryAffiliationPatientIdentifierTypeUuid,
      identifier.identifierName,
      identifierType,
    )
  ) {
    return null;
  }

  return { code, fieldName };
}

export function getTemporarySisCoverageState(
  attributes: FormValues['attributes'],
  temporaryCode: string,
): TemporarySisCoverageState {
  const currentAttributes = attributes ?? {};
  const payer = currentAttributes[peruInsuranceTypeAttributeTypeUuid];
  const insuranceCode = currentAttributes[peruInsuranceCodeAttributeTypeUuid];
  const accreditationStatus = currentAttributes[peruInsuranceAccreditationStatusAttributeTypeUuid];
  const checkedAt = currentAttributes[peruInsuranceAccreditationCheckedAtAttributeTypeUuid];
  const method = currentAttributes[peruInsuranceVerificationMethodAttributeTypeUuid];
  const hasSisDetails = peruSisOnlyAttributeTypeUuids.some((uuid) => Boolean(currentAttributes[uuid]));
  const hasDependentCoverage = Boolean(insuranceCode || accreditationStatus || checkedAt || method || hasSisDetails);

  if (!payer) {
    return hasDependentCoverage ? 'conflict' : 'available';
  }

  if (payer !== peruInsuranceSisConceptUuid) {
    return 'conflict';
  }

  const canonicalTemporaryCode = normalizeTemporarySisCode(temporaryCode);
  const canonicalInsuranceCode = normalizeTemporarySisCode(insuranceCode);

  if (!canonicalTemporaryCode) {
    return 'conflict';
  }

  if (insuranceCode?.trim() && canonicalInsuranceCode !== canonicalTemporaryCode) {
    return 'conflict';
  }

  if (!insuranceCode?.trim() && hasSisDetails) {
    return 'conflict';
  }

  if (accreditationStatus === peruInsuranceAccreditationActiveConceptUuid) {
    return canonicalInsuranceCode === canonicalTemporaryCode && hasTrustedSisVerificationEvidence(checkedAt, method)
      ? 'already-recorded'
      : 'conflict';
  }

  if (accreditationStatus && accreditationStatus !== peruInsuranceAccreditationNotConsultedConceptUuid) {
    return 'conflict';
  }

  if (checkedAt || method) {
    return 'conflict';
  }

  return 'available';
}

export function applyCurrentTemporarySisAffiliationToForm(
  code: string,
  checkedAt: string,
  currentAttributes: FormValues['attributes'],
  setFieldValue: (field: string, value: string, shouldValidate?: boolean) => unknown,
  setFieldTouched: (field: string, isTouched: boolean, shouldValidate?: boolean) => unknown,
) {
  return replacePeruInsuranceCoverageInForm(
    buildCurrentTemporarySisCoverage(code, checkedAt, currentAttributes),
    setFieldValue,
    setFieldTouched,
  );
}

function buildCurrentTemporarySisCoverage(
  code: string,
  checkedAt: string,
  currentAttributes: FormValues['attributes'],
) {
  const coverage: Record<string, string> = {
    [peruInsuranceTypeAttributeTypeUuid]: peruInsuranceSisConceptUuid,
    [peruInsuranceCodeAttributeTypeUuid]: code,
    [peruInsuranceAccreditationStatusAttributeTypeUuid]: peruInsuranceAccreditationActiveConceptUuid,
    [peruInsuranceAccreditationCheckedAtAttributeTypeUuid]: checkedAt,
    [peruInsuranceVerificationMethodAttributeTypeUuid]: peruTemporarySisSiasisVerificationMethod,
  };

  if (currentAttributes?.[peruInsuranceTypeAttributeTypeUuid] === peruInsuranceSisConceptUuid) {
    peruSisOnlyAttributeTypeUuids.forEach((uuid) => {
      if (currentAttributes[uuid]) {
        coverage[uuid] = currentAttributes[uuid];
      }
    });
  }

  return coverage;
}

function captureCoverage(attributes: FormValues['attributes']) {
  const coverage: Record<string, string> = {};
  [peruInsuranceTypeAttributeTypeUuid, ...peruFinancerDependentAttributeTypeUuids].forEach((uuid) => {
    if (attributes?.[uuid]) {
      coverage[uuid] = attributes[uuid];
    }
  });
  return coverage;
}

function restoreCoverage(
  coverage: Record<string, string>,
  setFieldValue: (field: string, value: string, shouldValidate?: boolean) => unknown,
  setFieldTouched: (field: string, isTouched: boolean, shouldValidate?: boolean) => unknown,
) {
  if (coverage[peruInsuranceTypeAttributeTypeUuid]) {
    replacePeruInsuranceCoverageInForm(coverage, setFieldValue, setFieldTouched);
    return;
  }

  [peruInsuranceTypeAttributeTypeUuid, ...peruFinancerDependentAttributeTypeUuids].forEach((uuid) => {
    setFieldValue(`attributes.${uuid}`, '', false);
  });
}

function coverageMatchesAppliedSnapshot(attributes: FormValues['attributes'], snapshot: AppliedTemporarySisSnapshot) {
  return [
    peruInsuranceTypeAttributeTypeUuid,
    peruInsuranceCodeAttributeTypeUuid,
    peruInsuranceAccreditationStatusAttributeTypeUuid,
    peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
    peruInsuranceVerificationMethodAttributeTypeUuid,
  ].every((uuid) => (attributes?.[uuid] ?? '') === (snapshot.appliedCoverage[uuid] ?? ''));
}

function hasIndependentCoverageEvidence(
  attributes: FormValues['attributes'],
  snapshot: AppliedTemporarySisSnapshot,
) {
  const payer = attributes?.[peruInsuranceTypeAttributeTypeUuid];
  const status = attributes?.[peruInsuranceAccreditationStatusAttributeTypeUuid];
  const checkedAt = attributes?.[peruInsuranceAccreditationCheckedAtAttributeTypeUuid];
  const method = attributes?.[peruInsuranceVerificationMethodAttributeTypeUuid]?.trim();

  if (
    !payer ||
    !status ||
    !isValidIsoDateTime(checkedAt) ||
    checkedAt === snapshot.appliedCoverage[peruInsuranceAccreditationCheckedAtAttributeTypeUuid]
  ) {
    return false;
  }

  return payer === peruInsuranceSisConceptUuid ? method === 'manual-web' || method === 'setisis' : method === 'siteds';
}

function clearInvalidatedTemporarySisEvidence(
  attributes: FormValues['attributes'],
  snapshot: AppliedTemporarySisSnapshot,
  setFieldValue: (field: string, value: string, shouldValidate?: boolean) => unknown,
) {
  [
    peruInsuranceAccreditationStatusAttributeTypeUuid,
    peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
    peruInsuranceVerificationMethodAttributeTypeUuid,
  ].forEach((uuid) => {
    setFieldValue(`attributes.${uuid}`, '', false);
  });

  if (
    attributes?.[peruInsuranceTypeAttributeTypeUuid] !== peruInsuranceSisConceptUuid &&
    normalizeTemporarySisCode(attributes?.[peruInsuranceCodeAttributeTypeUuid]) === snapshot.code
  ) {
    setFieldValue(`attributes.${peruInsuranceCodeAttributeTypeUuid}`, '', false);
  }

  if (attributes?.[peruInsuranceTypeAttributeTypeUuid] !== peruInsuranceSisConceptUuid) {
    peruSisOnlyAttributeTypeUuids.forEach((uuid) => {
      setFieldValue(`attributes.${uuid}`, '', false);
    });
  }
}

export const TemporarySisAffiliationConfirmation = () => {
  const { t } = useTranslation(moduleName);
  const registrationContext = useContext(PatientRegistrationContext);
  const { identifierTypes = [], isOffline, setFieldTouched, setFieldValue, values } = registrationContext;
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<TemporarySisStatus | null>(null);
  const [appliedSnapshot, setAppliedSnapshot] = useState<AppliedTemporarySisSnapshot | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const valuesRef = useRef(values);
  const isOfflineRef = useRef(isOffline);
  valuesRef.current = values;
  isOfflineRef.current = isOffline;

  const candidate = useMemo(
    () => getNewTemporarySisAffiliationCandidate(values.identifiers, identifierTypes),
    [identifierTypes, values.identifiers],
  );
  const candidateKey = candidate ? `${candidate.fieldName}:${candidate.code}` : '';
  const currentCandidateKey = useRef(candidateKey);
  const previousCandidateKey = useRef(candidateKey);
  currentCandidateKey.current = candidateKey;

  const temporaryEntry = useMemo(
    () => getTemporaryAffiliationIdentifierEntry(values.identifiers, identifierTypes),
    [identifierTypes, values.identifiers],
  );
  const currentTemporaryCode = temporaryEntry ? normalizeTemporarySisCode(temporaryEntry[1].identifierValue) : '';
  const coverageState = candidate ? getTemporarySisCoverageState(values.attributes, candidate.code) : 'available';

  useEffect(() => {
    if (previousCandidateKey.current === candidateKey) {
      return;
    }

    previousCandidateKey.current = candidateKey;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setIsChecking(false);
    setStatus(null);
  }, [candidateKey]);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!appliedSnapshot) {
      return;
    }

    const identifierStillMatches = currentTemporaryCode === appliedSnapshot.code;
    const coverageStillMatches = coverageMatchesAppliedSnapshot(values.attributes, appliedSnapshot);
    if (identifierStillMatches && coverageStillMatches) {
      return;
    }

    if (!identifierStillMatches && coverageStillMatches) {
      restoreCoverage(appliedSnapshot.previousCoverage, setFieldValue, setFieldTouched);
    } else if (hasIndependentCoverageEvidence(values.attributes, appliedSnapshot)) {
      setAppliedSnapshot(null);
      setStatus(null);
      return;
    } else {
      clearInvalidatedTemporarySisEvidence(values.attributes, appliedSnapshot, setFieldValue);
    }

    setAppliedSnapshot(null);
    setStatus({
      kind: 'warning',
      title: t(
        'temporarySisCurrentCodeChanged',
        'El código E o la cobertura cambió; la confirmación aplicada desde este control fue invalidada.',
      ),
    });
  }, [appliedSnapshot, currentTemporaryCode, setFieldTouched, setFieldValue, t, values.attributes]);

  const handleConfirm = async () => {
    if (!candidate || isChecking || isOffline || coverageState !== 'available') {
      return;
    }

    activeRequest.current?.abort();
    const abortController = new AbortController();
    activeRequest.current = abortController;
    const expectedCandidateKey = candidateKey;
    setIsChecking(true);
    setStatus(null);

    try {
      const matches = await searchLocalIdentityByDocument(
        candidate.code,
        abortController,
        {
          patientIdentifierTypeUuid: peruTemporaryAffiliationPatientIdentifierTypeUuid,
        },
        { requireFreshNetwork: true, signal: abortController.signal },
      );

      if (activeRequest.current !== abortController || currentCandidateKey.current !== expectedCandidateKey) {
        return;
      }

      if (matches.length) {
        setStatus({
          kind: 'warning',
          title: t(
            'temporarySisCurrentDuplicate',
            'Este código E ya pertenece a un registro. Busque al paciente antes de continuar.',
          ),
        });
        return;
      }

      const latestCandidate = getNewTemporarySisAffiliationCandidate(valuesRef.current.identifiers, identifierTypes);
      const latestCoverageState = latestCandidate
        ? getTemporarySisCoverageState(valuesRef.current.attributes, latestCandidate.code)
        : 'conflict';

      if (
        isOfflineRef.current ||
        !latestCandidate ||
        latestCandidate.code !== candidate.code ||
        latestCoverageState !== 'available'
      ) {
        setStatus({
          kind: 'warning',
          title: t(
            'temporarySisCurrentChangedBeforeApply',
            'El código E o la cobertura cambió durante la verificación. Revise los datos y vuelva a intentar.',
          ),
        });
        return;
      }

      const checkedAt = new Date().toISOString();
      const previousCoverage = captureCoverage(valuesRef.current.attributes);
      const appliedCoverage = buildCurrentTemporarySisCoverage(candidate.code, checkedAt, valuesRef.current.attributes);
      applyCurrentTemporarySisAffiliationToForm(
        candidate.code,
        checkedAt,
        valuesRef.current.attributes,
        setFieldValue,
        setFieldTouched,
      );
      setAppliedSnapshot({
        appliedCoverage,
        code: candidate.code,
        previousCoverage,
      });
      setStatus({
        kind: 'success',
        title: t('temporarySisCurrentApplied', 'SIS vigente registrado con el código E confirmado.'),
      });
    } catch {
      if (activeRequest.current !== abortController || abortController.signal.aborted) {
        return;
      }

      setStatus({
        kind: 'error',
        title: t(
          'temporarySisCurrentLookupError',
          'No se pudo comprobar el código E. No se aplicó la cobertura; vuelva a intentar con conexión.',
        ),
      });
    } finally {
      if (activeRequest.current === abortController) {
        activeRequest.current = null;
        setIsChecking(false);
      }
    }
  };

  if (!candidate) {
    return null;
  }

  const defaultStatus: TemporarySisStatus =
    coverageState === 'conflict'
      ? {
          kind: 'warning',
          title: t(
            'temporarySisCurrentCoverageConflict',
            'Ya existe información de cobertura incompatible. Revísela en Financiador antes de confirmar este código E.',
          ),
        }
      : coverageState === 'already-recorded'
        ? {
            kind: 'success',
            title: t(
              'temporarySisCurrentAlreadyRecorded',
              'La cobertura SIS vigente para este código E ya está registrada.',
            ),
          }
        : isOffline
          ? {
              kind: 'info',
              title: t('temporarySisCurrentOffline', 'Sin conexión no se puede confirmar ni acreditar este código E.'),
            }
          : {
              kind: 'info',
              title: t(
                'temporarySisCurrentConfirmation',
                'Confirme solo si este código E fue emitido o consultado ahora en SIASIS.',
              ),
            };

  const visibleStatus = coverageState === 'available' ? (status ?? defaultStatus) : defaultStatus;

  return (
    <div className={styles.temporarySisConfirmation}>
      <InlineNotification
        className={styles.externalLookupNotification}
        kind={visibleStatus.kind}
        lowContrast
        title={visibleStatus.title}
        subtitle={t(
          'temporarySisCurrentEffect',
          '{{code}} se guardará como código de afiliación, con financiador SIS y estado Vigente, solo después de una confirmación válida.',
          { code: candidate.code },
        )}
      />
      {coverageState === 'available' ? (
        <div className={styles.externalLookupAction}>
          <Button kind="tertiary" size="sm" onClick={handleConfirm} disabled={isChecking || isOffline}>
            {t('temporarySisCurrentConfirmAction', 'Confirmar SIS vigente para este código E')}
          </Button>
          {isChecking ? (
            <InlineLoading
              description={t('temporarySisCurrentChecking', 'Comprobando que el código E no esté registrado')}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
