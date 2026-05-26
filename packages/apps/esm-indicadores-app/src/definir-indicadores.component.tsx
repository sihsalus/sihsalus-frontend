import {
  Button,
  DataTable,
  Dropdown,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextArea,
  TextInput,
  Tile,
  Toggle,
} from '@carbon/react';
import { Add, Edit, TrashCan } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type Indicador,
  type IndicadorInput,
  type PeriodoIndicador,
  type TipoIndicador,
  useIndicadores,
} from './hooks/useIndicadoresMock';
import styles from './indicators-dashboard.module.scss';

const TIPOS: Array<TipoIndicador> = ['conteo_atenciones', 'conteo_pacientes'];
const PERIODOS: Array<PeriodoIndicador> = ['mes_actual', 'trimestre_actual', 'semestre_actual', 'anual_actual'];

const emptyForm: IndicadorInput = {
  nombre: '',
  descripcion: '',
  tipo: 'conteo_atenciones',
  periodo: 'mes_actual',
  activo: true,
};

const DefinirIndicadores: React.FC = () => {
  const { t } = useTranslation();
  const { indicadores, create, update, remove } = useIndicadores();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IndicadorInput>(emptyForm);

  const tipoLabel = (tipo: TipoIndicador) =>
    tipo === 'conteo_atenciones'
      ? t('countEncounters', 'Conteo de atenciones')
      : t('countPatients', 'Conteo de pacientes');
  const periodoLabel = (periodo: PeriodoIndicador) =>
    ({
      mes_actual: t('currentMonth', 'Mes actual'),
      trimestre_actual: t('currentQuarter', 'Trimestre actual'),
      semestre_actual: t('currentSemester', 'Semestre actual'),
      anual_actual: t('currentYear', 'Año actual'),
    })[periodo];

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (indicador: Indicador) => {
    setEditingId(indicador.id);
    setForm({
      nombre: indicador.nombre,
      descripcion: indicador.descripcion,
      tipo: indicador.tipo,
      periodo: indicador.periodo,
      activo: indicador.activo,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nombre.trim()) {
      showSnackbar({ title: t('nameRequired', 'El nombre es obligatorio'), kind: 'error', isLowContrast: true });
      return;
    }
    if (editingId) {
      update(editingId, form);
      showSnackbar({ title: t('indicatorUpdated', 'Indicador actualizado'), kind: 'success', isLowContrast: true });
    } else {
      create(form);
      showSnackbar({ title: t('indicatorCreated', 'Indicador creado'), kind: 'success', isLowContrast: true });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (indicador: Indicador) => {
    remove(indicador.id);
    showSnackbar({ title: t('indicatorDeleted', 'Indicador eliminado'), kind: 'success', isLowContrast: true });
  };

  const headers = [
    { key: 'nombre', header: t('name', 'Nombre') },
    { key: 'tipo', header: t('type', 'Tipo') },
    { key: 'periodo', header: t('period', 'Periodo') },
    { key: 'activo', header: t('status', 'Estado') },
    { key: 'actions', header: t('actions', 'Acciones') },
  ];

  const rows = indicadores.map((ind) => ({
    id: ind.id,
    nombre: ind.nombre,
    tipo: tipoLabel(ind.tipo),
    periodo: periodoLabel(ind.periodo),
    activo: ind.activo,
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{t('defineIndicators', 'Definir indicadores')}</h2>
        <div className={styles.headerActions}>
          <Button renderIcon={Add} onClick={openCreate}>
            {t('newIndicator', 'Nuevo indicador')}
          </Button>
        </div>
      </div>

      {indicadores.length === 0 ? (
        <Tile className={styles.empty}>
          <p>{t('noIndicatorsYet', 'No hay indicadores definidos aún.')}</p>
        </Tile>
      ) : (
        <DataTable rows={rows} headers={headers}>
          {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
            <TableContainer>
              <Table {...getTableProps()} aria-label={t('indicators', 'Indicadores')}>
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
                    const indicador = indicadores.find((i) => i.id === row.id);
                    return (
                      <TableRow key={row.id} {...getRowProps({ row })}>
                        {row.cells.map((cell) => {
                          if (cell.info.header === 'activo') {
                            return (
                              <TableCell key={cell.id}>
                                <Tag type={cell.value ? 'green' : 'gray'}>
                                  {cell.value ? t('active', 'Activo') : t('inactive', 'Inactivo')}
                                </Tag>
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'actions') {
                            return (
                              <TableCell key={cell.id}>
                                <Button
                                  kind="ghost"
                                  size="sm"
                                  hasIconOnly
                                  iconDescription={t('edit', 'Editar')}
                                  renderIcon={Edit}
                                  onClick={() => indicador && openEdit(indicador)}
                                />
                                <Button
                                  kind="danger--ghost"
                                  size="sm"
                                  hasIconOnly
                                  iconDescription={t('delete', 'Eliminar')}
                                  renderIcon={TrashCan}
                                  onClick={() => indicador && handleDelete(indicador)}
                                />
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
            </TableContainer>
          )}
        </DataTable>
      )}

      <Modal
        open={isModalOpen}
        modalHeading={editingId ? t('editIndicator', 'Editar indicador') : t('newIndicator', 'Nuevo indicador')}
        primaryButtonText={t('save', 'Guardar')}
        secondaryButtonText={t('cancel', 'Cancelar')}
        onRequestClose={() => setIsModalOpen(false)}
        onRequestSubmit={handleSubmit}
      >
        <div className={styles.form}>
          <TextInput
            id="ind-nombre"
            labelText={t('name', 'Nombre')}
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />
          <TextArea
            id="ind-descripcion"
            labelText={t('description', 'Descripción')}
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
          <Dropdown
            id="ind-tipo"
            titleText={t('type', 'Tipo')}
            label={tipoLabel(form.tipo)}
            items={TIPOS}
            selectedItem={form.tipo}
            itemToString={(item) => (item ? tipoLabel(item) : '')}
            onChange={({ selectedItem }) => selectedItem && setForm((f) => ({ ...f, tipo: selectedItem }))}
          />
          <Dropdown
            id="ind-periodo"
            titleText={t('period', 'Periodo')}
            label={periodoLabel(form.periodo)}
            items={PERIODOS}
            selectedItem={form.periodo}
            itemToString={(item) => (item ? periodoLabel(item) : '')}
            onChange={({ selectedItem }) => selectedItem && setForm((f) => ({ ...f, periodo: selectedItem }))}
          />
          <Toggle
            id="ind-activo"
            labelText={t('status', 'Estado')}
            labelA={t('inactive', 'Inactivo')}
            labelB={t('active', 'Activo')}
            toggled={form.activo}
            onToggle={(checked) => setForm((f) => ({ ...f, activo: checked }))}
          />
        </div>
      </Modal>
    </div>
  );
};

export default DefinirIndicadores;
