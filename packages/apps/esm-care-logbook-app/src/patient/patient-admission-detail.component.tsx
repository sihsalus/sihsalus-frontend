import { Button, InlineLoading, InlineNotification, Tag } from '@carbon/react';
import { Add, ArrowLeft } from '@carbon/react/icons';
import { age, launchWorkspace2 } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { moduleName } from '../constants';
import {
  type PatientIdentifier,
  type PersonAttribute,
  usePatientDetail,
  usePatientUpcomingAppointments,
  usePatientVisitHistory,
} from '../resources/admissions.resource';
import styles from './patient-admission-detail.scss';

function formatDate(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(value));
}

function formatTime(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-PE', { timeStyle: 'short' }).format(new Date(value));
}

function formatGender(gender?: string) {
  if (gender === 'M') return 'Masculino';
  if (gender === 'F') return 'Femenino';
  if (gender === 'O') return 'Otro';
  return gender ?? '-';
}

function getAttributeValue(value?: string | { display?: string }): string {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  return value.display ?? '-';
}

function formatAddress(
  addresses: Array<{ preferred?: boolean; address1?: string; cityVillage?: string; stateProvince?: string }> = [],
) {
  const preferred = addresses.find((a) => a.preferred) ?? addresses[0];
  if (!preferred) return '-';
  return [preferred.address1, preferred.cityVillage, preferred.stateProvince].filter(Boolean).join(', ') || '-';
}

function formatIdentifiers(identifiers: PatientIdentifier[] = []) {
  if (!identifiers.length) return '-';
  return identifiers.map((id) => [id.identifierType?.display, id.identifier].filter(Boolean).join(': ')).join(' · ');
}

function renderAttributes(attributes: PersonAttribute[] = []) {
  return attributes
    .filter((a) => a.attributeType?.display)
    .map((attr, i) => ({
      key: i,
      label: attr.attributeType?.display ?? '',
      value: getAttributeValue(attr.value),
    }));
}

export default function PatientAdmissionDetail() {
  const { patientUuid } = useParams<{ patientUuid: string }>();
  const { t } = useTranslation(moduleName);
  const { patient, isLoading: loadingPatient, error: patientError } = usePatientDetail(patientUuid);
  const { visits, isLoading: loadingVisits, error: visitsError } = usePatientVisitHistory(patientUuid);
  const {
    appointments,
    isLoading: loadingAppointments,
    error: appointmentsError,
  } = usePatientUpcomingAppointments(patientUuid);
  const launchAppointmentScheduling = useCallback(() => {
    launchWorkspace2('appointments-form-workspace', {
      context: 'creating',
      patientUuid,
      workspaceTitle: t('scheduleAppointment', 'Programar turno'),
    });
  }, [patientUuid, t]);

  return (
    <main className={styles.page}>
      <Link to="/" className={styles.back}>
        <ArrowLeft size={16} />
        {t('backToAdmissions', 'Volver a atenciones')}
      </Link>

      {loadingPatient ? <InlineLoading description={t('loadingPatient', 'Cargando paciente')} /> : null}
      {patientError ? (
        <InlineNotification kind="error" lowContrast title={t('patientLoadError', 'No se pudo cargar el paciente')} />
      ) : null}

      {patient ? (
        <>
          <h1 className={styles.patientName}>{patient.person?.display ?? '-'}</h1>

          {/* ── Sección 1: Datos de filiación (N1.ADM.03.01) ───────────── */}
          <section className={styles.section} aria-labelledby="filiation-heading" data-testid="filiation-section">
            <div className={styles.sectionHeader}>
              <h2 id="filiation-heading" className={styles.sectionHeading}>
                {t('filiationData', 'Datos de filiación')}
              </h2>
              <Tag type="blue" size="sm">
                {t('filiationTag', 'person — separado de datos clínicos')}
              </Tag>
            </div>
            <p className={styles.sectionNote}>
              {t(
                'filiationNote',
                'Almacenados en el registro person de OpenMRS, separados de los datos clínicos (encounters/obs), conforme a la directiva de protección de datos personales.',
              )}
            </p>
            <dl className={styles.dl}>
              <div>
                <dt>{t('identifiers', 'Identificadores')}</dt>
                <dd>{formatIdentifiers(patient.identifiers)}</dd>
              </div>
              <div>
                <dt>{t('birthdate', 'Fecha de nacimiento')}</dt>
                <dd>
                  {patient.person?.birthdate
                    ? `${formatDate(patient.person.birthdate)}${patient.person.birthdateEstimated ? ' (estimada)' : ''}`
                    : '-'}
                </dd>
              </div>
              <div>
                <dt>{t('age', 'Edad')}</dt>
                <dd>{patient.person?.birthdate ? (age(patient.person.birthdate) ?? '-') : '-'}</dd>
              </div>
              <div>
                <dt>{t('sex', 'Sexo')}</dt>
                <dd>{formatGender(patient.person?.gender)}</dd>
              </div>
              <div>
                <dt>{t('address', 'Dirección')}</dt>
                <dd>{formatAddress(patient.person?.addresses)}</dd>
              </div>
              {renderAttributes(patient.person?.attributes).map(({ key, label, value }) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Sección 2: Historial de ingresos por UPS (N1.ADM.01.01) ── */}
          <section className={styles.section} aria-labelledby="history-heading" data-testid="admission-history-section">
            <div className={styles.sectionHeader}>
              <h2 id="history-heading" className={styles.sectionHeading}>
                {t('admissionHistoryByUps', 'Historial de atenciones por UPSS')}
              </h2>
              <Tag type="green" size="sm">
                {t('clinicalTag', 'visit/encounter — datos clínicos')}
              </Tag>
            </div>
            {loadingVisits ? (
              <InlineLoading description={t('loadingVisitHistory', 'Cargando historial de ingresos')} />
            ) : visitsError ? (
              <InlineNotification
                kind="error"
                lowContrast
                title={t('visitHistoryError', 'No se pudo cargar el historial de ingresos')}
              />
            ) : visits.length === 0 ? (
              <p className={styles.empty}>{t('noVisitHistory', 'Sin historial de ingresos registrado.')}</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('date', 'Fecha')}</th>
                      <th>{t('time', 'Hora')}</th>
                      <th>{t('visitType', 'Tipo de visita')}</th>
                      <th>{t('location', 'UPSS')}</th>
                      <th>{t('status', 'Estado')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.uuid}>
                        <td>{formatDate(v.startDatetime)}</td>
                        <td>{formatTime(v.startDatetime)}</td>
                        <td>{v.service}</td>
                        <td>{v.location}</td>
                        <td>{v.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section
            className={styles.section}
            aria-labelledby="appointments-heading"
            data-testid="appointment-scheduling-section"
          >
            <div className={styles.sectionHeader}>
              <h2 id="appointments-heading" className={styles.sectionHeading}>
                {t('appointmentScheduling', 'Programación de turnos')}
              </h2>
              <Tag type="purple" size="sm">
                {t('appointmentSchedulingTag', 'solicitudes/cupos/prestadores')}
              </Tag>
              <Button kind="primary" size="sm" renderIcon={Add} onClick={launchAppointmentScheduling}>
                {t('scheduleAppointment', 'Programar turno')}
              </Button>
            </div>
            <p className={styles.sectionNote}>
              {t(
                'appointmentSchedulingNote',
                'Permite consultar disponibilidad, seleccionar cupo y registrar citas con prestadores mediante el flujo de programación de turnos.',
              )}
            </p>
            {loadingAppointments ? (
              <InlineLoading description={t('loadingAppointments', 'Cargando turnos')} />
            ) : appointmentsError ? (
              <InlineNotification
                kind="error"
                lowContrast
                title={t('appointmentsLoadError', 'No se pudo cargar la programación de turnos')}
              />
            ) : appointments.length === 0 ? (
              <p className={styles.empty}>{t('noUpcomingAppointments', 'Sin turnos próximos registrados.')}</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('date', 'Fecha')}</th>
                      <th>{t('time', 'Hora')}</th>
                      <th>{t('service', 'Servicio')}</th>
                      <th>{t('provider', 'Prestador')}</th>
                      <th>{t('location', 'UPSS')}</th>
                      <th>{t('status', 'Estado')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appointment) => (
                      <tr key={appointment.uuid}>
                        <td>{formatDate(appointment.startDateTime)}</td>
                        <td>{formatTime(appointment.startDateTime)}</td>
                        <td>{appointment.service}</td>
                        <td>{appointment.provider}</td>
                        <td>{appointment.location}</td>
                        <td>{appointment.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
