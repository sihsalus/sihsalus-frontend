import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ClinicalSearch, { matchesClinicalQuery } from './clinical-search';

const mockUseSession = vi.hoisted(() => vi.fn());
const mockUsePatientConditions = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockSelectClinicalSearchTarget = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-framework', () => ({
  formatPartialDate: (date: string) => date,
  navigate: mockNavigate,
  useSession: mockUseSession,
  userHasAccess: (privilege: string, user: { privileges: Array<{ name: string }> }) =>
    user.privileges.some((item) => item.name === privilege),
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  getAntecedentTypeLabel: (type: string) => (type === 'family' ? 'Family history' : type),
  selectClinicalSearchTarget: mockSelectClinicalSearchTarget,
  usePatientConditions: mockUsePatientConditions,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, options?: { total?: number; date?: string }) =>
      options
        ? fallback.replace('{{total}}', String(options.total)).replace('{{date}}', String(options.date))
        : fallback,
  }),
}));

vi.mock('./clinical-search.scss', () => ({
  default: { search: 'search', results: 'results', hint: 'hint' },
}));

describe('clinical chart search', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      user: { privileges: [{ name: 'app:hoja.clinica.condiciones' }] },
    });
    mockUsePatientConditions.mockReturnValue({
      conditions: [
        {
          id: 'condition-1',
          display: 'Hipertensión arterial',
          antecedentType: 'family',
          clinicalStatus: 'ACTIVE',
          onsetDateTime: '2020-05',
        },
        {
          id: 'condition-2',
          display: 'Diabetes mellitus',
          categoryText: 'Problema activo',
        },
      ],
      isLoading: false,
    });
    mockUsePatientConditions.mockClear();
    mockNavigate.mockClear();
    mockSelectClinicalSearchTarget.mockClear();
  });

  it('matches accents and words in any order', () => {
    expect(matchesClinicalQuery('Hipertensión arterial', 'ARTERIAL hipertension')).toBe(true);
    expect(matchesClinicalQuery('Hipertensión arterial', 'diabetes')).toBe(false);
    expect(matchesClinicalQuery('Hipertensión arterial', '  ')).toBe(false);
  });

  it('does not read conditions without section permission or matching patient identity', () => {
    mockUseSession.mockReturnValue({ user: { privileges: [] } });
    const denied = render(<ClinicalSearch patientUuid="patient-1" patientId="patient-1" />);
    expect(denied.container).toBeEmptyDOMElement();
    expect(mockUsePatientConditions).not.toHaveBeenCalled();

    mockUseSession.mockReturnValue({
      user: { privileges: [{ name: 'app:hoja.clinica.condiciones' }] },
    });
    denied.rerender(<ClinicalSearch patientUuid="patient-1" patientId="patient-2" />);
    expect(denied.container).toBeEmptyDOMElement();
    expect(mockUsePatientConditions).not.toHaveBeenCalled();
  });

  it('loads only after a query and filters this patient’s complete condition list', () => {
    render(<ClinicalSearch patientUuid="patient-1" patientId="patient-1" />);
    expect(mockUsePatientConditions).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'HIPERTENSION' },
    });
    expect(mockUsePatientConditions).toHaveBeenCalledWith('patient-1');
    expect(screen.getByText('Hipertensión arterial')).toBeInTheDocument();
    expect(screen.getByText('Family history')).toBeInTheDocument();
    expect(screen.getByText('Onset: 2020-05')).toBeInTheDocument();
    expect(screen.queryByText('Diabetes mellitus')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'family active' },
    });
    expect(screen.getByText('Hipertensión arterial')).toBeInTheDocument();
    expect(screen.queryByText('Diabetes mellitus')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'sin coincidencias' },
    });
    expect(screen.getByText('No matching problems or history entries')).toBeInTheDocument();
  });

  it('reports read failures without presenting them as empty results', () => {
    mockUsePatientConditions.mockReturnValue({
      conditions: null,
      error: new Error('technical details'),
      isLoading: false,
    });
    render(<ClinicalSearch patientUuid="patient-1" patientId="patient-1" />);
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'diabetes' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Clinical data could not be loaded. Try again later.');
    expect(screen.queryByText('technical details')).not.toBeInTheDocument();
    expect(screen.queryByText('No matching problems or history entries')).not.toBeInTheDocument();
  });

  it('opens the exact condition in the current patient chart without putting the query in the URL', () => {
    vi.stubGlobal('spaBase', '/openmrs/spa');
    render(<ClinicalSearch patientUuid="patient-1" patientId="patient-1" />);
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'hipertension' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hipertensión arterial' }));

    expect(mockSelectClinicalSearchTarget).toHaveBeenCalledWith({
      kind: 'condition',
      patientUuid: 'patient-1',
      resourceId: 'condition-1',
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/openmrs/spa/patient/patient-1/chart/Antecedentes',
    });
    vi.unstubAllGlobals();
  });
});
