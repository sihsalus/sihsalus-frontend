import {
  ExtensionSlot,
  PatientBannerActionsMenu,
  userHasAccess,
  useSession,
  useVisit,
} from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import { mockAdvancedSearchResults } from 'test-utils';

import { PatientSearchContext, PatientSearchContext2 } from '../../../patient-search-context';
import { patientChartPrivilege } from '../../../patient-chart-access';
import { type SearchedPatient } from '../../../types';

import PatientBanner from './patient-banner.component';

vi.mock('../../../sihsalus-patient-info/sihsalus-patient-info.component', () => ({
  SihsalusPatientInfo: ({ patient }) => <span>{patient.name[0].text}</span>,
}));

const mockUseVisit = vi.mocked(useVisit);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockPatientBannerActionsMenu = vi.mocked(PatientBannerActionsMenu);

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ConfigurableLink: ({ children }) => <a href="/patient">{children}</a>,
  ExtensionSlot: vi.fn(({ name }) => (
    <button type="button">{name.includes('start-visit') ? 'Start visit' : 'Primary patient action'}</button>
  )),
  PatientBannerActionsMenu: vi.fn(() => <button type="button">More patient actions</button>),
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
const clinicalUser = {
  privileges: [{ display: patientChartPrivilege }],
  roles: [],
};

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

function renderPatientBannerWithContext2(
  patientToRender = patient,
  onPatientSelected = vi.fn(),
  startVisitWorkspaceName?: string,
) {
  return render(
    <PatientSearchContext2.Provider
      value={{
        closeWorkspace: vi.fn(),
        launchChildWorkspace: vi.fn(),
        onPatientSelected,
        startVisitWorkspaceName,
      }}
    >
      <PatientBanner patient={patientToRender} patientUuid={patientToRender.uuid} />
    </PatientSearchContext2.Provider>,
  );
}

function renderPatientBannerWithLegacySelection(patientToRender = patient, nonNavigationSelectPatientAction = vi.fn()) {
  return render(
    <PatientSearchContext.Provider value={{ nonNavigationSelectPatientAction }}>
      <PatientBanner patient={patientToRender} patientUuid={patientToRender.uuid} />
    </PatientSearchContext.Provider>,
  );
}

function getRenderedSlotNames() {
  return mockExtensionSlot.mock.calls.map(([props]) => props.name);
}

describe('PatientBanner', () => {
  beforeEach(() => {
    mockExtensionSlot.mockClear();
    mockPatientBannerActionsMenu.mockClear();
    mockUseSession.mockReturnValue({ user: clinicalUser } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation((privilege) => privilege === patientChartPrivilege);
  });

  it('does not show the start visit action when the patient has an active visit', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({ activeVisit }));

    render(<PatientBanner patient={patient} patientUuid={patient.uuid} />);

    expect(screen.getByText('Joshua Johnson')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start visit/i })).not.toBeInTheDocument();
    expect(getRenderedSlotNames()).toEqual(['patient-search-primary-actions-slot']);
  });

  it('keeps standalone patient actions available when the patient has no active or current visit', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));

    render(<PatientBanner patient={patient} patientUuid={patient.uuid} />);

    expect(screen.getByRole('button', { name: /start visit/i })).toBeInTheDocument();
    expect(screen.getByRole('link')).toBeInTheDocument();
    expect(getRenderedSlotNames()).toEqual(['patient-search-primary-actions-slot', 'start-visit-button-slot']);
    expect(mockPatientBannerActionsMenu).toHaveBeenCalledOnce();
    expect(mockPatientBannerActionsMenu.mock.calls[0][0].additionalActionsSlotState).toEqual(
      expect.objectContaining({ launchPatientChart: true }),
    );
  });

  it('renders a non-interactive standalone card when the user cannot access the patient chart', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));
    mockUserHasAccess.mockReturnValue(false);

    render(<PatientBanner patient={patient} patientUuid={patient.uuid} />);

    expect(screen.getByText('Joshua Johnson')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Joshua Johnson/i })).not.toBeInTheDocument();
    expect(mockUserHasAccess).toHaveBeenCalledWith(patientChartPrivilege, clinicalUser);
    expect(mockPatientBannerActionsMenu.mock.calls[0][0].additionalActionsSlotState).toEqual(
      expect.objectContaining({ launchPatientChart: false }),
    );
  });

  it('hides unrelated patient actions in legacy embedded selection mode', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));
    const nonNavigationSelectPatientAction = vi.fn();

    renderPatientBannerWithLegacySelection(patient, nonNavigationSelectPatientAction);

    expect(getRenderedSlotNames()).toEqual([]);
    expect(mockPatientBannerActionsMenu).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Joshua Johnson/i }));
    expect(nonNavigationSelectPatientAction).toHaveBeenCalledWith(patient.uuid);
  });

  it('hides unrelated patient actions in Context2 embedded selection mode', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));
    const onPatientSelected = vi.fn();

    renderPatientBannerWithContext2(patient, onPatientSelected);

    expect(getRenderedSlotNames()).toEqual([]);
    expect(mockPatientBannerActionsMenu).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Joshua Johnson/i }));
    expect(onPatientSelected).toHaveBeenCalledOnce();
    expect(onPatientSelected.mock.calls[0][0]).toBe(patient.uuid);
  });

  it('keeps Context2 patient selection interactive without patient-chart access', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));
    mockUserHasAccess.mockReturnValue(false);
    const onPatientSelected = vi.fn();

    renderPatientBannerWithContext2(patient, onPatientSelected);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Joshua Johnson/i }));
    expect(onPatientSelected).toHaveBeenCalledOnce();
    expect(onPatientSelected.mock.calls[0][0]).toBe(patient.uuid);
  });

  it('keeps an explicitly enabled Context2 start visit action available', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));

    renderPatientBannerWithContext2(patient, vi.fn(), 'start-visit-workspace');

    expect(getRenderedSlotNames()).toEqual(['start-visit-button-slot2']);
    expect(mockPatientBannerActionsMenu).not.toHaveBeenCalled();
  });

  it.each([
    ['visit data is still loading', { isLoading: true }],
    ['visit data is validating', { isValidating: true }],
    ['visit data failed', { error: new Error('Visit lookup failed') }],
  ])('does not show the start visit action when %s', (_description, visitState) => {
    mockUseVisit.mockReturnValue(mockVisitReturn(visitState));

    render(<PatientBanner patient={patient} patientUuid={patient.uuid} />);

    expect(screen.queryByRole('button', { name: /start visit/i })).not.toBeInTheDocument();
    expect(getRenderedSlotNames()).not.toContain('start-visit-button-slot');
  });

  it('treats dead=true without a death date as deceased and hides start visit', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));

    const deceasedPatient = {
      ...patient,
      person: {
        ...patient.person,
        dead: true,
        deathDate: null,
      },
    };

    render(<PatientBanner patient={deceasedPatient} patientUuid={deceasedPatient.uuid} />);

    expect(screen.queryByRole('button', { name: /start visit/i })).not.toBeInTheDocument();
    expect(mockExtensionSlot).not.toHaveBeenCalled();
  });

  it('renders without failing when optional patient metadata is incomplete', () => {
    mockUseVisit.mockReturnValue(mockVisitReturn({}));

    const incompletePatient = {
      ...patient,
      attributes: [{ attributeType: null, value: null }],
      identifiers: [
        {
          ...patient.identifiers[0],
          identifierType: null,
        },
        null,
      ],
      person: {
        ...patient.person,
        addresses: [null],
      },
    } as unknown as SearchedPatient;

    render(<PatientBanner patient={incompletePatient} patientUuid={incompletePatient.uuid} />);

    expect(screen.getByText('Joshua Johnson')).toBeInTheDocument();
  });
});
