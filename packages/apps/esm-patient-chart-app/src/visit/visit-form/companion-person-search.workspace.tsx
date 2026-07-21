import { Button, InlineLoading, InlineNotification, Search, Stack, Tile } from '@carbon/react';
import {
  getUserFacingErrorMessage,
  openmrsFetch,
  restBaseUrl,
  useDebounce,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import dayjs from 'dayjs';

import {
  createCompanionRelationship,
  type CompanionRecord,
  type PersonSearchResponse,
  type PersonSearchResult,
} from './companion.resource';
import styles from './companion-workspace.scss';

export interface CompanionWorkspaceProps {
  patientUuid: string;
  relationshipTypeUuid: string;
  existingCompanionPersonUuids: Array<string>;
  requireAdult: boolean;
  onCompanionSaved: (companion: CompanionRecord) => void | Promise<void>;
}

const minimumSearchLength = 3;

export function getPersonAge(person: PersonSearchResult, today = dayjs()) {
  if (typeof person.age === 'number') {
    return person.age;
  }

  if (!person.birthdate) {
    return undefined;
  }

  const birthdate = dayjs(person.birthdate);
  if (!birthdate.isValid() || birthdate.isAfter(today)) {
    return undefined;
  }

  return today.diff(birthdate, 'year');
}

const CompanionPersonSearchWorkspace: React.FC<Workspace2DefinitionProps<CompanionWorkspaceProps>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [savingPersonUuid, setSavingPersonUuid] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const debouncedQuery = useDebounce(query.trim());
  const searchUrl =
    debouncedQuery.length >= minimumSearchLength
      ? `${restBaseUrl}/person?q=${encodeURIComponent(debouncedQuery)}&v=custom:(uuid,display,age,birthdate)`
      : null;
  const { data, error, isLoading } = useSWR<PersonSearchResponse>(searchUrl, openmrsFetch);
  const existingCompanionPersonUuids = useMemo(
    () => new Set(workspaceProps.existingCompanionPersonUuids),
    [workspaceProps.existingCompanionPersonUuids],
  );
  const results = (data?.data?.results ?? []).filter(
    (person) => person.uuid !== workspaceProps.patientUuid && !existingCompanionPersonUuids.has(person.uuid),
  );

  const handleSelectPerson = async (person: PersonSearchResult) => {
    setSavingPersonUuid(person.uuid);
    setSaveError(null);
    try {
      const relationshipUuid = await createCompanionRelationship(
        workspaceProps.patientUuid,
        person.uuid,
        workspaceProps.relationshipTypeUuid,
      );
      await workspaceProps.onCompanionSaved({
        relationshipUuid,
        personUuid: person.uuid,
        name: person.display,
      });
      await closeWorkspace({ discardUnsavedChanges: true });
    } catch (error) {
      setSaveError(error);
    } finally {
      setSavingPersonUuid(null);
    }
  };

  return (
    <Workspace2 title={t('selectCompanion', 'Seleccionar acompañante')}>
      <div className={styles.workspaceContent}>
        <Search
          autoFocus
          labelText={t('searchPerson', 'Buscar persona')}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchCompanionPlaceholder', 'Escriba nombres o apellidos')}
          value={query}
        />
        {query.trim().length > 0 && query.trim().length < minimumSearchLength ? (
          <p className={styles.helperText}>
            {t('minimumCompanionSearchCharacters', 'Ingrese al menos {{count}} caracteres', {
              count: minimumSearchLength,
            })}
          </p>
        ) : null}
        {isLoading ? <InlineLoading description={t('searching', 'Buscando...')} /> : null}
        {error || saveError ? (
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            title={t('companionSaveError', 'No se pudo guardar el acompañante')}
            subtitle={getUserFacingErrorMessage(
              error ?? saveError,
              t('companionSaveErrorMessage', 'Revise los datos e intente nuevamente.'),
            )}
          />
        ) : null}
        {!isLoading && searchUrl && !error && results.length === 0 ? (
          <Tile>{t('noMatchingPeople', 'No se encontraron personas coincidentes')}</Tile>
        ) : null}
        <Stack gap={3}>
          {results.map((person) => {
            const personAge = getPersonAge(person);
            const isKnownAdult = typeof personAge === 'number' && personAge >= 18;
            const cannotSelect = workspaceProps.requireAdult && !isKnownAdult;
            return (
              <Tile className={styles.personResult} key={person.uuid}>
                <div>
                  <p className={styles.personName}>{person.display}</p>
                  <p className={styles.helperText}>
                    {typeof personAge === 'number'
                      ? t('personAge', '{{count}} años', { count: personAge })
                      : t('unknownAge', 'Edad desconocida')}
                  </p>
                  {cannotSelect ? (
                    <p className={styles.invalidText}>
                      {t('adultCompanionRequired', 'El acompañante de un menor debe ser una persona adulta.')}
                    </p>
                  ) : null}
                </div>
                <Button
                  disabled={cannotSelect || Boolean(savingPersonUuid)}
                  kind="tertiary"
                  onClick={() => handleSelectPerson(person)}
                  size="sm"
                >
                  {savingPersonUuid === person.uuid ? t('saving', 'Guardando...') : t('select', 'Seleccionar')}
                </Button>
              </Tile>
            );
          })}
        </Stack>
      </div>
    </Workspace2>
  );
};

export default CompanionPersonSearchWorkspace;
