import {
  Button,
  InlineLoading,
  InlineNotification,
  Search,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Save } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ImmunizationPlanHeader from './immunization-plan-header.component';
import type { ScheduleEntry } from './vaccination-schedule.resource';
import { saveScheduleData, useVaccinationSchedule } from './vaccination-schedule.resource';
import styles from './vaccine-scheduling-builder.scss';

type DoseStatus = 'required' | 'optional' | 'empty';

interface AgePeriod {
  id: string;
  label: string;
  ageRange: string;
}

const AGE_PERIODS: AgePeriod[] = [
  { id: 'rn', label: 'RN', ageRange: '0 días' },
  { id: '2m', label: '2m', ageRange: '2 meses' },
  { id: '4m', label: '4m', ageRange: '4 meses' },
  { id: '6m', label: '6m', ageRange: '6 meses' },
  { id: '12m', label: '12m', ageRange: '12 meses' },
  { id: '15m', label: '15m', ageRange: '15 meses' },
  { id: '18m', label: '18m', ageRange: '18 meses' },
  { id: '2a', label: '2a', ageRange: '2 años' },
  { id: '4a', label: '4a', ageRange: '4 años' },
  { id: '5a', label: '5a', ageRange: '5 años' },
];

const DEFAULT_ENTRIES: ScheduleEntry[] = [
  { conceptUuid: 'hvb', name: 'Hepatitis B (HvB)', schedule: { rn: 'required' } },
  { conceptUuid: 'bcg', name: 'BCG', schedule: { rn: 'required' } },
  {
    conceptUuid: 'pentavalente',
    name: 'Pentavalente',
    schedule: { '2m': 'required', '4m': 'required', '6m': 'required' },
  },
  { conceptUuid: 'ipv', name: 'IPV (Polio inactivada)', schedule: { '2m': 'required', '4m': 'required' } },
  {
    conceptUuid: 'apo',
    name: 'APO (Antipolio oral)',
    schedule: { '6m': 'required', '18m': 'required', '4a': 'required' },
  },
  { conceptUuid: 'rotavirus', name: 'Rotavirus', schedule: { '2m': 'required', '4m': 'required' } },
  {
    conceptUuid: 'neumococo',
    name: 'Neumococo',
    schedule: { '2m': 'required', '4m': 'required', '12m': 'required' },
  },
  { conceptUuid: 'influenza', name: 'Influenza', schedule: { '6m': 'required', '12m': 'optional' } },
  { conceptUuid: 'spr', name: 'SPR (Triple viral)', schedule: { '12m': 'required', '18m': 'required' } },
  { conceptUuid: 'dpt', name: 'DPT (Refuerzo)', schedule: { '18m': 'required', '4a': 'required' } },
  { conceptUuid: 'varicela', name: 'Varicela', schedule: { '12m': 'required' } },
  { conceptUuid: 'fa', name: 'Fiebre Amarilla', schedule: { '15m': 'required' } },
  { conceptUuid: 'hep-a', name: 'Hepatitis A', schedule: { '12m': 'required', '18m': 'required' } },
];

const STATUS_CYCLE: DoseStatus[] = ['required', 'optional', 'empty'];

function dotClass(status: DoseStatus, s: typeof styles): string {
  if (status === 'required') return s.requiredDot;
  if (status === 'optional') return s.optionalDot;
  return s.emptyDot;
}

const VaccineSchedulingBuilder: React.FC = () => {
  const { t } = useTranslation();
  const { scheduleData, settingUuid, isLoading, error, mutate } = useVaccinationSchedule();

  const [entries, setEntries] = useState<ScheduleEntry[]>(DEFAULT_ENTRIES);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (scheduleData?.entries?.length) {
      setEntries(scheduleData.entries);
      setIsDirty(false);
    }
  }, [scheduleData]);

  const filtered = useMemo(
    () => (searchTerm ? entries.filter((e) => e.name.toLowerCase().includes(searchTerm.toLowerCase())) : entries),
    [entries, searchTerm],
  );

  const handleCellClick = useCallback((conceptUuid: string, periodId: string) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.conceptUuid !== conceptUuid) return entry;
        const current = entry.schedule[periodId] ?? 'empty';
        const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
        const newSchedule = { ...entry.schedule };
        if (next === 'empty') {
          delete newSchedule[periodId];
        } else {
          newSchedule[periodId] = next;
        }
        return { ...entry, schedule: newSchedule };
      }),
    );
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveScheduleData(settingUuid, {
        version: (scheduleData?.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        entries,
      });
      await mutate();
      setIsDirty(false);
      showSnackbar({
        title: t('saved', 'Guardado'),
        subtitle: t('scheduleSaved', 'El esquema de vacunación fue guardado correctamente.'),
        kind: 'success',
      });
    } catch (err) {
      showSnackbar({
        title: t('saveError', 'Error al guardar'),
        subtitle: String(err),
        kind: 'error',
      });
    } finally {
      setSaving(false);
    }
  }, [settingUuid, scheduleData, entries, mutate, t]);

  const legendItems: Array<{ status: DoseStatus; label: string }> = [
    { status: 'required', label: t('required', 'Obligatoria') },
    { status: 'optional', label: t('optional', 'Opcional') },
    { status: 'empty', label: t('empty', 'Sin dosis') },
  ];

  return (
    <div className={styles.container}>
      <ImmunizationPlanHeader title={t('vaccinationScheduleBuilder', 'Gestor del calendario de vacunación')} />

      {scheduleData && (
        <div className={styles.scheduleInfo}>
          <span className={styles.scheduleName}>
            {t('peruNationalSchedule', 'Esquema Nacional de Vacunación — Perú')}
          </span>
          <span className={styles.scheduleVersion}>v{scheduleData.version}</span>
        </div>
      )}

      {error && (
        <InlineNotification
          kind="error"
          title={t('loadError', 'Error al cargar')}
          subtitle={error.message}
          className={styles.notification}
        />
      )}

      <div className={styles.controls}>
        <div className={styles['search-container']}>
          <Search
            labelText=""
            placeholder={t('searchVaccine', 'Buscar vacuna...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            size="lg"
            disabled={isLoading}
          />
        </div>
        <Button
          kind="primary"
          renderIcon={saving ? undefined : Save}
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? <InlineLoading description={t('saving', 'Guardando...')} /> : t('saveSchedule', 'Guardar esquema')}
        </Button>
      </div>

      {isLoading && <InlineLoading description={t('loadingSchedule', 'Cargando...')} className={styles.notification} />}

      <div className={styles.tableContainer}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className={styles.headerVacuna}>{t('vaccine', 'Vacuna')}</TableHeader>
                {AGE_PERIODS.map((period) => (
                  <TableHeader key={period.id} style={{ textAlign: 'center' }}>
                    {period.label}
                    <div className={styles.ageRange}>{period.ageRange}</div>
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry.conceptUuid}>
                  <TableCell>{entry.name}</TableCell>
                  {AGE_PERIODS.map((period) => {
                    const status = (entry.schedule[period.id] ?? 'empty') as DoseStatus;
                    return (
                      <TableCell key={period.id} className={styles.periodCell}>
                        <button
                          type="button"
                          className={styles.periodButton}
                          onClick={() => handleCellClick(entry.conceptUuid, period.id)}
                          title={t(`status.${status}`, status)}
                          aria-label={`${entry.name} - ${period.label}: ${status}`}
                        >
                          <div className={dotClass(status, styles)} />
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      <div className={styles.legend}>
        {legendItems.map(({ status, label }) => (
          <div key={status} className={styles.legendItem}>
            <div className={dotClass(status, styles)} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VaccineSchedulingBuilder;
