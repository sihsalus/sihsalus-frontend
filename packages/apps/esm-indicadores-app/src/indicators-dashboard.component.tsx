import {
  Button,
  DataTable,
  InlineNotification,
  Loading,
  Modal,
  NumberInput,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
  Tile,
} from '@carbon/react';
import { Add, Play, Renew, TrashCan } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEvaluateIndicator, useIndicatorsCRUD } from './hooks/useIndicators';
import styles from './indicators-dashboard.module.scss';

const IndicatorsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { indicators, isLoading, error, create, remove, refresh } = useIndicatorsCRUD();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [evaluatingId, setEvaluatingId] = useState<number | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newConceptIds, setNewConceptIds] = useState('');
  const [newMinAge, setNewMinAge] = useState<number>(0);
  const [newMaxAge, setNewMaxAge] = useState<number>(120);

  const handleCreate = async () => {
    try {
      const conceptIds = newConceptIds
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));

      await create({
        name: newName,
        description: newDescription,
        conceptIds,
        minAge: newMinAge,
        maxAge: newMaxAge,
        active: true,
      });

      showSnackbar({ title: t('indicatorCreated', 'Indicador creado'), kind: 'success', isLowContrast: true });
      setShowCreateModal(false);
      setNewName('');
      setNewDescription('');
      setNewConceptIds('');
      setNewMinAge(0);
      setNewMaxAge(120);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
      showSnackbar({
        title: t('errorCreating', 'Error al crear'),
        subtitle: errorMsg,
        kind: 'error',
        isLowContrast: true,
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await remove(id);
      showSnackbar({ title: t('indicatorDeleted', 'Indicador eliminado'), kind: 'success', isLowContrast: true });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
      showSnackbar({
        title: t('errorDeleting', 'Error al eliminar'),
        subtitle: errorMsg,
        kind: 'error',
        isLowContrast: true,
      });
    }
  };

  const headers = [
    { key: 'id', header: t('id', 'ID') },
    { key: 'name', header: t('name', 'Nombre') },
    { key: 'description', header: t('description', 'Descripción') },
    { key: 'conceptIds', header: t('conceptIds', 'Concepts') },
    { key: 'ageRange', header: t('ageRange', 'Rango Edad') },
    { key: 'active', header: t('status', 'Estado') },
    { key: 'actions', header: t('actions', 'Acciones') },
  ];

  const rows = indicators.map((ind) => ({
    id: String(ind.id),
    name: ind.name,
    description: ind.description || '-',
    conceptIds: (ind.conceptIds ?? []).join(', ') || '-',
    ageRange: `${ind.minAge ?? 0} - ${ind.maxAge ?? 120}`,
    active: ind.active ? t('active', 'Activo') : t('inactive', 'Inactivo'),
  }));

  if (isLoading) {
    return (
      <Tile className={styles.container}>
        <Loading withOverlay={false} description={t('loadingIndicators', 'Cargando indicadores...')} />
      </Tile>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{t('indicatorsTitle', 'Indicadores Clínicos - Panel de Prueba')}</h2>
        <div className={styles.headerActions}>
          <Button
            kind="ghost"
            renderIcon={Renew}
            onClick={() => {
              void refresh();
            }}
          >
            {t('refresh', 'Refrescar')}
          </Button>
          <Button renderIcon={Add} onClick={() => setShowCreateModal(true)}>
            {t('createIndicator', 'Crear Indicador')}
          </Button>
        </div>
      </div>

      {error && (
        <InlineNotification
          kind="error"
          title={t('connectionError', 'Error de conexión')}
          subtitle={t(
            'connectionErrorDetail',
            'No se pudo conectar al OMOD de indicators. ¿Está instalado? Error: {{errorMessage}}',
            { errorMessage: error instanceof Error ? error.message : String(error) },
          )}
        />
      )}

      {!error && indicators.length === 0 && (
        <Tile className={styles.empty}>
          <p>{t('noIndicatorsYet', 'No hay indicadores definidos aún. Crea uno para probar la conexión.')}</p>
        </Tile>
      )}

      {indicators.length > 0 && (
        <DataTable rows={rows} headers={headers}>
          {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
            <Table {...getTableProps()} aria-label={t('clinicalIndicators', 'Indicadores clínicos')}>
              <TableHead>
                <TableRow>
                  {tableHeaders.map((header) => (
                    <TableHeader key={header.key} {...getHeaderProps({ header })}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((row) => {
                  const indicator = indicators.find((i) => String(i.id) === row.id);
                  return (
                    <TableRow key={row.id} {...getRowProps({ row })}>
                      {row.cells.map((cell) => {
                        if (cell.info.header === 'active') {
                          const isActive = indicator?.active;
                          return (
                            <TableCell key={cell.id}>
                              <Tag type={isActive ? 'green' : 'red'}>{cell.value}</Tag>
                            </TableCell>
                          );
                        }
                        if (cell.info.header === 'actions') {
                          return (
                            <TableCell key={cell.id}>
                              <Button
                                kind="ghost"
                                size="sm"
                                renderIcon={Play}
                                onClick={() => {
                                  setEvaluatingId(indicator?.id ?? null);
                                }}
                              >
                                {t('evaluate', 'Evaluar')}
                              </Button>
                              <Button
                                kind="danger--ghost"
                                size="sm"
                                renderIcon={TrashCan}
                                onClick={() => {
                                  if (indicator) {
                                    void handleDelete(indicator.id);
                                  }
                                }}
                              >
                                {t('delete', 'Eliminar')}
                              </Button>
                            </TableCell>
                          );
                        }
                        return <TableCell key={cell.id}>{cell.value}</TableCell>;
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTable>
      )}

      {/* Evaluation Result */}
      {evaluatingId !== null && <EvaluationPanel id={evaluatingId} onClose={() => setEvaluatingId(null)} />}

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        modalHeading={t('createTestIndicator', 'Crear Indicador de Prueba')}
        primaryButtonText={t('create', 'Crear')}
        secondaryButtonText={t('cancel', 'Cancelar')}
        onRequestClose={() => setShowCreateModal(false)}
        onRequestSubmit={() => {
          void handleCreate();
        }}
      >
        <div className={styles.form}>
          <TextInput
            id="ind-name"
            labelText={t('name', 'Nombre')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <TextInput
            id="ind-desc"
            labelText={t('description', 'Descripción')}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <TextInput
            id="ind-concepts"
            labelText={t('conceptIdsSeparated', 'Concept IDs (separados por coma)')}
            placeholder="1234, 5678"
            value={newConceptIds}
            onChange={(e) => setNewConceptIds(e.target.value)}
          />
          <NumberInput
            id="ind-min-age"
            label={t('minAge', 'Edad mínima')}
            value={newMinAge}
            min={0}
            max={120}
            onChange={(_e, { value }) => setNewMinAge(Number(value))}
          />
          <NumberInput
            id="ind-max-age"
            label={t('maxAge', 'Edad máxima')}
            value={newMaxAge}
            min={0}
            max={120}
            onChange={(_e, { value }) => setNewMaxAge(Number(value))}
          />
        </div>
      </Modal>
    </div>
  );
};

/** Sub-panel para mostrar resultado de evaluación */
const EvaluationPanel: React.FC<{ id: number; onClose: () => void }> = ({ id, onClose }) => {
  const { t } = useTranslation();
  const { patientCount, indicatorName, isLoading, error } = useEvaluateIndicator(id);

  return (
    <Tile className={styles.evaluation}>
      <h4>{t('evaluationResult', 'Resultado de Evaluación')}</h4>
      {isLoading && <Loading withOverlay={false} small description={t('evaluating', 'Evaluando...')} />}
      {error && (
        <InlineNotification
          kind="error"
          title={t('error', 'Error')}
          subtitle={error instanceof Error ? error.message : String(error)}
          lowContrast
        />
      )}
      {!isLoading && !error && (
        <div>
          <p>
            <strong>{indicatorName}</strong>
          </p>
          <p>
            {t('patientsFound', 'Pacientes encontrados')}: <Tag type="blue">{patientCount}</Tag>
          </p>
        </div>
      )}
      <Button kind="ghost" size="sm" onClick={onClose}>
        {t('close', 'Cerrar')}
      </Button>
    </Tile>
  );
};

export default IndicatorsDashboard;
