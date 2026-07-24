import { getDefaultsFromConfigSchema, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';

import { configSchema, type PatientSearchConfig } from '../config-schema';
import { PatientSearchContext } from '../patient-search-context';
import { type SearchedPatient } from '../types';

import CompactPatientBanner from './compact-patient-banner.component';

const mockUseConfig = vi.mocked(useConfig<PatientSearchConfig>);

const birthdate = '1990-01-01T00:00:00.000+0000';
const age = dayjs().diff(birthdate, 'years');
const patients: Array<SearchedPatient> = [
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
      age,
      addresses: [],
      birthdate,
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

describe('CompactPatientBanner', () => {
  beforeEach(() => mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema)));

  it('renders a compact patient banner', () => {
    render(
      <PatientSearchContext.Provider value={{}}>
        <CompactPatientBanner patients={patients} />
      </PatientSearchContext.Provider>,
    );

    const patientLink = screen.getByRole('link');
    expect(patientLink).toHaveAttribute('aria-label', 'Smith, John Doe');
    expect(patientLink).toHaveAttribute('href', '/openmrs/spa/patient/test-patient-uuid/chart/');
    expect(within(patientLink).getByText(/Smith, John Doe/)).toBeInTheDocument();
    expect(within(patientLink).getByText(/1000NLY/)).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders patients whose identifier type metadata is missing', () => {
    const patientWithIncompleteMetadata = {
      ...patients[0],
      attributes: [{ attributeType: null, value: '999999999' }],
      identifiers: [{ ...patients[0].identifiers[0], identifierType: null }],
    } as unknown as SearchedPatient;

    render(
      <PatientSearchContext.Provider value={{}}>
        <CompactPatientBanner patients={[patientWithIncompleteMetadata]} />
      </PatientSearchContext.Provider>,
    );

    const patientLink = screen.getByRole('link', { name: 'Smith, John Doe' });
    expect(patientLink).toBeInTheDocument();
    expect(within(patientLink).getByText(/1000NLY/)).toBeInTheDocument();
  });

  it('runs the patient click side effect before navigating', async () => {
    const patientClickSideEffect = vi.fn();
    const user = userEvent.setup();

    render(
      <PatientSearchContext.Provider value={{ patientClickSideEffect }}>
        <CompactPatientBanner patients={patients} />
      </PatientSearchContext.Provider>,
    );

    await user.click(screen.getByRole('link', { name: 'Smith, John Doe' }));

    expect(patientClickSideEffect).toHaveBeenCalledOnce();
    expect(patientClickSideEffect).toHaveBeenCalledWith('test-patient-uuid');
  });

  it('uses a button and selects without navigation when an action is provided', async () => {
    const nonNavigationSelectPatientAction = vi.fn();
    const patientClickSideEffect = vi.fn();
    const user = userEvent.setup();

    render(
      <PatientSearchContext.Provider value={{ nonNavigationSelectPatientAction, patientClickSideEffect }}>
        <CompactPatientBanner patients={patients} />
      </PatientSearchContext.Provider>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const patientButton = screen.getByRole('button', { name: 'Smith, John Doe' });
    await user.click(patientButton);

    expect(nonNavigationSelectPatientAction).toHaveBeenCalledOnce();
    expect(nonNavigationSelectPatientAction).toHaveBeenCalledWith('test-patient-uuid');
    expect(patientClickSideEffect).toHaveBeenCalledOnce();
    expect(patientClickSideEffect).toHaveBeenCalledWith('test-patient-uuid');
  });
});
