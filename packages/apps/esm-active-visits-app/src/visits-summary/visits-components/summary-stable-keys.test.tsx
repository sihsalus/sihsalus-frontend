import { render, screen } from '@testing-library/react';

import type { Encounter, Note, Observation, OrderItem } from '../../types';
import MedicationSummary from './medications-summary.component';
import NotesSummary from './notes-summary.component';
import VisitSummary from './visit-summary.component';

const makeNote = (uuid: string, note: string): Note => ({
  uuid,
  note,
  provider: { name: 'Clinician', role: 'Doctor' },
  time: '08:00',
});

const makeMedication = (uuid: string, name: string): OrderItem => ({
  order: {
    uuid,
    dateActivated: '2026-08-12T08:00:00.000-0500',
    dose: 1,
    dosingInstructions: null,
    doseUnits: { uuid: 'tablet-unit', display: 'Tablet' },
    drug: { uuid: `${uuid}-drug`, name, strength: '100 mg', display: name },
    duration: 1,
    durationUnits: { uuid: 'day-unit', display: 'Day' },
    frequency: { uuid: 'daily-frequency', display: 'Once daily' },
    numRefills: 0,
    orderNumber: uuid,
    orderReason: null,
    orderReasonNonCoded: null,
    orderer: { uuid: 'provider', person: { uuid: 'person', display: 'Clinician' } },
    orderType: { uuid: 'drug-order-type', display: 'Drug Order' },
    quantity: 1,
    quantityUnits: { uuid: 'tablet-unit', display: 'Tablet' },
    route: { uuid: 'oral-route', display: 'Oral' },
  },
  provider: { name: 'Clinician', role: 'Doctor' },
});

const makeDiagnosis = (uuid: string, diagnosis: string): Observation => ({
  uuid,
  concept: {
    uuid: 'visit-diagnoses-concept',
    display: 'Visit Diagnoses',
    conceptClass: { uuid: 'diagnosis-class', display: 'Diagnosis' },
  },
  display: diagnosis,
  groupMembers: [
    {
      uuid: `${uuid}-problem`,
      concept: { uuid: 'problem-list-concept', display: 'PROBLEM LIST' },
      value: { uuid: `${uuid}-coded`, display: diagnosis },
    },
    {
      uuid: `${uuid}-order`,
      concept: { uuid: 'diagnosis-order-concept', display: 'Diagnosis order' },
      value: { uuid: 'primary-order', display: 'Primary' },
    },
  ],
  value: null,
  obsDatetime: '2026-08-12T08:00:00.000-0500',
});

const makeVisitNoteEncounter = (observations: Array<Observation>): Encounter => ({
  uuid: 'visit-note-encounter',
  encounterDatetime: '2026-08-12T08:00:00.000-0500',
  encounterProviders: [],
  encounterType: { uuid: 'visit-note-type', display: 'Visit Note' },
  obs: observations,
  orders: [],
});

describe('visit summary stable identities', () => {
  it('preserves each note when their order changes', () => {
    const notes = [makeNote('note-a', 'First note'), makeNote('note-b', 'Second note')];
    const { rerender } = render(<NotesSummary notes={notes} />);
    const firstNote = screen.getByText('First note');

    rerender(<NotesSummary notes={[...notes].reverse()} />);

    expect(screen.getByText('First note')).toBe(firstNote);
  });

  it('preserves each medication when their order changes', () => {
    const medications = [makeMedication('order-a', 'Aspirin'), makeMedication('order-b', 'Ibuprofen')];
    const { rerender } = render(<MedicationSummary medications={medications} />);
    const aspirin = screen.getByText('Aspirin');

    rerender(<MedicationSummary medications={[...medications].reverse()} />);

    expect(screen.getByText('Aspirin')).toBe(aspirin);
  });

  it('preserves each diagnosis when their order changes', () => {
    const diagnoses = [makeDiagnosis('diagnosis-a', 'Condition A'), makeDiagnosis('diagnosis-b', 'Condition B')];
    const { rerender } = render(
      <VisitSummary encounters={[makeVisitNoteEncounter(diagnoses)]} patientUuid="patient" />,
    );
    const firstDiagnosis = screen.getByText('Condition A');

    rerender(<VisitSummary encounters={[makeVisitNoteEncounter([...diagnoses].reverse())]} patientUuid="patient" />);

    expect(screen.getByText('Condition A')).toBe(firstDiagnosis);
  });
});
