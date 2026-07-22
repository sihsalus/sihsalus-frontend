import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import {
  mockAdmissionLocation,
  mockLocationInpatientWard,
  mockPatientAlice,
  mockPatientBrian,
} from '../../../../__mocks__';
import { configSchema, type WardConfigObject } from '../config-schema';
import { useObs } from '../hooks/useObs';
import useWardLocation from '../hooks/useWardLocation';
import { type WardPatient } from '../types';
import DefaultWardPatientCard from '../ward-view/default-ward/default-ward-patient-card.component';
import { bedLayoutToBed, filterBeds } from '../ward-view/ward-view.resource';
import WardBed from './ward-bed.component';

const defaultConfig: WardConfigObject = getDefaultsFromConfigSchema(configSchema);

vi.mocked(useConfig).mockReturnValue(defaultConfig);
vi.mock('../hooks/useObs', () => ({
  useObs: vi.fn(),
}));
vi.mock('../ward-patient-card/row-elements/ward-patient-obs.resource', () => ({
  obsCustomRepresentation: 'custom:(uuid,display)',
  getObsEncounterString: vi.fn(),
  useConceptToTagColorMap: vi.fn(),
}));

const mockBedLayouts = filterBeds(mockAdmissionLocation);

vi.mock('../hooks/useWardLocation', () => ({ default: vi.fn() }));
//@ts-expect-error
vi.mocked(useObs).mockReturnValue({
  data: [],
});

const mockedUseWardLocation = useWardLocation as vi.Mock;
mockedUseWardLocation.mockReturnValue({
  location: mockLocationInpatientWard,
  isLoadingLocation: false,
  errorFetchingLocation: null,
  invalidLocation: false,
});

const mockBedToUse = mockBedLayouts[0];
const mockBed = bedLayoutToBed(mockBedToUse);

const mockWardPatientAliceProps: WardPatient = {
  visit: null,
  patient: mockPatientAlice,
  bed: mockBed,
  inpatientAdmission: null,
  inpatientRequest: null,
};

const _mockWardPatientBrianProps: WardPatient = {
  visit: null,
  patient: mockPatientBrian,
  bed: mockBed,
  inpatientAdmission: null,
  inpatientRequest: null,
};

describe('Ward bed', () => {
  it('renders a single bed with patient details', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-07-22T12:00:00Z'));

    try {
      render(
        <WardBed
          patientCards={[
            <DefaultWardPatientCard key={mockPatientAlice.uuid} wardPatient={mockWardPatientAliceProps} />,
          ]}
          bed={mockBed}
        />,
      );
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('26 years 6 months 21 days')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders a divider for shared patients', () => {
    render(
      <WardBed
        bed={mockBed}
        patientCards={[
          <DefaultWardPatientCard key={mockPatientAlice.uuid} wardPatient={mockWardPatientAliceProps} />,
          <DefaultWardPatientCard key={mockPatientBrian.uuid} wardPatient={mockWardPatientAliceProps} />,
        ]}
      />,
    );
    const bedShareText = screen.getByTitle('Bed share');
    expect(bedShareText).toBeInTheDocument();
  });
});
