import { openmrsFetch } from '@openmrs/esm-framework';
import { screen, waitFor } from '@testing-library/react';
import React from 'react';
import { mockFhirAllergyIntoleranceResponse, mockFhirPatient, renderWithSwr } from 'test-utils';
import AllergiesTile from './allergies-tile.extension';

const mockOpenmrsFetch = openmrsFetch as vi.Mock;
void React;

describe('AllergiesTile', () => {
  it('renders an empty state when allergy data is not available', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({
      data: {
        total: 0,
        entry: [],
      },
    });
    renderWithSwr(React.createElement(AllergiesTile, { patientUuid: mockFhirPatient.id }));

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/allergies/i)).toBeInTheDocument();
    expect(screen.getByText(/unknown/i)).toBeInTheDocument();
  });

  it("renders a summary of the patient's allergy data when available", async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: mockFhirAllergyIntoleranceResponse });
    renderWithSwr(React.createElement(AllergiesTile, { patientUuid: mockFhirPatient.id }));

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/allergies/i)).toBeInTheDocument();
    expect(screen.getByText(/ACE inhibitors, Fish, Penicillins, Morphine, Aspirin/i)).toBeInTheDocument();
  });
});
