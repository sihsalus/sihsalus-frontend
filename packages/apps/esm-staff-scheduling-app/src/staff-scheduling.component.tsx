import {
  Button,
  Checkbox,
  DatePicker,
  DatePickerInput,
  Dropdown,
  InlineLoading,
  InlineNotification,
  NumberInput,
  Select,
  SelectItem,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  TextInput,
} from '@carbon/react';
import { Add, Save, TrashCan } from '@carbon/react/icons';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  buildGeneratedSlots,
  createClientId,
  DAYS_OF_WEEK,
  isShiftInsideAvailability,
  type Location,
  type Provider,
  type ResourceAvailability,
  type ShiftStatus,
  type StaffSchedulingData,
  type StaffShift,
  saveStaffSchedulingData,
  useSchedulingReferenceData,
  useStaffSchedulingData,
} from './staff-scheduling.resource';

import styles from './staff-scheduling.scss';

type NotificationState = { kind: 'success' | 'error'; title: string; subtitle: string } | null;

const emptyAvailabilityForm = {
  locationUuid: '',
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '08:00',
  endTime: '14:00',
};

const emptyShiftForm = {
  date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  providerUuid: '',
  locationUuid: '',
  serviceUuid: '',
  startTime: '08:00',
  endTime: '12:00',
  slotMinutes: 30,
  capacityPerSlot: 1,
  status: 'draft' as ShiftStatus,
  notes: '',
};

function getProviderName(provider?: Provider) {
  return provider?.person?.display ?? provider?.display ?? '';
}

function getLocationName(location?: Location) {
  return location?.name ?? location?.display ?? '';
}

function updateData(data: StaffSchedulingData, patch: Partial<StaffSchedulingData>): StaffSchedulingData {
  return {
    ...data,
    ...patch,
  };
}

export default function StaffScheduling() {
  const { t } = useTranslation();
  const { schedulingData, settingUuid, isLoading, error, mutate } = useStaffSchedulingData();
  const referenceData = useSchedulingReferenceData();
  const [availabilityForm, setAvailabilityForm] = useState(emptyAvailabilityForm);
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);
  const [notification, setNotification] = useState<NotificationState>(null);
  const [isSaving, setIsSaving] = useState(false);

  const providersByUuid = useMemo(
    () => new Map(referenceData.providers.map((provider) => [provider.uuid, provider])),
    [referenceData.providers],
  );
  const locationsByUuid = useMemo(
    () => new Map(referenceData.locations.map((location) => [location.uuid, location])),
    [referenceData.locations],
  );
  const servicesByUuid = useMemo(
    () => new Map(referenceData.services.map((service) => [service.uuid, service])),
    [referenceData.services],
  );
  const generatedSlots = useMemo(() => buildGeneratedSlots(schedulingData.shifts), [schedulingData.shifts]);
  const publishedSlots = generatedSlots.filter((slot) => slot.status === 'published');
  const draftSlots = generatedSlots.filter((slot) => slot.status === 'draft');

  async function persist(data: StaffSchedulingData, successTitle: string, successSubtitle: string) {
    setIsSaving(true);
    setNotification(null);
    try {
      await saveStaffSchedulingData(settingUuid, data);
      await mutate();
      setNotification({ kind: 'success', title: successTitle, subtitle: successSubtitle });
    } catch (saveError) {
      setNotification({
        kind: 'error',
        title: t('saveError', 'No se pudo guardar la programación'),
        subtitle: saveError instanceof Error ? saveError.message : t('unexpectedError', 'Error inesperado'),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function addAvailability() {
    const location = locationsByUuid.get(availabilityForm.locationUuid);
    if (!location) {
      setNotification({
        kind: 'error',
        title: t('missingEnvironment', 'Selecciona un ambiente'),
        subtitle: t('missingEnvironmentDescription', 'La disponibilidad debe estar vinculada a un ambiente real.'),
      });
      return;
    }

    const availability: ResourceAvailability = {
      id: createClientId('availability'),
      locationUuid: location.uuid,
      locationName: getLocationName(location),
      daysOfWeek: availabilityForm.daysOfWeek,
      startTime: availabilityForm.startTime,
      endTime: availabilityForm.endTime,
      active: true,
    };

    await persist(
      updateData(schedulingData, {
        resourceAvailabilities: [availability, ...schedulingData.resourceAvailabilities],
      }),
      t('availabilitySaved', 'Disponibilidad registrada'),
      t('availabilitySavedDescription', 'El ambiente ya puede usarse para validar turnos.'),
    );
  }

  async function addShift() {
    const provider = providersByUuid.get(shiftForm.providerUuid);
    const location = locationsByUuid.get(shiftForm.locationUuid);
    const service = servicesByUuid.get(shiftForm.serviceUuid);

    if (!provider || !location || !service) {
      setNotification({
        kind: 'error',
        title: t('missingShiftData', 'Completa personal, ambiente y servicio'),
        subtitle: t('missingShiftDataDescription', 'El turno necesita datos discretos para generar cupos trazables.'),
      });
      return;
    }

    const shift: StaffShift = {
      id: createClientId('shift'),
      date: shiftForm.date,
      providerUuid: provider.uuid,
      providerName: getProviderName(provider),
      locationUuid: location.uuid,
      locationName: getLocationName(location),
      serviceUuid: service.uuid,
      serviceName: service.name ?? service.display ?? '',
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      slotMinutes: Number(shiftForm.slotMinutes),
      capacityPerSlot: Number(shiftForm.capacityPerSlot),
      status: shiftForm.status,
      notes: shiftForm.notes,
    };

    await persist(
      updateData(schedulingData, { shifts: [shift, ...schedulingData.shifts] }),
      t('shiftSaved', 'Turno registrado'),
      t('shiftSavedDescription', 'La programación del personal y ambiente fue actualizada.'),
    );
  }

  async function removeAvailability(availabilityId: string) {
    await persist(
      updateData(schedulingData, {
        resourceAvailabilities: schedulingData.resourceAvailabilities.filter((item) => item.id !== availabilityId),
      }),
      t('availabilityRemoved', 'Disponibilidad retirada'),
      t('availabilityRemovedDescription', 'El ambiente ya no usará esa regla horaria.'),
    );
  }

  async function updateShiftStatus(shiftId: string, status: ShiftStatus) {
    await persist(
      updateData(schedulingData, {
        shifts: schedulingData.shifts.map((shift) => (shift.id === shiftId ? { ...shift, status } : shift)),
      }),
      t('shiftStatusUpdated', 'Estado del turno actualizado'),
      t('shiftStatusUpdatedDescription', 'Los cupos derivados reflejan el nuevo estado.'),
    );
  }

  async function removeShift(shiftId: string) {
    await persist(
      updateData(schedulingData, {
        shifts: schedulingData.shifts.filter((shift) => shift.id !== shiftId),
      }),
      t('shiftRemoved', 'Turno eliminado'),
      t('shiftRemovedDescription', 'Se retiró el turno y sus cupos derivados.'),
    );
  }

  if (isLoading || referenceData.isLoading) {
    return <InlineLoading description={t('loadingScheduling', 'Cargando programación de turnos')} />;
  }

  if (error || referenceData.error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        title={t('loadError', 'No se pudo cargar la programación')}
        subtitle={(error ?? referenceData.error)?.message}
      />
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('annex14', 'Anexo 14')}</p>
          <h1>{t('staffSchedulingTitle', 'Programación de turnos y recursos')}</h1>
        </div>
        <div className={styles.metrics}>
          <div>
            <span>{schedulingData.resourceAvailabilities.length}</span>
            <p>{t('environments', 'Ambientes')}</p>
          </div>
          <div>
            <span>{schedulingData.shifts.length}</span>
            <p>{t('shifts', 'Turnos')}</p>
          </div>
          <div>
            <span>{publishedSlots.length}</span>
            <p>{t('publishedSlots', 'Cupos publicados')}</p>
          </div>
        </div>
      </header>

      {notification && (
        <InlineNotification
          className={styles.notification}
          kind={notification.kind}
          lowContrast
          title={notification.title}
          subtitle={notification.subtitle}
        />
      )}

      <Tabs>
        <TabList aria-label={t('staffSchedulingSections', 'Secciones de programación')}>
          <Tab>{t('availability', 'Ambientes')}</Tab>
          <Tab>{t('staffShifts', 'Turnos')}</Tab>
          <Tab>{t('slots', 'Cupos')}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <section className={styles.sectionGrid}>
              <div className={styles.formPanel}>
                <h2>{t('environmentAvailability', 'Disponibilidad de ambientes')}</h2>
                <Stack gap={5}>
                  <Dropdown
                    id="location"
                    titleText={t('environment', 'Ambiente')}
                    label={t('selectEnvironment', 'Seleccionar ambiente')}
                    items={referenceData.locations}
                    itemToString={(item) => (item ? getLocationName(item) : '')}
                    selectedItem={locationsByUuid.get(availabilityForm.locationUuid) ?? null}
                    onChange={({ selectedItem }) =>
                      setAvailabilityForm((form) => ({ ...form, locationUuid: selectedItem?.uuid ?? '' }))
                    }
                  />
                  <div className={styles.days}>
                    {DAYS_OF_WEEK.map((day) => (
                      <Checkbox
                        key={day.id}
                        id={`availability-day-${day.id}`}
                        labelText={day.label}
                        checked={availabilityForm.daysOfWeek.includes(day.id)}
                        onChange={(_, { checked }) =>
                          setAvailabilityForm((form) => ({
                            ...form,
                            daysOfWeek: checked
                              ? [...form.daysOfWeek, day.id]
                              : form.daysOfWeek.filter((item) => item !== day.id),
                          }))
                        }
                      />
                    ))}
                  </div>
                  <div className={styles.inlineFields}>
                    <TextInput
                      id="availability-start-time"
                      labelText={t('startTime', 'Hora inicio')}
                      type="time"
                      value={availabilityForm.startTime}
                      onChange={(event) => setAvailabilityForm((form) => ({ ...form, startTime: event.target.value }))}
                    />
                    <TextInput
                      id="availability-end-time"
                      labelText={t('endTime', 'Hora fin')}
                      type="time"
                      value={availabilityForm.endTime}
                      onChange={(event) => setAvailabilityForm((form) => ({ ...form, endTime: event.target.value }))}
                    />
                  </div>
                  <Button
                    renderIcon={Add}
                    onClick={addAvailability}
                    disabled={isSaving || !availabilityForm.locationUuid}
                  >
                    {t('addAvailability', 'Agregar disponibilidad')}
                  </Button>
                </Stack>
              </div>
              <AvailabilityTable
                availabilities={schedulingData.resourceAvailabilities}
                onRemove={removeAvailability}
                isSaving={isSaving}
              />
            </section>
          </TabPanel>
          <TabPanel>
            <section className={styles.sectionGrid}>
              <div className={styles.formPanel}>
                <h2>{t('newShift', 'Nuevo turno')}</h2>
                <Stack gap={5}>
                  <DatePicker
                    datePickerType="single"
                    dateFormat="Y-m-d"
                    value={shiftForm.date}
                    onChange={(dates) =>
                      setShiftForm((form) => ({
                        ...form,
                        date: dates[0] ? dayjs(dates[0]).format('YYYY-MM-DD') : form.date,
                      }))
                    }
                  >
                    <DatePickerInput id="shift-date" labelText={t('date', 'Fecha')} placeholder="yyyy-mm-dd" />
                  </DatePicker>
                  <Dropdown
                    id="provider"
                    titleText={t('staffMember', 'Personal de salud')}
                    label={t('selectStaffMember', 'Seleccionar personal')}
                    items={referenceData.providers}
                    itemToString={(item) => (item ? getProviderName(item) : '')}
                    selectedItem={providersByUuid.get(shiftForm.providerUuid) ?? null}
                    onChange={({ selectedItem }) =>
                      setShiftForm((form) => ({ ...form, providerUuid: selectedItem?.uuid ?? '' }))
                    }
                  />
                  <Dropdown
                    id="shift-location"
                    titleText={t('environment', 'Ambiente')}
                    label={t('selectEnvironment', 'Seleccionar ambiente')}
                    items={referenceData.locations}
                    itemToString={(item) => (item ? getLocationName(item) : '')}
                    selectedItem={locationsByUuid.get(shiftForm.locationUuid) ?? null}
                    onChange={({ selectedItem }) =>
                      setShiftForm((form) => ({ ...form, locationUuid: selectedItem?.uuid ?? '' }))
                    }
                  />
                  <Dropdown
                    id="service"
                    titleText={t('service', 'Servicio')}
                    label={t('selectService', 'Seleccionar servicio')}
                    items={referenceData.services}
                    itemToString={(item) => (item ? (item.name ?? item.display ?? '') : '')}
                    selectedItem={servicesByUuid.get(shiftForm.serviceUuid) ?? null}
                    onChange={({ selectedItem }) =>
                      setShiftForm((form) => ({ ...form, serviceUuid: selectedItem?.uuid ?? '' }))
                    }
                  />
                  <div className={styles.inlineFields}>
                    <TextInput
                      id="shift-start-time"
                      labelText={t('startTime', 'Hora inicio')}
                      type="time"
                      value={shiftForm.startTime}
                      onChange={(event) => setShiftForm((form) => ({ ...form, startTime: event.target.value }))}
                    />
                    <TextInput
                      id="shift-end-time"
                      labelText={t('endTime', 'Hora fin')}
                      type="time"
                      value={shiftForm.endTime}
                      onChange={(event) => setShiftForm((form) => ({ ...form, endTime: event.target.value }))}
                    />
                  </div>
                  <div className={styles.inlineFields}>
                    <NumberInput
                      id="slot-minutes"
                      label={t('slotMinutes', 'Minutos por cupo')}
                      min={5}
                      max={240}
                      step={5}
                      value={shiftForm.slotMinutes}
                      onChange={(_, { value }) =>
                        setShiftForm((form) => ({ ...form, slotMinutes: Number(value) || 30 }))
                      }
                    />
                    <NumberInput
                      id="capacity-per-slot"
                      label={t('capacityPerSlot', 'Capacidad por cupo')}
                      min={1}
                      max={99}
                      value={shiftForm.capacityPerSlot}
                      onChange={(_, { value }) =>
                        setShiftForm((form) => ({ ...form, capacityPerSlot: Number(value) || 1 }))
                      }
                    />
                  </div>
                  <Select
                    id="shift-status"
                    labelText={t('status', 'Estado')}
                    value={shiftForm.status}
                    onChange={(event) =>
                      setShiftForm((form) => ({ ...form, status: event.target.value as ShiftStatus }))
                    }
                  >
                    <SelectItem value="draft" text={t('draft', 'Borrador')} />
                    <SelectItem value="published" text={t('published', 'Publicado')} />
                    <SelectItem value="suspended" text={t('suspended', 'Suspendido')} />
                  </Select>
                  <TextInput
                    id="shift-notes"
                    labelText={t('notes', 'Notas')}
                    value={shiftForm.notes}
                    onChange={(event) => setShiftForm((form) => ({ ...form, notes: event.target.value }))}
                  />
                  <Button
                    renderIcon={Save}
                    onClick={addShift}
                    disabled={isSaving || !shiftForm.providerUuid || !shiftForm.locationUuid || !shiftForm.serviceUuid}
                  >
                    {t('saveShift', 'Guardar turno')}
                  </Button>
                </Stack>
              </div>
              <ShiftTable
                shifts={schedulingData.shifts}
                availabilities={schedulingData.resourceAvailabilities}
                onStatusChange={updateShiftStatus}
                onRemove={removeShift}
                isSaving={isSaving}
              />
            </section>
          </TabPanel>
          <TabPanel>
            <section className={styles.slotsPanel}>
              <div className={styles.slotSummary}>
                <Tag type="green">
                  {t('publishedSlotCount', '{{count}} publicados', { count: publishedSlots.length })}
                </Tag>
                <Tag type="gray">{t('draftSlotCount', '{{count}} en borrador', { count: draftSlots.length })}</Tag>
              </div>
              <SlotsTable slots={generatedSlots} />
            </section>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </main>
  );
}

function AvailabilityTable({
  availabilities,
  isSaving,
  onRemove,
}: {
  availabilities: ResourceAvailability[];
  isSaving: boolean;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>{t('environment', 'Ambiente')}</th>
          <th>{t('days', 'Días')}</th>
          <th>{t('hours', 'Horario')}</th>
          <th>{t('status', 'Estado')}</th>
          <th>{t('actions', 'Acciones')}</th>
        </tr>
      </thead>
      <tbody>
        {availabilities.map((availability) => (
          <tr key={availability.id}>
            <td>{availability.locationName}</td>
            <td>
              {availability.daysOfWeek
                .map((day) => DAYS_OF_WEEK.find((item) => item.id === day)?.label.slice(0, 3))
                .filter(Boolean)
                .join(', ')}
            </td>
            <td>{`${availability.startTime} - ${availability.endTime}`}</td>
            <td>{availability.active ? t('active', 'Activa') : t('inactive', 'Inactiva')}</td>
            <td>
              <Button
                kind="ghost"
                size="sm"
                hasIconOnly
                iconDescription={t('remove', 'Eliminar')}
                renderIcon={TrashCan}
                disabled={isSaving}
                onClick={() => onRemove(availability.id)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ShiftTable({
  shifts,
  availabilities,
  isSaving,
  onStatusChange,
  onRemove,
}: {
  shifts: StaffShift[];
  availabilities: ResourceAvailability[];
  isSaving: boolean;
  onStatusChange: (id: string, status: ShiftStatus) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>{t('date', 'Fecha')}</th>
          <th>{t('staffMember', 'Personal')}</th>
          <th>{t('environment', 'Ambiente')}</th>
          <th>{t('service', 'Servicio')}</th>
          <th>{t('hours', 'Horario')}</th>
          <th>{t('validation', 'Validación')}</th>
          <th>{t('status', 'Estado')}</th>
          <th>{t('actions', 'Acciones')}</th>
        </tr>
      </thead>
      <tbody>
        {shifts.map((shift) => {
          const isValid = isShiftInsideAvailability(shift, availabilities);
          return (
            <tr key={shift.id}>
              <td>{shift.date}</td>
              <td>{shift.providerName}</td>
              <td>{shift.locationName}</td>
              <td>{shift.serviceName}</td>
              <td>{`${shift.startTime} - ${shift.endTime}`}</td>
              <td>
                <Tag type={isValid ? 'blue' : 'magenta'}>
                  {isValid ? t('valid', 'Válido') : t('outsideHours', 'Fuera de horario')}
                </Tag>
              </td>
              <td>
                <Tag type={shift.status === 'published' ? 'green' : shift.status === 'suspended' ? 'red' : 'gray'}>
                  {shift.status}
                </Tag>
              </td>
              <td className={styles.actions}>
                <Button
                  kind="ghost"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => onStatusChange(shift.id, 'published')}
                >
                  {t('publish', 'Publicar')}
                </Button>
                <Button
                  kind="ghost"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => onStatusChange(shift.id, 'suspended')}
                >
                  {t('suspend', 'Suspender')}
                </Button>
                <Button
                  kind="ghost"
                  size="sm"
                  hasIconOnly
                  iconDescription={t('remove', 'Eliminar')}
                  renderIcon={TrashCan}
                  disabled={isSaving}
                  onClick={() => onRemove(shift.id)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SlotsTable({ slots }: { slots: ReturnType<typeof buildGeneratedSlots> }) {
  const { t } = useTranslation();

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>{t('date', 'Fecha')}</th>
          <th>{t('time', 'Hora')}</th>
          <th>{t('staffMember', 'Personal')}</th>
          <th>{t('environment', 'Ambiente')}</th>
          <th>{t('service', 'Servicio')}</th>
          <th>{t('capacity', 'Capacidad')}</th>
          <th>{t('status', 'Estado')}</th>
        </tr>
      </thead>
      <tbody>
        {slots.slice(0, 200).map((slot) => (
          <tr key={slot.id}>
            <td>{slot.date}</td>
            <td>{`${dayjs(slot.startDateTime).format('HH:mm')} - ${dayjs(slot.endDateTime).format('HH:mm')}`}</td>
            <td>{slot.providerName}</td>
            <td>{slot.locationName}</td>
            <td>{slot.serviceName}</td>
            <td>{slot.capacity}</td>
            <td>{slot.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
