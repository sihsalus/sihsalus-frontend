import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { Search, UserFollow } from '@carbon/react/icons';
import { navigate, useFeatureFlag } from '@openmrs/esm-framework';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 } from 'uuid';

import { externalIdentityLookupsFlag, moduleName } from '../../../constants';
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
  documentKey: string;
  kind: 'success' | 'warning' | 'error' | 'info';
  title: string;
};

type KeyedIdentityMatch<TMatch> = {
  documentKey: string;
  match: TMatch;
};

type PendingIdentityAction = 'lookup' | 'promotion' | null;

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
  const externalLookupsEnabled = useFeatureFlag(externalIdentityLookupsFlag);
  const { identifierTypes, values, setFieldValue, setFieldTouched, isOffline } = useContext(PatientRegistrationContext);
  const [pendingAction, setPendingAction] = useState<PendingIdentityAction>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus | null>(null);
  const [patientMatchState, setPatientMatchState] = useState<KeyedIdentityMatch<LocalPatientIdentityMatch> | null>(
    null,
  );
  const [personMatchState, setPersonMatchState] = useState<KeyedIdentityMatch<LocalPersonIdentityMatch> | null>(null);
  const activeRequest = useRef<{ abortController: AbortController; id: number } | null>(null);
  const requestSequence = useRef(0);

  const documentEntry = useMemo(
    () => getDocumentIdentifierEntry(values.identifiers ?? {}, identifierTypes ?? []),
    [identifierTypes, values.identifiers],
  );
  const documentValue = documentEntry?.[1]?.identifierValue?.trim() ?? '';
  const documentName = documentEntry?.[1]?.identifierName ?? '';
  const documentIdentifierType = documentEntry
    ? identifierTypes?.find(
        (identifierType) =>
          identifierType.fieldName === documentEntry[0] || identifierType.uuid === documentEntry[1].identifierTypeUuid,
      )
    : undefined;
  const documentIdentifierTypeUuid = documentEntry?.[1]?.identifierTypeUuid ?? documentIdentifierType?.uuid;
  const documentDefinition = getDocumentTypeDefinitionByIdentifierType(documentIdentifierTypeUuid);
  const normalizedDocumentNumber = normalizeDocumentNumber(documentValue, documentDefinition);
  const documentKey = documentEntry ? `${documentIdentifierTypeUuid ?? ''}:${normalizedDocumentNumber}` : '';
  const currentDocumentKey = useRef(documentKey);
  const previousDocumentKey = useRef(documentKey);
  currentDocumentKey.current = documentKey;
  const promotionActive = !!values.personUuidToPromote;
  const patientMatch = patientMatchState?.documentKey === documentKey ? patientMatchState.match : null;
  const personMatch = personMatchState?.documentKey === documentKey ? personMatchState.match : null;
  const status = lookupStatus?.documentKey === documentKey ? lookupStatus : null;
  const isBusy = pendingAction !== null;
  const isLoading = pendingAction === 'lookup';
  const isActivatingPromotion = pendingAction === 'promotion';

  const resetMatches = () => {
    setPatientMatchState(null);
    setPersonMatchState(null);
  };

  const startIdentityRequest = (action: Exclude<PendingIdentityAction, null>) => {
    activeRequest.current?.abortController.abort();
    const request = {
      abortController: new AbortController(),
      id: ++requestSequence.current,
    };
    activeRequest.current = request;
    setPendingAction(action);
    return request;
  };

  const isCurrentRequest = (request: { id: number }, expectedDocumentKey: string) =>
    request.id === activeRequest.current?.id && expectedDocumentKey === currentDocumentKey.current;

  const searchDocument = (request: { abortController: AbortController }, expectedDocumentNumber: string) =>
    searchLocalIdentityByDocument(expectedDocumentNumber, request.abortController, {
      patientIdentifierTypeUuid: documentDefinition?.patientIdentifierTypeUuid ?? undefined,
      personDocumentTypeConceptUuid: documentDefinition?.documentTypeConceptUuid,
    });

  const showChangedLookupResult = (
    matches: Array<LocalPatientIdentityMatch | LocalPersonIdentityMatch>,
    expectedDocumentKey: string,
  ) => {
    const foundPatient = matches.find((match): match is LocalPatientIdentityMatch => match.kind === 'patient');
    const foundPerson = matches.find((match): match is LocalPersonIdentityMatch => match.kind === 'person');
    setPatientMatchState(foundPatient ? { documentKey: expectedDocumentKey, match: foundPatient } : null);
    setPersonMatchState(foundPerson ? { documentKey: expectedDocumentKey, match: foundPerson } : null);
    setLookupStatus({
      documentKey: expectedDocumentKey,
      kind: 'warning',
      title: t(
        'identityLookupResultChanged',
        'La coincidencia cambió o ya no está disponible. Revise el documento y vuelva a buscar antes de continuar.',
      ),
    });
  };

  useEffect(() => {
    if (previousDocumentKey.current === documentKey) {
      return;
    }

    previousDocumentKey.current = documentKey;
    activeRequest.current?.abortController.abort();
    activeRequest.current = null;
    requestSequence.current += 1;
    setPendingAction(null);
    setPatientMatchState(null);
    setPersonMatchState(null);
    // An active promotion selection lives in the form values, so it survives a
    // document edit; save-time guards reject the mismatch, but warn now so the
    // operator does not find out only when the registration fails.
    setLookupStatus(
      promotionActive
        ? {
            documentKey,
            kind: 'warning',
            title: t(
              'identityLookupPromotionDocumentChanged',
              'El documento cambió después de seleccionar una persona para promover. Verifique la selección o quítela antes de guardar.',
            ),
          }
        : null,
    );
  }, [documentKey, promotionActive, t]);

  useEffect(
    () => () => {
      activeRequest.current?.abortController.abort();
      activeRequest.current = null;
      requestSequence.current += 1;
    },
    [],
  );

  const handleLookup = async () => {
    resetMatches();

    if (!documentEntry) {
      setLookupStatus({
        documentKey,
        kind: 'warning',
        title: t(
          'identityLookupNoDocument',
          'Ingrese un número de documento (DNI, CE, pasaporte, cédula de identidad o CNV)',
        ),
      });
      return;
    }

    if (!isValidDocumentNumber(normalizedDocumentNumber, documentDefinition)) {
      setLookupStatus({
        documentKey,
        kind: 'warning',
        title: t('identityLookupInvalidDocument', 'El número no tiene el formato esperado para este documento'),
      });
      return;
    }

    const request = startIdentityRequest('lookup');
    const expectedDocumentKey = documentKey;
    setLookupStatus(null);

    try {
      const matches = await searchDocument(request, normalizedDocumentNumber);
      if (!isCurrentRequest(request, expectedDocumentKey)) {
        return;
      }

      const foundPatient = matches.find((match): match is LocalPatientIdentityMatch => match.kind === 'patient');
      const foundPerson = matches.find((match): match is LocalPersonIdentityMatch => match.kind === 'person');

      if (foundPatient) {
        setPatientMatchState({ documentKey: expectedDocumentKey, match: foundPatient });
        setLookupStatus({
          documentKey: expectedDocumentKey,
          kind: 'warning',
          title: t('identityLookupPatientExists', 'Ya existe un paciente con este documento. No lo registre de nuevo.'),
        });
        return;
      }

      if (foundPerson) {
        setPersonMatchState({ documentKey: expectedDocumentKey, match: foundPerson });
        setLookupStatus({
          documentKey: expectedDocumentKey,
          kind: 'info',
          title: t(
            'identityLookupPersonExists',
            'Existe una persona registrada (no paciente) con este documento, por ejemplo un responsable o acompañante.',
          ),
        });
        return;
      }

      if (externalLookupsEnabled && documentDefinition?.documentTypeConceptUuid === documentTypeConceptUuids.dni) {
        const identity = await lookupReniecIdentityByDni(normalizedDocumentNumber);
        if (!isCurrentRequest(request, expectedDocumentKey)) {
          return;
        }

        if (identity) {
          applyReniecIdentityToForm(identity, setFieldValue, setFieldTouched);
          setLookupStatus({
            documentKey: expectedDocumentKey,
            kind: 'success',
            title: t('reniecLookupSuccess', 'Datos RENIEC cargados'),
          });
          return;
        }

        setLookupStatus({
          documentKey: expectedDocumentKey,
          kind: 'warning',
          title: t(
            'identityLookupNoMatches',
            'Sin coincidencias locales ni datos RENIEC. Registre los datos manualmente; la identidad quedará no verificada.',
          ),
        });
        return;
      }

      setLookupStatus({
        documentKey: expectedDocumentKey,
        kind: 'info',
        title: externalLookupsEnabled
          ? t(
              'identityLookupNoLocalMatches',
              'Sin coincidencias locales. Registre los datos manualmente (RENIEC solo aplica a DNI).',
            )
          : t('identityLookupNoLocalMatchesManual', 'Sin coincidencias locales. Registre los datos manualmente.'),
      });
    } catch (error) {
      if (!isCurrentRequest(request, expectedDocumentKey)) {
        return;
      }
      console.error('Local identity search failed', error);
      setLookupStatus({
        documentKey: expectedDocumentKey,
        kind: 'error',
        title: t('identityLookupError', 'No se pudo buscar la identidad. Intente nuevamente.'),
      });
    } finally {
      if (isCurrentRequest(request, expectedDocumentKey)) {
        setPendingAction(null);
      }
    }
  };

  const handleOpenExistingPatient = async () => {
    if (!patientMatchState || patientMatchState.documentKey !== documentKey || !patientMatch) {
      return;
    }

    const expectedDocumentKey = patientMatchState.documentKey;
    const request = startIdentityRequest('lookup');

    try {
      const matches = await searchDocument(request, normalizedDocumentNumber);
      if (!isCurrentRequest(request, expectedDocumentKey)) {
        return;
      }

      const verifiedPatient = matches.find(
        (match): match is LocalPatientIdentityMatch => match.kind === 'patient' && match.uuid === patientMatch.uuid,
      );
      if (!verifiedPatient) {
        showChangedLookupResult(matches, expectedDocumentKey);
        return;
      }

      navigate({ to: `\${openmrsSpaBase}/patient/${verifiedPatient.uuid}/chart` });
    } catch (error) {
      if (!isCurrentRequest(request, expectedDocumentKey)) {
        return;
      }
      console.error('Could not revalidate the patient identity match', error);
      setLookupStatus({
        documentKey: expectedDocumentKey,
        kind: 'error',
        title: t('identityLookupRevalidationError', 'No se pudo confirmar la coincidencia. Vuelva a buscar.'),
      });
    } finally {
      if (isCurrentRequest(request, expectedDocumentKey)) {
        setPendingAction(null);
      }
    }
  };

  const handlePromotePerson = async () => {
    if (!personMatchState || personMatchState.documentKey !== documentKey || !personMatch) {
      return;
    }

    const expectedDocumentKey = personMatchState.documentKey;
    const request = startIdentityRequest('promotion');

    try {
      const matches = await searchDocument(request, normalizedDocumentNumber);
      if (!isCurrentRequest(request, expectedDocumentKey)) {
        return;
      }

      const patientNowUsingDocument = matches.find(
        (match): match is LocalPatientIdentityMatch => match.kind === 'patient',
      );
      if (patientNowUsingDocument) {
        setPatientMatchState({ documentKey: expectedDocumentKey, match: patientNowUsingDocument });
        setPersonMatchState(null);
        setLookupStatus({
          documentKey: expectedDocumentKey,
          kind: 'warning',
          title: t('identityLookupPatientExists', 'Ya existe un paciente con este documento. No lo registre de nuevo.'),
        });
        return;
      }

      const verifiedPerson = matches.find(
        (match): match is LocalPersonIdentityMatch => match.kind === 'person' && match.uuid === personMatch.uuid,
      );
      if (!verifiedPerson) {
        showChangedLookupResult(matches, expectedDocumentKey);
        return;
      }

      const person = await fetchPersonForPromotion(verifiedPerson.uuid, request.abortController);
      if (!isCurrentRequest(request, expectedDocumentKey)) {
        return;
      }

      applyPersonToRegistrationForm(person, setFieldValue, setFieldTouched);
      setPersonMatchState(null);
      setLookupStatus({
        documentKey: expectedDocumentKey,
        kind: 'success',
        title: t(
          'identityLookupPromotionReady',
          'Persona cargada. Al guardar se convertirá en paciente conservando su registro y sus relaciones.',
        ),
      });
    } catch (error) {
      if (!isCurrentRequest(request, expectedDocumentKey)) {
        return;
      }
      console.error('Could not load the person for promotion', error);
      setLookupStatus({
        documentKey: expectedDocumentKey,
        kind: 'error',
        title: t('identityLookupPromotionError', 'No se pudo cargar la persona seleccionada'),
      });
    } finally {
      if (isCurrentRequest(request, expectedDocumentKey)) {
        setPendingAction(null);
      }
    }
  };

  const handleClearPromotion = () => {
    clearPromotionSelection(v4(), setFieldValue);
    setLookupStatus(null);
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
        <Button
          className={styles.externalLookupButton}
          kind="tertiary"
          size="sm"
          renderIcon={Search}
          onClick={handleLookup}
          disabled={isBusy || isOffline}
        >
          {externalLookupsEnabled
            ? t('identityLookupButton', 'Buscar en base local y RENIEC')
            : t('identityLookupLocalButton', 'Buscar en base local')}
        </Button>
        {isLoading ? <InlineLoading description={t('identityLookupLoading', 'Buscando identidad')} /> : null}
      </div>
      {isOffline ? (
        <InlineNotification
          className={styles.externalLookupNotification}
          kind="info"
          lowContrast
          title={
            externalLookupsEnabled
              ? t('identityLookupOffline', 'Sin conexión: la búsqueda local y RENIEC no están disponibles.')
              : t('identityLookupLocalOffline', 'Sin conexión: la búsqueda local no está disponible.')
          }
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
          <Button kind="ghost" size="sm" onClick={handleOpenExistingPatient} disabled={isBusy}>
            {t('identityLookupOpenPatient', 'Abrir paciente existente')}
          </Button>
        </div>
      ) : null}
      {personMatch && !promotionActive ? (
        <div className={styles.externalLookupAction}>
          <span>{personMatch.display}</span>
          <Button kind="ghost" size="sm" renderIcon={UserFollow} onClick={handlePromotePerson} disabled={isBusy}>
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
