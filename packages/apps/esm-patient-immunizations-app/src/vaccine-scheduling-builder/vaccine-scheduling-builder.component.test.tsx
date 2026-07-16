import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockUseVaccinationSchedule = vi.hoisted(() => vi.fn());

vi.mock('@sihsalus/esm-rbac', () => ({
  modulePrivileges: { vaccineSchedulingBuilder: 'app:gestorCalendarioVacunacion' },
  RequireModulePrivilege: () => null,
}));

vi.mock('./vaccination-schedule.resource', () => ({
  AGE_PERIODS: [],
  saveScheduleData: vi.fn(),
  useVaccinationSchedule: mockUseVaccinationSchedule,
}));

import VaccineSchedulingBuilder from './vaccine-scheduling-builder.component';

describe('VaccineSchedulingBuilder', () => {
  it('does not load schedule data before module access is granted', () => {
    render(<VaccineSchedulingBuilder />);

    expect(mockUseVaccinationSchedule).not.toHaveBeenCalled();
  });
});
