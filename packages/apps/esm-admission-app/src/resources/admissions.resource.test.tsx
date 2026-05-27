import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';

import {
  useActiveVisitSummary,
  useAdmissions,
  usePatientDetail,
  usePatientUpcomingAppointments,
  usePatientVisitHistory,
} from './admissions.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

function wrapper({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>{children}</SWRConfig>;
}

describe('admissions resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and maps the admission report rows from visits', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'visit-1',
            startDatetime: '2026-05-09T08:30:00.000-0500',
            patient: {
              uuid: 'patient-1',
              display: '100001 - Ada Lovelace',
              identifiers: [
                { identifier: 'DNI-123', identifierType: { display: 'DNI' } },
                { identifier: 'HC-99', identifierType: { display: 'Historia Clinica' } },
                { identifier: 'SIS-123', identifierType: { display: 'SIS' } },
              ],
              person: {
                display: 'Ada Lovelace',
                birthdate: '1990-01-01',
                gender: 'F',
                addresses: [
                  {
                    preferred: true,
                    address1: 'Av. Peru 123',
                    cityVillage: 'Lima',
                    stateProvince: 'Lima',
                  },
                ],
              },
            },
            visitType: { display: 'Consulta externa' },
            location: { display: 'Admision Central' },
          },
          {
            uuid: 'visit-2',
            stopDatetime: '2026-05-09T09:10:00.000-0500',
            patient: {
              uuid: 'patient-2',
              display: 'Grace Hopper',
              identifiers: [{ identifier: 'DOC-7', identifierType: { display: 'Documento' } }],
            },
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useAdmissions(25), { wrapper });

    await waitFor(() => expect(result.current.admissions).toHaveLength(2));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining(`${restBaseUrl}/visit?includeInactive=true`));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('&limit=25'));
    expect(result.current.admissions[0]).toMatchObject({
      uuid: 'visit-1',
      patientUuid: 'patient-1',
      patientName: 'Ada Lovelace',
      medicalRecordNumber: 'HC-99',
      documentNumber: 'DNI-123',
      birthDate: '1990-01-01',
      hasSis: 'Sí',
      address: 'Av. Peru 123, Lima, Lima',
      gender: 'F',
      service: 'Consulta externa',
      location: 'Admision Central',
      status: 'Activa',
    });
    expect(result.current.admissions[1]).toMatchObject({
      uuid: 'visit-2',
      patientUuid: 'patient-2',
      medicalRecordNumber: 'DOC-7',
      documentNumber: 'DOC-7',
      hasSis: 'No',
      service: '',
      location: '',
      status: 'Finalizada',
    });
  });

  it('returns an empty admission list when the API response has no results', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useAdmissions(10), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.admissions).toEqual([]);
  });

  it('does not request active visit summary without a patient uuid', () => {
    const { result } = renderHook(() => useActiveVisitSummary(), { wrapper });

    expect(result.current.visit).toBeNull();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('loads active visit service and location for a patient', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [{ uuid: 'visit-1', visitType: { display: 'Emergencia' }, location: { display: 'Box 2' } }],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useActiveVisitSummary('patient-uuid'), { wrapper });

    await waitFor(() => expect(result.current.visit).toEqual({ service: 'Emergencia', location: 'Box 2' }));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('patient=patient-uuid'));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('includeInactive=false'));
  });

  it('loads patient filiation detail with identifiers and attributes', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        person: {
          display: 'Ada Lovelace',
          birthdate: '1990-01-01',
          gender: 'F',
          attributes: [{ attributeType: { display: 'Grupo sanguineo' }, value: { display: 'O' } }],
        },
        identifiers: [{ identifier: 'HC-99', identifierType: { display: 'Historia clinica' }, preferred: true }],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => usePatientDetail('patient-uuid'), { wrapper });

    await waitFor(() => expect(result.current.patient?.person?.display).toBe('Ada Lovelace'));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining(`${restBaseUrl}/patient/patient-uuid?v=`));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('person:(display,birthdate'));
    expect(result.current.patient?.identifiers?.[0].identifier).toBe('HC-99');
  });

  it('does not request patient detail without a patient uuid', () => {
    renderHook(() => usePatientDetail(), { wrapper });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('loads and maps patient visit history', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'visit-1',
            startDatetime: '2026-05-09T08:30:00.000-0500',
            visitType: { display: 'Hospitalizacion' },
            location: { display: 'Piso 2' },
          },
          {
            uuid: 'visit-2',
            stopDatetime: '2026-05-09T10:00:00.000-0500',
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => usePatientVisitHistory('patient-uuid'), { wrapper });

    await waitFor(() => expect(result.current.visits).toHaveLength(2));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('includeInactive=true'));
    expect(result.current.visits[0]).toMatchObject({
      uuid: 'visit-1',
      service: 'Hospitalizacion',
      location: 'Piso 2',
      status: 'Activa',
    });
    expect(result.current.visits[1]).toMatchObject({
      uuid: 'visit-2',
      service: '-',
      location: '-',
      status: 'Finalizada',
    });
  });

  it('loads and maps upcoming patient appointments for admission scheduling', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: [
        {
          uuid: 'appointment-2',
          startDateTime: '2099-05-11T11:00:00.000-05:00',
          status: 'Scheduled',
          service: { name: 'Pediatria' },
          providers: [{ display: 'Dr. Smith' }],
          location: { display: 'Consultorio 2' },
        },
        {
          uuid: 'appointment-cancelled',
          startDateTime: '2099-05-12T11:00:00.000-05:00',
          status: 'Cancelled',
          service: { name: 'Traumatologia' },
        },
        {
          uuid: 'appointment-1',
          startDateTime: '2099-05-10T10:00:00.000-05:00',
          endDateTime: '2099-05-10T10:30:00.000-05:00',
          status: 'CheckedIn',
          service: { name: 'Medicina general' },
          providers: [{ name: 'Dra. Torres' }],
          location: { name: 'Consultorio 1' },
        },
      ],
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => usePatientUpcomingAppointments('patient-uuid'), { wrapper });

    await waitFor(() => expect(result.current.appointments).toHaveLength(2));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/appointments/search`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      }),
    );
    expect(JSON.parse((mockOpenmrsFetch.mock.calls[0]?.[1] as { body: string }).body)).toEqual(
      expect.objectContaining({
        patientUuid: 'patient-uuid',
        startDate: expect.any(String),
      }),
    );
    expect(result.current.appointments[0]).toMatchObject({
      uuid: 'appointment-1',
      service: 'Medicina general',
      provider: 'Dra. Torres',
      location: 'Consultorio 1',
      status: 'CheckedIn',
    });
    expect(result.current.appointments[1]).toMatchObject({
      uuid: 'appointment-2',
      service: 'Pediatria',
      provider: 'Dr. Smith',
      location: 'Consultorio 2',
      status: 'Scheduled',
    });
  });

  it('does not request upcoming appointments without a patient uuid', () => {
    renderHook(() => usePatientUpcomingAppointments(), { wrapper });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
