import { openmrsFetch } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import React from 'react';
import {
  mockFhirAllergyIntoleranceResponse,
  mockFhirPatient,
  patientChartBasePath,
  renderWithSwr,
  waitForLoadingToFinish,
} from 'test-utils';
import AllergiesOverview from './allergies-overview.component';

const mockOpenmrsFetch = openmrsFetch as vi.Mock;
void React;

describe('AllergiesOverview', () => {
  it('renders an empty state view if allergy data is unavailable', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: [] });
    renderWithSwr(React.createElement(AllergiesOverview, { patient: mockFhirPatient, basePath: patientChartBasePath }));

    await waitForLoadingToFinish();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /allergies/i })).toBeInTheDocument();
    expect(screen.getByText(/There are no allergy intolerances to display for this patient/i)).toBeInTheDocument();
    expect(screen.getByText(/Record allergy intolerances/i)).toBeInTheDocument();
  });

  it('renders an error state view if there is a problem fetching allergies data', async () => {
    const error = {
      message: 'You are not logged in',
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
    };
    mockOpenmrsFetch.mockRejectedValueOnce(error);
    renderWithSwr(React.createElement(AllergiesOverview, { patient: mockFhirPatient, basePath: patientChartBasePath }));

    await waitForLoadingToFinish();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /allergies/i })).toBeInTheDocument();
    expect(screen.getByText(/Error 401: Unauthorized/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sorry, there was a problem displaying this information. You can try to reload this page, or contact the site administrator and quote the error code above/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders an overview of the patient's allergic reactions and their manifestations", async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: mockFhirAllergyIntoleranceResponse });

    renderWithSwr(React.createElement(AllergiesOverview, { patient: mockFhirPatient, basePath: patientChartBasePath }));

    await waitForLoadingToFinish();

    expect(screen.getByRole('heading', { name: /allergies/i })).toBeInTheDocument();

    const expectedColumnHeaders = [/name/, /reactions/];
    const expectedAllergies = [
      /non-coded allergen non-coded allergic reaction \(severe\)/,
      /ace inhibitors anaphylaxis \(moderate\)/,
      /fish anaphylaxis, angioedema, fever, hives \(mild\)/,
      /penicillins angioedema, cough, diarrhea, mental status change, musculoskeletal pain \(severe\)/,
      /morphine mental status change \(severe\)/,
    ];

    expect(screen.getByRole('heading', { name: /allergies/i })).toBeInTheDocument();
    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });
    expectedAllergies.forEach((allergy) => {
      expect(screen.getByRole('row', { name: new RegExp(allergy, 'i') })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
  });
});
