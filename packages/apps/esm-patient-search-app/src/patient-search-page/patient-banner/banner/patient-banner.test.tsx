import { ExtensionSlot, useVisit } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { mockAdvancedSearchResults } from 'test-utils';

import { PatientSearchContext2 } from '../../../patient-search-context';
import { type SearchedPatient } from '../../../types';

import PatientBanner from './patient-banner.component';

vi.mock('../../../sihsalus-patient-info/sihsalus-patient-info.component', () => ({
  SihsalusPatientInfo: ({ patient }) => <span>{patient.name[0].text}</span>,
}));

const mockUseVisit = vi.mocked(useVisit);
const mockExtensionSlot = vi.mocked(ExtensionSlot);

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ConfigurableLink: ({ children }) => <a href="/patient">{children}</a>,
  ExtensionSlot: vi.fn(() => <button type="button">Start visit</button>),
  PatientBannerActionsMenu: () => null,
  PatientBannerContactDetails: () => null,
  PatientBannerPatientInfo: ({ patient }) => <span>{patient.name[0].text}</span>,
  PatientBannerToggleContactDetailsButton: () => null,
  PatientPhoto: () => null,
  useConfig: vi.fn(() => ({ search: { patientChartUrl: '/patient' } })),
  useLayoutType: vi.fn(() => 'tablet'),
  useVisit: vi.fn(),
}));

const patient = mockAdvancedSearchResults[0] as unknown as SearchedPatient;
const activeVisit = { uuid: 'active-visit-uuid' } as unknown as NonNullable<ReturnType<typeof useVisit>['activeVisit']>;

function mockVisitReturn(overrides: Partial<ReturnType<typeof useVisit>>) {
  return {
    activeVisit: null,
    currentVisit: null,
    currentVisitIsRetrospective: false,
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useVisit>;
}

function renderPatientBanner(patientToRender = patient) {
  return render(
    <PatientSearchContext2.Provider
      value={{
        closeWorkspace: vi.fn(),
        launchChildWorkspace: vi.fn(),
        onPatientSelected: vi.fn(),
        startVisitWorkspaceName: 'start-visit-workspace',
      }}
    >
      <PatientBanner patient={patientToRender} patientUuid={patientToRender.uuid} />
    </PatientSearchContext2.Provider>,
  );
}

describe('PatientBanner', () => {
  beforeEach(() => {
    mockExtensionSlot.mockClear();
  });

  it('does not show the start visit action when the patient has an active visit', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({ activeVisit }));

    renderPatientBanner();

    expect(screen.getByText('Joshua Johnson')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start visit/i })).not.toBeInTheDocument();
    expect(mockExtensionSlot).not.toHaveBeenCalled();
  });

  it('shows the start visit action when the patient has no active or current visit', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));

    renderPatientBanner();

    expect(screen.getByRole('button', { name: /start visit/i })).toBeInTheDocument();
    expect(mockExtensionSlot).toHaveBeenCalled();
  });

  it('renders patients whose identifier type metadata is missing', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));
    const patientWithIncompleteMetadata = {
      ...patient,
      attributes: [{ attributeType: null, value: '999999999' }],
      identifiers: [{ ...patient.identifiers[0], identifierType: null }],
    } as unknown as SearchedPatient;

    renderPatientBanner(patientWithIncompleteMetadata);

    expect(screen.getByText('Joshua Johnson')).toBeInTheDocument();
  });

  it.each([
    ['visit data is still loading', { isLoading: true }],
    ['visit data is validating', { isValidating: true }],
    ['visit data failed', { error: new Error('Visit lookup failed') }],
  ])('does not show the start visit action when %s', (_description, visitState) => {
    mockUseVisit.mockReturnValue(mockVisitReturn(visitState));

    renderPatientBanner();

    expect(screen.queryByRole('button', { name: /start visit/i })).not.toBeInTheDocument();
    expect(mockExtensionSlot).not.toHaveBeenCalled();
  });

  it('treats dead=true without a death date as deceased and hides start visit', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));

    renderPatientBanner({
      ...patient,
      person: {
        ...patient.person,
        dead: true,
        deathDate: null,
      },
    });

    expect(screen.queryByRole('button', { name: /start visit/i })).not.toBeInTheDocument();
    expect(mockExtensionSlot).not.toHaveBeenCalled();
  });
});
