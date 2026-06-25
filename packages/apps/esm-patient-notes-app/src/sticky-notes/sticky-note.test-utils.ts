import { type StickyNoteObs } from './sticky-note.resource';

export const mockPatientUuid = '8673ee4f-e2ab-4077-ba55-4980f408773e';

export const mockStickyNote: StickyNoteObs = {
  uuid: 'cc566b65-65b0-448d-a0a8-eb1214004a8d',
  value: 'simple notes',
  obsDatetime: '2026-01-20T11:38:02+00:00',
  encounter: null,
  formNamespaceAndPath: null,
  auditInfo: {
    creator: {
      display: 'Dr. Ray Romano',
    },
  },
};
