import {
  Button,
  Checkbox,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
  Tile,
} from '@carbon/react';
import { ArrowRight, Search } from '@carbon/react/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';
import styles from './patient-merge.scss';

type SearchAttribute = 'identifier' | 'gender' | 'birthDate' | 'givenName' | 'middleName' | 'familyName';

interface MergeCandidate {
  id: string;
  uuid: string;
  identifier: string;
  documentNumber: string;
  givenName: string;
  middleName?: string;
  familyName: string;
  age: number;
  gender: string;
  birthDate: string;
  address: string;
  createdBy: string;
  lastUpdatedBy: string;
  annulled: boolean;
}

const mockCandidates: Array<MergeCandidate> = [
  {
    id: '16',
    uuid: 'patient-armando',
    identifier: '10000KP',
    documentNumber: '74815352',
    givenName: 'ARMANDO',
    familyName: 'MENDOZA',
    age: 58,
    gender: 'Masculino',
    birthDate: '31/12/1967',
    address: 'LIMA',
    createdBy: 'Super User - 18 de junio de 2026, 13:47:33 UTC',
    lastUpdatedBy: 'Super User - 18 de junio de 2026, 14:48:39 UTC',
    annulled: false,
  },
  {
    id: '15',
    uuid: 'patient-alvaro',
    identifier: '10000JT',
    documentNumber: '80526375',
    givenName: 'ALVARO',
    familyName: 'MENDOZA',
    age: 23,
    gender: 'Masculino',
    birthDate: '15/09/2002',
    address: 'LIMA',
    createdBy: 'Super User - 18 de junio de 2026, 13:49:10 UTC',
    lastUpdatedBy: 'Super User - 18 de junio de 2026, 14:50:01 UTC',
    annulled: false,
  },
];

const searchAttributes: Array<{ id: SearchAttribute; label: string }> = [
  { id: 'identifier', label: 'Identificador' },
  { id: 'gender', label: 'Genero' },
  { id: 'birthDate', label: 'Fecha de nacimiento' },
  { id: 'givenName', label: 'Nombre' },
  { id: 'middleName', label: 'Segundo Nombre' },
  { id: 'familyName', label: 'Apellido' },
];

function getPatientName(patient: MergeCandidate) {
  return [patient.givenName, patient.middleName, patient.familyName].filter(Boolean).join(' ');
}

export default function PatientMerge() {
  const { t } = useTranslation(moduleName);
  const [selectedAttributes, setSelectedAttributes] = useState<Array<SearchAttribute>>(['identifier', 'familyName']);
  const [includeVoided, setIncludeVoided] = useState(false);
  const [identifierSearch, setIdentifierSearch] = useState('10000KP,10000JT');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState<Array<string>>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [preferredPatientId, setPreferredPatientId] = useState('');

  const selectedPatients = useMemo(
    () => mockCandidates.filter((patient) => selectedPatientIds.includes(patient.id)),
    [selectedPatientIds],
  );

  const primaryPatient = selectedPatients[0];
  const secondaryPatient = selectedPatients[1];

  const toggleAttribute = (attribute: SearchAttribute, checked: boolean) => {
    setSelectedAttributes((currentAttributes) =>
      checked
        ? Array.from(new Set([...currentAttributes, attribute]))
        : currentAttributes.filter((currentAttribute) => currentAttribute !== attribute),
    );
  };

  const togglePatient = (patientId: string, checked: boolean) => {
    setShowComparison(false);
    setPreferredPatientId('');
    setSelectedPatientIds((currentPatientIds) => {
      if (checked) {
        return currentPatientIds.includes(patientId) || currentPatientIds.length === 2
          ? currentPatientIds
          : [...currentPatientIds, patientId];
      }

      return currentPatientIds.filter((currentPatientId) => currentPatientId !== patientId);
    });
  };

  return (
    <main className={styles.container}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{t('patientMergeWorkflow', 'Libro de Atenciones')}</p>
          <h1>{t('mergeDuplicatePatientRecords', 'Fusionar historias clínicas duplicadas')}</h1>
          <p>
            {t(
              'mergeDuplicatePatientRecordsSummary',
              'Use esta opción cuando dos historias clínicas pertenezcan al mismo paciente y una deba conservarse como historia preferida.',
            )}
          </p>
        </div>
      </section>

      <section className={styles.searchPanel} aria-label={t('findPatientsToMerge', 'Buscar pacientes a combinar')}>
        <Tile className={styles.searchCard}>
          <div className={styles.cardHeader}>
            <h2>{t('searchByAttributes', 'Busqueda por atributos')}</h2>
            <span>{t('minimumTwoAttributes', 'Elegir un minimo de dos atributos')}</span>
          </div>
          <div className={styles.attributeGrid}>
            {searchAttributes.map((attribute) => (
              <Checkbox
                key={attribute.id}
                id={`merge-${attribute.id}`}
                labelText={attribute.label}
                checked={selectedAttributes.includes(attribute.id)}
                onChange={(_, { checked }) => toggleAttribute(attribute.id, checked)}
              />
            ))}
          </div>
          <Checkbox
            id="merge-include-voided"
            labelText={t('includeVoided', 'Incluir anulado')}
            checked={includeVoided}
            onChange={(_, { checked }) => setIncludeVoided(checked)}
          />
          <Button
            kind="secondary"
            renderIcon={Search}
            disabled={selectedAttributes.length < 2}
            onClick={() => {
              setHasSearched(true);
              setShowComparison(false);
            }}
          >
            {t('search', 'Buscar')}
          </Button>
        </Tile>

        <div className={styles.divider} aria-hidden="true">
          {t('or', 'o')}
        </div>

        <Tile className={styles.searchCard}>
          <div className={styles.cardHeader}>
            <h2>{t('identifier', 'Identificador')}</h2>
            <span>{t('multipleIdentifiersHint', 'Ingrese varios identificadores separados por coma')}</span>
          </div>
          <TextInput
            id="merge-identifier-search"
            labelText={t('patientIdentifiers', 'Identificadores de paciente')}
            hideLabel
            value={identifierSearch}
            onChange={(event) => setIdentifierSearch(event.target.value)}
          />
          <Button
            kind="primary"
            renderIcon={Search}
            disabled={!identifierSearch.trim()}
            onClick={() => {
              setHasSearched(true);
              setShowComparison(false);
            }}
          >
            {t('search', 'Buscar')}
          </Button>
        </Tile>
      </section>

      {hasSearched ? (
        <section className={styles.resultsPanel} aria-label={t('patientMergeResults', 'Pacientes encontrados')}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>{t('returnedPatients', 'Pacientes devueltos')}</h2>
              <p>
                {t(
                  'selectPairToContinue',
                  `${mockCandidates.length} pacientes devueltos. Seleccione un par de pacientes para continuar.`,
                )}
              </p>
            </div>
            <Button
              kind="primary"
              renderIcon={ArrowRight}
              disabled={selectedPatientIds.length !== 2}
              onClick={() => setShowComparison(true)}
            >
              {t('continue', 'Continuar')}
            </Button>
          </div>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>{t('select', 'Seleccionar')}</TableHeader>
                  <TableHeader>{t('patientId', 'Patient Id')}</TableHeader>
                  <TableHeader>{t('identifier', 'Identificador')}</TableHeader>
                  <TableHeader>{t('givenName', 'Nombre')}</TableHeader>
                  <TableHeader>{t('middleName', 'Segundo Nombre')}</TableHeader>
                  <TableHeader>{t('familyName', 'Apellido')}</TableHeader>
                  <TableHeader>{t('age', 'Edad')}</TableHeader>
                  <TableHeader>{t('gender', 'Genero')}</TableHeader>
                  <TableHeader>{t('birthDate', 'Fecha de nacimiento')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockCandidates.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Checkbox
                        id={`merge-patient-${patient.id}`}
                        labelText={t('selectPatient', 'Seleccionar paciente')}
                        hideLabel
                        checked={selectedPatientIds.includes(patient.id)}
                        disabled={!selectedPatientIds.includes(patient.id) && selectedPatientIds.length === 2}
                        onChange={(_, { checked }) => togglePatient(patient.id, checked)}
                      />
                    </TableCell>
                    <TableCell>{patient.id}</TableCell>
                    <TableCell>
                      <a href={`${globalThis.openmrsBase}/patientDashboard.form?patientId=${patient.id}`}>
                        {patient.identifier}
                      </a>
                    </TableCell>
                    <TableCell>{patient.givenName}</TableCell>
                    <TableCell>{patient.middleName ?? '--'}</TableCell>
                    <TableCell>{patient.familyName}</TableCell>
                    <TableCell>{patient.age}</TableCell>
                    <TableCell>{patient.gender}</TableCell>
                    <TableCell>{patient.birthDate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </section>
      ) : null}

      {showComparison && primaryPatient && secondaryPatient ? (
        <section className={styles.comparisonPanel} aria-label={t('patientMergeReview', 'Revision de combinacion')}>
          <InlineNotification
            kind="warning"
            lowContrast
            title={t('irreversibleMergeWarning', 'Revise la combinacion con cuidado')}
            subtitle={t(
              'irreversibleMergeWarningSubtitle',
              'La fusion de historias clinicas es dificil de deshacer. Seleccione el paciente que conservara la historia preferida.',
            )}
          />

          <div className={styles.reviewGrid}>
            <Tile className={styles.patientSummary}>
              <div className={styles.cardHeader}>
                <h2>{t('preferredRecordCandidate', 'Paciente seleccionado')}</h2>
                <span>{t('currentPreferredRecord', 'Historia que puede conservarse')}</span>
              </div>
              <h3>{getPatientName(primaryPatient)}</h3>
              <dl>
                <dt>{t('patientIdentifiers', 'Identificadores del paciente')}</dt>
                <dd>{primaryPatient.documentNumber} DNI</dd>
                <dd>{primaryPatient.identifier} N° Historia Clinica</dd>
                <dt>{t('patientAddress', 'Direccion de paciente')}</dt>
                <dd>{primaryPatient.address}</dd>
                <dt>{t('patientInformation', 'Informacion de paciente')}</dt>
                <dd>
                  {t('patientId', 'Patient Id')}: {primaryPatient.id}
                </dd>
                <dd>
                  {t('gender', 'Genero')}: {primaryPatient.gender}
                </dd>
                <dd>
                  {t('birthDate', 'Fecha de nacimiento')}: {primaryPatient.birthDate}
                </dd>
                <dd>
                  {t('annulled', 'Anulado')}: {primaryPatient.annulled ? t('yes', 'Si') : t('no', 'No')}
                </dd>
              </dl>
            </Tile>

            <Tile className={styles.patientSummary}>
              <div className={styles.cardHeader}>
                <h2>{t('selectPreferredPatient', 'Seleccionar paciente preferido')}</h2>
                <span>{t('mergeTargetHint', 'Los datos del otro registro se combinaran en el preferido')}</span>
              </div>
              <RadioButtonGroup
                legendText={t('preferredPatient', 'Paciente preferido')}
                name="preferred-patient"
                valueSelected={preferredPatientId}
                onChange={(value) => setPreferredPatientId(String(value))}
              >
                {selectedPatients.map((patient) => (
                  <RadioButton
                    key={patient.id}
                    id={`preferred-${patient.id}`}
                    labelText={`${getPatientName(patient)} - ${patient.identifier}`}
                    value={patient.id}
                  />
                ))}
              </RadioButtonGroup>
              <TableContainer className={styles.secondaryResults}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>{t('identifier', 'Identificador')}</TableHeader>
                      <TableHeader>{t('name', 'Nombre')}</TableHeader>
                      <TableHeader>{t('familyName', 'Apellido')}</TableHeader>
                      <TableHeader>{t('age', 'Edad')}</TableHeader>
                      <TableHeader>{t('birthDate', 'Fecha de nacimiento')}</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedPatients.map((patient) => (
                      <TableRow key={patient.uuid}>
                        <TableCell>{patient.identifier}</TableCell>
                        <TableCell>{patient.givenName}</TableCell>
                        <TableCell>{patient.familyName}</TableCell>
                        <TableCell>{patient.age}</TableCell>
                        <TableCell>{patient.birthDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Tile>
          </div>

          <div className={styles.actions}>
            <Button kind="secondary" onClick={() => setShowComparison(false)}>
              {t('backToResults', 'Volver a resultados')}
            </Button>
            <Button kind="danger" disabled={!preferredPatientId}>
              {t('mergePatientsMock', 'Fusionar historias')}
            </Button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
