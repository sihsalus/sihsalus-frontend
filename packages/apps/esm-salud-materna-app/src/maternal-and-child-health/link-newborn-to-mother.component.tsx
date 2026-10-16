import { Button, InlineLoading, InlineNotification, Modal, RadioButton, TextInput } from '@carbon/react';
import { userHasAccess, useConfig, useSession } from '@openmrs/esm-framework';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../config-schema';
import { addRelationshipsPrivilege, labourDeliveryEditPrivilege, maternalPatientChartPrivilege } from '../constants';
import {
  createMotherChildRelationship,
  type NewbornPatient,
  useMotherAndChildLinks,
  useNewbornPatientSearch,
} from './mother-child-relationship.resource';
import styles from './link-newborn-to-mother.scss';

const minimumSearchLength = 3;

interface LinkNewbornToMotherProps {
  motherUuid: string;
}

const LinkNewbornToMother: React.FC<LinkNewbornToMotherProps> = ({ motherUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canLinkNewborn =
    session?.authenticated === true &&
    userHasAccess(maternalPatientChartPrivilege, session.user) &&
    userHasAccess(labourDeliveryEditPrivilege, session.user) &&
    userHasAccess(addRelationshipsPrivilege, session.user);
  const [isOpen, setIsOpen] = useState(false);

  if (!canLinkNewborn) {
    return null;
  }

  return (
    <>
      <div className={styles.linkNewbornActions}>
        <Button kind="tertiary" size="sm" onClick={() => setIsOpen(true)}>
          {t('linkNewbornToMother', 'Vincular recién nacido')}
        </Button>
      </div>
      {isOpen && <LinkNewbornModal motherUuid={motherUuid} onClose={() => setIsOpen(false)} />}
    </>
  );
};

interface LinkNewbornModalProps {
  motherUuid: string;
  onClose: () => void;
}

const LinkNewbornModal: React.FC<LinkNewbornModalProps> = ({ motherUuid, onClose }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const searchId = useId();
  const canLinkNewborn =
    session?.authenticated === true &&
    userHasAccess(maternalPatientChartPrivilege, session.user) &&
    userHasAccess(labourDeliveryEditPrivilege, session.user) &&
    userHasAccess(addRelationshipsPrivilege, session.user);
  const relationshipTypeUuid = config?.motherChildRelationshipTypeUuid?.trim();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<NewbornPatient>();
  const selectedPersonUuid = selectedPatient?.person?.uuid ?? selectedPatient?.uuid;
  const [isSaving, setIsSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unconfirmed'>();
  const {
    data: links,
    error: linksError,
    isLoading: isLoadingLinks,
    isValidating: isValidatingLinks,
    mutate: reloadLinks,
  } = useMotherAndChildLinks({ motherUuid }, canLinkNewborn);
  const {
    data: selectedPatientLinks,
    error: selectedPatientLinksError,
    isLoading: isLoadingSelectedPatientLinks,
    isValidating: isValidatingSelectedPatientLinks,
    mutate: reloadSelectedPatientLinks,
  } = useMotherAndChildLinks({ childUuid: selectedPatient?.uuid }, canLinkNewborn && !!selectedPatient?.uuid);
  const {
    patients: searchResults,
    error: searchError,
    isLoading: isSearching,
    mutate: retrySearch,
  } = useNewbornPatientSearch(searchQuery, canLinkNewborn);

  useEffect(() => {
    if (!canLinkNewborn) {
      onClose();
    }
  }, [canLinkNewborn, onClose]);

  const linkedChildUuids = useMemo(
    () => new Set((links ?? []).map(({ child }) => child?.uuid).filter((uuid): uuid is string => Boolean(uuid))),
    [links],
  );
  const eligibleSearchResults = useMemo(
    () =>
      searchResults
        .filter((patient) => !patient.voided && !patient.person?.voided)
        .filter((patient) => patient.uuid !== motherUuid && patient.person?.uuid !== motherUuid),
    [motherUuid, searchResults],
  );
  const selectedAlreadyLinked =
    !!selectedPatient &&
    (linkedChildUuids.has(selectedPatient.uuid) ||
      (!!selectedPersonUuid && linkedChildUuids.has(selectedPersonUuid)) ||
      (selectedPatientLinks ?? []).some(({ mother }) => mother.uuid === motherUuid));
  const selectedLinkedToAnotherMother =
    !!selectedPatient && (selectedPatientLinks ?? []).some(({ mother }) => mother.uuid !== motherUuid);
  const isSearchReady = searchQuery.trim().length >= minimumSearchLength;
  const canSave =
    canLinkNewborn &&
    !!relationshipTypeUuid &&
    !!selectedPatient &&
    !!selectedPersonUuid &&
    !selectedAlreadyLinked &&
    Array.isArray(links) &&
    Array.isArray(selectedPatientLinks) &&
    !linksError &&
    !selectedPatientLinksError &&
    !isLoadingLinks &&
    !isValidatingLinks &&
    !isLoadingSelectedPatientLinks &&
    !isValidatingSelectedPatientLinks &&
    !selectedLinkedToAnotherMother &&
    !isSaving &&
    !saveStatus;

  const updateSearch = (value: string) => {
    setSearchQuery(value);
    setSelectedPatient(undefined);
    setSaveStatus(undefined);
  };

  const selectPatient = (patient: NewbornPatient) => {
    setSelectedPatient(patient);
    setSaveStatus(undefined);
  };

  const handleSave = async () => {
    if (!canSave || saveInFlight.current || !selectedPatient || !selectedPersonUuid || !relationshipTypeUuid) {
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setSaveStatus(undefined);
    try {
      const response = await createMotherChildRelationship(motherUuid, selectedPersonUuid, relationshipTypeUuid);
      if (!response.data?.uuid) {
        throw new Error('The server did not confirm the saved mother-child relationship.');
      }
      setSaveStatus('saved');
      void reloadLinks();
    } catch {
      setSaveStatus('unconfirmed');
      void reloadLinks();
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  const displayPatient = (patient: NewbornPatient) => patient.person?.display ?? patient.display ?? '';
  const getPatientIdentifier = (patient: NewbornPatient) =>
    patient.identifiers?.find((identifier) => !identifier.voided && identifier.preferred)?.identifier ??
    patient.identifiers?.find((identifier) => !identifier.voided)?.identifier;

  if (!canLinkNewborn) {
    return null;
  }

  return (
    <Modal
      open
      modalHeading={t('linkNewbornToMotherTitle', 'Vincular recién nacido a la madre')}
      primaryButtonText={t('confirmLinkNewborn', 'Confirmar vínculo')}
      secondaryButtonText={t('cancel', 'Cancelar')}
      closeButtonLabel={t('cancel', 'Cancelar')}
      primaryButtonDisabled={!canSave}
      loadingStatus={isSaving ? 'active' : 'inactive'}
      loadingDescription={t('saving', 'Guardando...')}
      onRequestSubmit={handleSave}
      onRequestClose={() => {
        if (!saveInFlight.current) {
          onClose();
        }
      }}
    >
      <div className={styles.modalContent}>
        <p>
          {t(
            'linkNewbornToMotherInstructions',
            'Busca al recién nacido ya registrado. Este formulario no crea una nueva historia clínica.',
          )}
        </p>
        <p>
          {t('linkNewbornToMotherBirthNotice', 'Usa esta acción después de un nacimiento; no corresponde a un aborto.')}
        </p>

        {!relationshipTypeUuid && (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('motherChildRelationshipTypeMissing', 'No se configuró el tipo de relación madre-hijo.')}
          />
        )}

        {linksError || (!isLoadingLinks && !isValidatingLinks && !Array.isArray(links)) ? (
          <div>
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('motherChildLinksUnavailable', 'No se pudo comprobar si el recién nacido ya está vinculado.')}
              subtitle={t(
                'motherChildLinksUnavailableHelp',
                'No se guardará el vínculo hasta que se pueda cargar esta información. Intenta nuevamente.',
              )}
            />
            <Button kind="ghost" size="sm" onClick={() => void reloadLinks()} disabled={isValidatingLinks}>
              {t('refreshMotherChildLinks', 'Actualizar vínculos')}
            </Button>
          </div>
        ) : isLoadingLinks || isValidatingLinks ? (
          <InlineLoading description={t('loadingMotherChildLinks', 'Comprobando vínculos existentes')} />
        ) : (
          <section className={styles.linkedChildren} aria-label={t('linkedNewborns', 'Recién nacidos vinculados')}>
            <h3>{t('linkedNewborns', 'Recién nacidos vinculados')}</h3>
            {links?.length ? (
              <ul>
                {links.map(({ child }) => (
                  <li key={child.uuid}>{child.display ?? t('patientNameUnavailable', 'Nombre no disponible')}</li>
                ))}
              </ul>
            ) : (
              <p>{t('noLinkedNewborns', 'Todavía no hay recién nacidos vinculados a esta madre.')}</p>
            )}
            <Button
              kind="ghost"
              size="sm"
              onClick={() => void reloadLinks()}
              disabled={isLoadingLinks || isValidatingLinks}
            >
              {t('refreshMotherChildLinks', 'Actualizar vínculos')}
            </Button>
          </section>
        )}

        <TextInput
          id={searchId}
          labelText={t('searchExistingNewborn', 'Buscar recién nacido registrado')}
          placeholder={t('searchExistingNewbornPlaceholder', 'Nombre o identificador')}
          value={searchQuery}
          onChange={(event) => updateSearch(event.currentTarget.value)}
          disabled={isSaving || saveStatus === 'unconfirmed'}
        />

        {selectedPatient && selectedPatientLinksError && (
          <div>
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t(
                'newbornLinksUnavailable',
                'No se pudo comprobar si este recién nacido ya tiene una madre vinculada.',
              )}
              subtitle={t(
                'newbornLinksUnavailableHelp',
                'No se guardará el vínculo hasta que se pueda comprobar el registro del recién nacido.',
              )}
            />
            <Button
              kind="ghost"
              size="sm"
              onClick={() => void reloadSelectedPatientLinks()}
              disabled={isValidatingSelectedPatientLinks}
            >
              {t('retryNewbornLinkCheck', 'Reintentar comprobación')}
            </Button>
          </div>
        )}
        {selectedPatient &&
          !selectedPatientLinksError &&
          (isLoadingSelectedPatientLinks ||
            isValidatingSelectedPatientLinks ||
            !Array.isArray(selectedPatientLinks)) && (
            <InlineLoading description={t('checkingNewbornLinks', 'Comprobando vínculos del recién nacido')} />
          )}
        {selectedLinkedToAnotherMother && (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('newbornLinkedToAnotherMother', 'Este recién nacido ya está vinculado a otra madre.')}
          />
        )}

        {!isSearchReady && <p>{t('newbornSearchMinimumLength', 'Escribe al menos 3 caracteres para buscar.')}</p>}
        {isSearching && <InlineLoading description={t('searchingNewborns', 'Buscando recién nacidos')} />}
        {searchError && (
          <div>
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('newbornSearchFailed', 'No se pudieron buscar pacientes. Intenta nuevamente.')}
            />
            <Button kind="ghost" size="sm" onClick={() => void retrySearch()}>
              {t('retryNewbornSearch', 'Reintentar búsqueda')}
            </Button>
          </div>
        )}
        {isSearchReady && !isSearching && !searchError && eligibleSearchResults.length === 0 && (
          <p>{t('noNewbornSearchResults', 'No se encontraron pacientes con esa búsqueda.')}</p>
        )}

        {eligibleSearchResults.length > 0 && (
          <fieldset className={styles.patientSearchResults}>
            <legend>{t('selectNewbornIdentity', 'Selecciona y confirma la identidad del recién nacido')}</legend>
            {eligibleSearchResults.map((patient) => {
              const personUuid = patient.person?.uuid ?? patient.uuid;
              const alreadyLinked = linkedChildUuids.has(patient.uuid) || linkedChildUuids.has(personUuid);
              const birthdate =
                patient.person?.birthdate ?? t('birthDateUnavailable', 'Fecha de nacimiento no disponible');
              const estimated = patient.person?.birthdateEstimated ? ` (${t('estimated', 'estimada')})` : '';
              const identifier = getPatientIdentifier(patient);
              const label = [
                displayPatient(patient),
                `${t('birthDate', 'Fecha de nacimiento')}: ${birthdate}${estimated}`,
                ...(identifier ? [`${t('patientIdentifier', 'Identificador')}: ${identifier}`] : []),
              ].join(' · ');

              return (
                <div className={styles.patientSearchResult} key={patient.uuid}>
                  <RadioButton
                    id={`newborn-${patient.uuid}`}
                    name={`newborn-${searchId}`}
                    value={patient.uuid}
                    labelText={label}
                    checked={selectedPatient?.uuid === patient.uuid}
                    disabled={isSaving || saveStatus === 'unconfirmed' || alreadyLinked}
                    onChange={() => selectPatient(patient)}
                  />
                  {alreadyLinked && <span>{t('newbornAlreadyLinked', 'Ya vinculado')}</span>}
                </div>
              );
            })}
          </fieldset>
        )}

        {selectedPatient && (
          <p className={styles.selectedPatientSummary}>
            {t(
              'selectedNewbornIdentity',
              'Recién nacido seleccionado: {{display}}; fecha de nacimiento: {{birthdate}}.',
              {
                display: displayPatient(selectedPatient),
                birthdate:
                  selectedPatient.person?.birthdate ?? t('birthDateUnavailable', 'Fecha de nacimiento no disponible'),
              },
            )}
          </p>
        )}
        {selectedAlreadyLinked && (
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title={t('newbornAlreadyLinked', 'Este recién nacido ya está vinculado a la madre.')}
          />
        )}
        {saveStatus === 'saved' && (
          <InlineNotification
            kind="success"
            lowContrast
            hideCloseButton
            title={t('motherChildLinkSaved', 'Vínculo madre-hijo guardado.')}
          />
        )}
        {saveStatus === 'unconfirmed' && (
          <InlineNotification
            kind="warning"
            lowContrast
            hideCloseButton
            title={t('motherChildLinkUnconfirmed', 'No se pudo confirmar el vínculo.')}
            subtitle={t(
              'motherChildLinkUnconfirmedHelp',
              'Cierra esta ventana y vuelve a cargar los vínculos antes de intentar otra vez.',
            )}
          />
        )}
      </div>
    </Modal>
  );
};

export default LinkNewbornToMother;
