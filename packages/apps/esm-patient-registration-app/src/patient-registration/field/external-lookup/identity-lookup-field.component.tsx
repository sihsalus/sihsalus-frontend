import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { Search, UserFollow } from '@carbon/react/icons';
import { navigate } from '@openmrs/esm-framework';
import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 } from 'uuid';

import { moduleName } from '../../../constants';
import {
  documentTypeConceptUuids,
  getDocumentTypeDefinitionByIdentifierType,
  identityVerificationSourceConceptUuids,
  identityVerificationStatusConceptUuids,
  isValidDocumentNumber,
  normalizeDocumentNumber,
  personIdentityVerificationSourceAttributeTypeUuid,
  personIdentityVerificationStatusAttributeTypeUuid,
  personIdentityVerifiedAtAttributeTypeUuid,
} from '../../identity/identity-documents';
import {
  fetchPersonForPromotion,
  type LocalPatientIdentityMatch,
  type LocalPersonIdentityMatch,
  searchLocalIdentityByDocument,
} from '../../identity/identity-search.resource';
import { applyPersonToRegistrationForm, clearPromotionSelection } from '../../identity/promotion';
import { PatientRegistrationContext } from '../../patient-registration-context';
import styles from '../field.scss';
import { getDocumentIdentifierEntry } from './dni-identifier';
import { lookupReniecIdentityByDni, type ReniecIdentityLookupResult } from './reniec-lookup.resource';

type LookupStatus = {
  kind: 'success' | 'warning' | 'error' | 'info';
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
    [
      `attributes.${personIdentityVerificationStatusAttributeTypeUuid}`,
      identityVerificationStatusConceptUuids.verifiedByReniec,
    ],
    [`attributes.${personIdentityVerificationSourceAttributeTypeUuid}`, identityVerificationSourceConceptUuids.reniec],
    [`attributes.${personIdentityVerifiedAtAttributeTypeUuid}`, new Date().toISOString()],
  ];

  fieldValues.forEach(([field, value]) => {
    setFieldValue(field, value, false);
    setFieldTouched(field, true, false);
  });
}

/**
 * "Buscar/validar identidad": resolves the typed document against the local database
 * first — patients by identifier, then persons (e.g. responsables) by document
 * attribute — and only afterwards consults RENIEC (currently a mock; the identitylookup
 * OMOD is not deployed yet). Finding a local person offers promotion: the form is
 * hydrated with that person and submitting reuses their UUID instead of creating a
 * duplicate.
 */
export const IdentityLookupField = () => {
  const { t } = useTranslation(moduleName);
  const { identifierTypes, values, setFieldValue, setFieldTouched, isOffline } = useContext(PatientRegistrationContext);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivatingPromotion, setIsActivatingPromotion] = useState(false);
  const [status, setStatus] = useState<LookupStatus | null>(null);
  const [patientMatch, setPatientMatch] = useState<LocalPatientIdentityMatch | null>(null);
  const [personMatch, setPersonMatch] = useState<LocalPersonIdentityMatch | null>(null);

  const documentEntry = useMemo(
    () => getDocumentIdentifierEntry(values.identifiers ?? {}, identifierTypes ?? []),
    [identifierTypes, values.identifiers],
  );
  const documentValue = documentEntry?.[1]?.identifierValue?.trim() ?? '';
  const documentName = documentEntry?.[1]?.identifierName ?? '';
  const promotionActive = !!values.personUuidToPromote;

  const resetMatches = () => {
    setPatientMatch(null);
    setPersonMatch(null);
  };

  const handleLookup = async () => {
    resetMatches();

    if (!documentEntry) {
      setStatus({
        kind: 'warning',
        title: t('identityLookupNoDocument', 'Ingrese un número de documento (DNI, CE, pasaporte, DIE o CNV)'),
      });
      return;
    }

    const definition = getDocumentTypeDefinitionByIdentifierType(documentEntry[1].identifierTypeUuid);
    const normalizedNumber = normalizeDocumentNumber(documentValue, definition);

    if (!isValidDocumentNumber(normalizedNumber, definition)) {
      setStatus({
        kind: 'warning',
        title: t('identityLookupInvalidDocument', 'El número no tiene el formato esperado para este documento'),
      });
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      const matches = await searchLocalIdentityByDocument(normalizedNumber);
      const foundPatient = matches.find((match): match is LocalPatientIdentityMatch => match.kind === 'patient');
      const foundPerson = matches.find((match): match is LocalPersonIdentityMatch => match.kind === 'person');

      if (foundPatient) {
        setPatientMatch(foundPatient);
        setStatus({
          kind: 'warning',
          title: t('identityLookupPatientExists', 'Ya existe un paciente con este documento. No lo registre de nuevo.'),
        });
        return;
      }

      if (foundPerson) {
        setPersonMatch(foundPerson);
        setStatus({
          kind: 'info',
          title: t(
            'identityLookupPersonExists',
            'Existe una persona registrada (no paciente) con este documento, por ejemplo un responsable o acompañante.',
          ),
        });
        return;
      }

      if (definition?.documentTypeConceptUuid === documentTypeConceptUuids.dni) {
        const identity = await lookupReniecIdentityByDni(normalizedNumber);

        if (identity) {
          applyReniecIdentityToForm(identity, setFieldValue, setFieldTouched);
          setStatus({
            kind: 'success',
            title: t('reniecLookupSuccess', 'Datos RENIEC cargados'),
          });
          return;
        }

        setStatus({
          kind: 'warning',
          title: t(
            'identityLookupNoMatches',
            'Sin coincidencias locales ni datos RENIEC. Registre los datos manualmente; la identidad quedará no verificada.',
          ),
        });
        return;
      }

      setStatus({
        kind: 'info',
        title: t(
          'identityLookupNoLocalMatches',
          'Sin coincidencias locales. Registre los datos manualmente (RENIEC solo aplica a DNI).',
        ),
      });
    } catch (error) {
      console.error('Local identity search failed', error);
      setStatus({
        kind: 'error',
        title: t('identityLookupError', 'No se pudo buscar la identidad. Intente nuevamente.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenExistingPatient = () => {
    if (patientMatch) {
      navigate({ to: `\${openmrsSpaBase}/patient/${patientMatch.uuid}/chart` });
    }
  };

  const handlePromotePerson = async () => {
    if (!personMatch) {
      return;
    }

    setIsActivatingPromotion(true);

    try {
      const person = await fetchPersonForPromotion(personMatch.uuid);
      applyPersonToRegistrationForm(person, setFieldValue, setFieldTouched);
      setPersonMatch(null);
      setStatus({
        kind: 'success',
        title: t(
          'identityLookupPromotionReady',
          'Persona cargada. Al guardar se convertirá en paciente conservando su registro y sus relaciones.',
        ),
      });
    } catch (error) {
      console.error('Could not load the person for promotion', error);
      setStatus({
        kind: 'error',
        title: t('identityLookupPromotionError', 'No se pudo cargar la persona seleccionada'),
      });
    } finally {
      setIsActivatingPromotion(false);
    }
  };

  const handleClearPromotion = () => {
    clearPromotionSelection(v4(), setFieldValue);
    setStatus(null);
  };

  return (
    <div className={styles.externalLookup}>
      <div className={styles.externalLookupHeader}>
        <h4 className={styles.productiveHeading02Light}>{t('identityLookupTitle', 'Buscar/validar identidad')}</h4>
        {documentValue ? (
          <span className={styles.externalLookupDocument}>
            {documentName} {documentValue}
          </span>
        ) : null}
      </div>
      <div className={styles.externalLookupAction}>
        <Button kind="tertiary" size="sm" renderIcon={Search} onClick={handleLookup} disabled={isLoading || isOffline}>
          {t('identityLookupButton', 'Buscar en base local y RENIEC')}
        </Button>
        {isLoading ? <InlineLoading description={t('identityLookupLoading', 'Buscando identidad')} /> : null}
      </div>
      {isOffline ? (
        <InlineNotification
          className={styles.externalLookupNotification}
          kind="info"
          lowContrast
          title={t('identityLookupOffline', 'Sin conexión: la búsqueda local y RENIEC no están disponibles.')}
        />
      ) : null}
      {status ? (
        <InlineNotification
          className={styles.externalLookupNotification}
          kind={status.kind === 'info' ? 'info' : status.kind}
          lowContrast
          title={status.title}
        />
      ) : null}
      {patientMatch ? (
        <div className={styles.externalLookupAction}>
          <span>{patientMatch.display}</span>
          <Button kind="ghost" size="sm" onClick={handleOpenExistingPatient}>
            {t('identityLookupOpenPatient', 'Abrir paciente existente')}
          </Button>
        </div>
      ) : null}
      {personMatch && !promotionActive ? (
        <div className={styles.externalLookupAction}>
          <span>{personMatch.display}</span>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={UserFollow}
            onClick={handlePromotePerson}
            disabled={isActivatingPromotion}
          >
            {t('identityLookupPromoteAction', 'Registrar como paciente (reutiliza su registro)')}
          </Button>
          {isActivatingPromotion ? (
            <InlineLoading description={t('identityLookupLoadingPerson', 'Cargando persona')} />
          ) : null}
        </div>
      ) : null}
      {promotionActive ? (
        <>
          <InlineNotification
            className={styles.externalLookupNotification}
            kind="info"
            lowContrast
            title={t(
              'identityLookupPromotionActive',
              'Se reutilizará el registro de una persona existente: al guardar, esa persona se convertirá en paciente sin crear duplicados.',
            )}
          />
          <Button kind="ghost" size="sm" onClick={handleClearPromotion}>
            {t('identityLookupClearPromotion', 'Quitar selección')}
          </Button>
        </>
      ) : null}
    </div>
  );
};
