import { useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import React from 'react';

import type { Observation } from '../../types';
import EncounterObservations from './encounter-observation.component';

void React;

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');
  return {
    ...actual,
    useConfig: vi.fn(),
  };
});

const mockUseConfig = vi.mocked(useConfig);
const observations: Array<Observation> = [
  {
    uuid: 'obs-uuid',
    concept: {
      uuid: 'concept-uuid',
      display: 'Blood pressure',
    },
    value: '120/80',
    groupMembers: null,
  },
];

describe('EncounterObservations', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      obsConceptUuidsToHide: [],
    } as never);
  });

  it('falls back to concept display text when the concept name payload is missing', () => {
    render(<EncounterObservations observations={observations} formConceptMap={{}} />);

    expect(screen.getByText('Blood pressure')).toBeInTheDocument();
    expect(screen.getByText('120/80')).toBeInTheDocument();
  });
});
