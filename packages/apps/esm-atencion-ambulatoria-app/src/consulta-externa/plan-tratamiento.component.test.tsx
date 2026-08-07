import { getDefaultsFromConfigSchema, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { configSchema } from '../config-schema';
import { useTreatmentPlan } from '../hooks/useTreatmentPlan';
import PlanTratamiento from './plan-tratamiento.component';

vi.mock('../hooks/useTreatmentPlan', () => ({
  useTreatmentPlan: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseTreatmentPlan = vi.mocked(useTreatmentPlan);

describe('PlanTratamiento — order basket action', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    mockUseTreatmentPlan.mockReturnValue({
      treatmentPlans: [],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate: vi.fn(),
      pagination: { currentPage: 1, totalPages: 1, onPageChange: vi.fn() },
      sourceErrors: [],
    } as unknown as ReturnType<typeof useTreatmentPlan>);
  });

  it('offers the prescribe action to a user who can edit orders', () => {
    mockUserHasAccess.mockReturnValue(true);

    render(<PlanTratamiento patientUuid="patient-uuid" />);

    expect(screen.getByRole('button', { name: /prescribir medicamentos/i })).toBeInTheDocument();
    expect(mockUserHasAccess.mock.calls[0][0]).toBe('app:hoja.clinica.ordenes.editar');
  });

  it('hides the prescribe action without the ordering privilege, so no visit is started for a launch that would fail', () => {
    mockUserHasAccess.mockReturnValue(false);

    render(<PlanTratamiento patientUuid="patient-uuid" />);

    expect(screen.queryByRole('button', { name: /prescribir medicamentos/i })).not.toBeInTheDocument();
  });
});
