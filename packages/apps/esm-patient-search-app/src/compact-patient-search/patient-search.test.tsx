import { getDefaultsFromConfigSchema, logError, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { render, screen, within } from '@testing-library/react';
import dayjs from 'dayjs';

import { configSchema } from '../config-schema';
import { PatientSearchContext } from '../patient-search-context';
import { type SearchedPatient } from '../types';

import PatientSearch from './patient-search.component';

const defaultProps = {
  currentPage: 0,
  data: [],
  fetchError: null,
  hasMore: false,
  isLoading: false,
  isValidating: false,
  setPage: vi.fn(),
  totalResults: 1,
  query: 'John',
};

const mockUseConfig = vi.mocked(useConfig);
const mockLogError = vi.mocked(logError);

describe('PatientSearch', () => {
  beforeEach(() => {
    mockLogError.mockClear();
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  });

  it('renders a loading state when search results are being fetched', () => {
    renderPatientSearch({
      isLoading: true,
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText(/recent search result/i)).not.toBeInTheDocument();
  });

  it('renders an empty state when there are no matching search results', () => {
    renderPatientSearch({
      isLoading: false,
      data: [],
    });

    expect(screen.getByText(/no patient charts were found/i)).toBeInTheDocument();
    expect(screen.getByText(/try to search again using the patient's unique ID number/i)).toBeInTheDocument();
    expect(screen.queryByText(/recent search result/i)).not.toBeInTheDocument();
  });

  it('renders an error state when search results fail to fetch', () => {
    const error = Object.assign(new Error('You are not logged in'), {
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
    });

    renderPatientSearch({
      fetchError: error,
      isLoading: false,
    });

    expect(screen.getByText(/sorry, there was an error. Please try again/i)).toBeInTheDocument();
    expect(screen.queryByText('You are not logged in')).not.toBeInTheDocument();
    expect(screen.queryByText(/recent search result/i)).not.toBeInTheDocument();
    expect(mockLogError).toHaveBeenCalledWith(error, 'Compact patient search request failed');
  });

  it('renders a list of recently searched patients', () => {
    const birthdate = '1990-01-01T00:00:00.000+0000';
    const age = dayjs().diff(birthdate, 'years');
    const mockSearchResults: Array<SearchedPatient> = [
      {
        attributes: [],
        identifiers: [
          {
            display: 'OpenMRS ID = 1000NLY',
            uuid: '19e98c23-d26f-4668-8810-00da0e10e326',
            identifier: '1000NLY',
            identifierType: {
              uuid: '05a29f94-c0ed-11e2-94be-8c13b969e334',
              display: 'OpenMRS ID',
              links: [
                {
                  rel: 'self',
                  uri: `http://dev3.openmrs.org/openmrs/${restBaseUrl}/patientidentifiertype/05a29f94-c0ed-11e2-94be-8c13b969e334`,
                  resourceAlias: 'patientidentifiertype',
                },
              ],
            },
            location: {
              uuid: '44c3efb0-2583-4c80-a79e-1f756a03c0a1',
              display: 'Outpatient Clinic',
            },
            preferred: true,
          },
        ],
        person: {
          age: age,
          addresses: [],
          birthdate: birthdate,
          dead: false,
          deathDate: null,
          gender: 'M',
          personName: {
            display: 'Smith, John Doe',
            givenName: 'John',
            middleName: 'Doe',
            familyName: 'Smith',
            familyName2: '',
          },
        },
        uuid: 'test-patient-uuid',
      },
    ];

    renderPatientSearch({
      currentPage: 0,
      data: mockSearchResults,
      hasMore: false,
      totalResults: 1,
    });

    const patientLink = screen.getByRole('link');
    expect(patientLink).toHaveAttribute('href', `/openmrs/spa/patient/${mockSearchResults[0].uuid}/chart/`);
    expect(within(patientLink).getByText(/Smith, John Doe/)).toBeInTheDocument();
    expect(within(patientLink).getByText(/1000NLY/)).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});

function renderPatientSearch(props = {}) {
  render(
    <PatientSearchContext.Provider value={{}}>
      <PatientSearch {...defaultProps} {...props} />
    </PatientSearchContext.Provider>,
  );
}
