import { getDefaultsFromConfigSchema, useAppContext, useConfig } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import { mockPatientAlice, mockVisitAlice } from '__mocks__';
import { renderWithSwr } from 'test-utils';
import { mockInpatientAdmissionAlice } from '../../../../../__mocks__/inpatient-admission';
import { mockWardBeds } from '../../../../../__mocks__/wardBeds.mock';
import { mockWardViewContext } from '../../../mock';
import { configSchema, type WardConfigObject } from '../../config-schema';
import { useObs } from '../../hooks/useObs';
import { type WardPatient, type WardViewContext } from '../../types';
import MaternalWardPatientCard from './maternal-ward-patient-card.component';

const mockUseConfig = vi.mocked(useConfig<WardConfigObject>);

vi.mocked(useAppContext<WardViewContext>).mockReturnValue(mockWardViewContext);

vi.mock('../../hooks/useObs', () => ({
  useObs: vi.fn(),
}));

vi.mock('../../ward-patient-card/row-elements/ward-patient-obs.resource', () => ({
  obsCustomRepresentation: 'custom:(uuid,display)',
  getObsEncounterString: vi.fn(),
  useConceptToTagColorMap: vi.fn(),
}));

//@ts-expect-error
vi.mocked(useObs).mockReturnValue({
  data: [],
});

beforeEach(() => {
  mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema<WardConfigObject>(configSchema));
});

describe('MaternalWardPatientCard', () => {
  it('renders a patient with no child', () => {
    const alice: WardPatient = {
      patient: mockPatientAlice,
      bed: mockWardBeds[0],
      inpatientAdmission: mockInpatientAdmissionAlice,
      visit: mockVisitAlice,
      inpatientRequest: null,
    };
    renderWithSwr(<MaternalWardPatientCard wardPatient={alice} childrenOfWardPatientInSameBed={[]} />);

    const patientName = screen.queryByText('Alice Johnson');
    expect(patientName).toBeInTheDocument();
  });

  it('renders a patient with another child in same bed', () => {
    const alice: WardPatient = {
      patient: mockPatientAlice,
      bed: mockWardBeds[0],
      inpatientAdmission: mockInpatientAdmissionAlice,
      visit: mockVisitAlice,
      inpatientRequest: null,
    };
    renderWithSwr(<MaternalWardPatientCard wardPatient={alice} childrenOfWardPatientInSameBed={[alice]} />);

    const bedDivider = screen.queryByText('Mother / Child');
    expect(bedDivider).toBeInTheDocument();
  });
});
