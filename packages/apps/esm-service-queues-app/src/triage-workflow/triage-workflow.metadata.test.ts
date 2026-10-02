import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import { mockQueueEntryAlice } from 'test-utils';
import { type QueueEntry } from '../types';
import { useQueueWorkflowMetadata } from './triage-workflow.resource';

vi.mock('swr');

it.each([
  'linked',
  'wrong-patient',
  'legacy',
] as const)('only selects a clinical specialty from a persisted matching appointment: %s', (context) => {
  const appointment = {
    uuid: 'appointment',
    patient: { uuid: context === 'wrong-patient' ? 'another-patient' : 'patient' },
    service: { uuid: 'obstetric-service' },
    location: { uuid: 'outpatient-location' },
    startDateTime: '2026-09-14T10:00:00-05:00',
  };
  const entry: QueueEntry = {
    ...mockQueueEntryAlice,
    uuid: 'queue-entry',
    patient: { ...mockQueueEntryAlice.patient, uuid: 'patient' },
    queue: { ...mockQueueEntryAlice.queue, uuid: 'outpatient-queue' },
    startedAt: appointment.startDateTime,
    visit: {
      ...mockQueueEntryAlice.visit,
      uuid: 'visit',
      visitType: { uuid: 'outpatient-visit-type', display: 'Outpatient' },
      startDatetime: appointment.startDateTime,
      stopDatetime: null,
      location: { uuid: 'outpatient-location' },
      attributes:
        context === 'legacy'
          ? []
          : [{ uuid: 'visit-appointment-link', attributeType: { uuid: 'appointment-link' }, value: 'appointment' }],
    },
  };
  const config = {
    appointmentVisitAttributeTypeUuid: 'appointment-link',
    appointmentArrivalRules: [],
    triageRouting: { enabled: true, queueUuid: 'triage-queue', encounterTypeUuid: 'triage-type' },
  };
  vi.mocked(useSWR).mockImplementation((key) => {
    const data =
      key === 'sihsalus-appointment-triage-config'
        ? config
        : Array.isArray(key) && key[0] === 'sihsalus-queue-appointments'
          ? new Map([['appointment', appointment]])
          : Array.isArray(key) && key[0] === 'sihsalus-queue-appointment-fallback'
            ? new Map([['2026-09-14', [appointment]]])
            : undefined;
    return { data, error: undefined, isLoading: false, isValidating: false, mutate: vi.fn() } as ReturnType<
      typeof useSWR
    >;
  });

  const { result } = renderHook(() => useQueueWorkflowMetadata([entry]));
  expect(result.current.entries[0].workflow.appointmentUuid).toBe('appointment');
  expect(result.current.entries[0].workflow.appointmentServiceUuid).toBe(
    context === 'linked' ? 'obstetric-service' : undefined,
  );
});
