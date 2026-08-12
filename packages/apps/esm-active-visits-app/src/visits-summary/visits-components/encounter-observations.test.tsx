import { render, screen } from '@testing-library/react';
import React from 'react';

import { type Observation } from '../../types';

import EncounterObservations from './encounter-observations.component';

void React;

describe('EncounterObservations', () => {
  test('renders skeleton text while loading', () => {
    render(<EncounterObservations observations={null} />);

    expect(screen.queryByText('Temperature')).not.toBeInTheDocument();
  });

  test('renders "No observations found" message when observations list is empty', () => {
    const emptyObservations = [];
    render(<EncounterObservations observations={emptyObservations} />);

    expect(screen.getByText('No observations found')).toBeInTheDocument();
  });

  test('renders observations list correctly', () => {
    const observations = [
      { display: 'Temperature: 98.6°F', uuid: 'temperature-observation' },
      { display: 'Blood Pressure: 120/80 mmHg', uuid: 'blood-pressure-observation' },
      { display: 'Heart Rate: 72 bpm', uuid: 'heart-rate-observation' },
    ] as Array<Observation>;
    render(<EncounterObservations observations={observations} />);

    expect(screen.getByText('Temperature:')).toBeInTheDocument();
    expect(screen.getByText('98.6°F')).toBeInTheDocument();

    expect(screen.getByText('Blood Pressure:')).toBeInTheDocument();
    expect(screen.getByText('120/80 mmHg')).toBeInTheDocument();

    expect(screen.getByText('Heart Rate:')).toBeInTheDocument();
    expect(screen.getByText('72 bpm')).toBeInTheDocument();
  });

  test('preserves each observation when their order changes', () => {
    const observations = [
      { display: 'Temperature: 98.6°F', uuid: 'temperature-observation' },
      { display: 'Temperature: 99.1°F', uuid: 'second-temperature-observation' },
    ] as Array<Observation>;
    const { rerender } = render(<EncounterObservations observations={observations} />);
    const firstReading = screen.getByText('98.6°F');

    rerender(<EncounterObservations observations={[...observations].reverse()} />);

    expect(screen.getByText('98.6°F')).toBe(firstReading);
  });
});
