import type { Config } from '../../config-schema';
import { type EmergencyQueueEntry } from '../../resources/emergency.resource';
import {
  getQueueEntryDocumentNumber,
  getQueueEntryIdentificationStatus,
  getQueueEntryMedicalRecordNumber,
  getQueueEntryResponsibleName,
} from './emergency-queue-identity.utils';

function createQueueEntry(overrides: Partial<EmergencyQueueEntry> = {}): EmergencyQueueEntry {
  return {
    uuid: 'queue-entry',
    patient: {
      uuid: 'patient',
      display: 'DESCONOCIDO (100045V)',
      identifiers: [
        {
          uuid: 'hce',
          display: '100045V',
          identifier: '100045V',
          identifierType: { uuid: 'hce-type', display: 'N° Historia Clínica' },
        },
      ],
      person: {
        uuid: 'person',
        display: 'DESCONOCIDO (100045V)',
        gender: 'U',
        age: 0,
        birthdate: '',
        attributes: [
          { attributeType: { display: 'Paciente No Identificado' }, value: 'true' },
          { attributeType: { display: 'Nombre del Acompañante' }, value: 'SAMU Loreto' },
        ],
      },
    },
    priority: { uuid: 'priority', display: 'Prioridad I' },
    status: { uuid: 'waiting', display: 'En espera' },
    queue: { uuid: 'queue', display: 'Emergencia' },
    startedAt: '2026-05-30T10:00:00.000-0500',
    sortWeight: 1,
    ...overrides,
  };
}

function createConceptConfig(overrides: Partial<Config['patientRegistration']['identificationStatusConcepts']> = {}) {
  return {
    pendingUuid: null,
    partialUuid: null,
    confirmedUuid: null,
    mergedUuid: null,
    ...overrides,
  };
}

describe('emergency queue identity utils', () => {
  it('uses HCE as operational identifier and does not invent a document number', () => {
    const queueEntry = createQueueEntry();

    expect(getQueueEntryMedicalRecordNumber(queueEntry)).toBe('100045V');
    expect(getQueueEntryDocumentNumber(queueEntry)).toBe('');
  });

  it('marks unidentified patients as pending and exposes the responsible party', () => {
    const queueEntry = createQueueEntry();

    expect(getQueueEntryIdentificationStatus(queueEntry)).toBe('Pendiente');
    expect(getQueueEntryResponsibleName(queueEntry)).toBe('SAMU Loreto');
  });

  it('resolves pending status when backend returns the identification status concept UUID', () => {
    const conceptUuid = '11111111-1111-1111-1111-111111111111';
    const queueEntry = createQueueEntry({
      patient: {
        ...createQueueEntry().patient,
        person: {
          ...createQueueEntry().patient.person,
          attributes: [{ attributeType: { display: 'Estado de Identificación' }, value: { uuid: conceptUuid } }],
        },
      },
    });
    expect(
      getQueueEntryIdentificationStatus(queueEntry, {
        identificationStatusConcepts: createConceptConfig({
          pendingUuid: conceptUuid,
        }),
      }),
    ).toBe('Pendiente');
  });

  it('keeps literal string codes and maps them to labels when concept UUID mapping is not configured', () => {
    const queueEntry = createQueueEntry({
      patient: {
        ...createQueueEntry().patient,
        person: {
          ...createQueueEntry().patient.person,
          attributes: [{ attributeType: { display: 'Estado de Identificación' }, value: 'confirmed' }],
        },
      },
    });
    expect(getQueueEntryIdentificationStatus(queueEntry)).toBe('Confirmado');
  });
});
