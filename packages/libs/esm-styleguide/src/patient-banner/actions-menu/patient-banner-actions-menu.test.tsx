import { ExtensionSlot, useExtensionSlot, useLayoutType, useOnClickOutside } from '@openmrs/esm-react-utils';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientBannerActionsMenu } from './patient-banner-actions-menu.component';

vi.mock('@openmrs/esm-react-utils', async () => ({
  ...(await vi.importActual('@openmrs/esm-react-utils')),
  ExtensionSlot: vi.fn(),
  useExtensionSlot: vi.fn(),
  useLayoutType: vi.fn(),
  useOnClickOutside: vi.fn(),
}));

const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockUseExtensionSlot = vi.mocked(useExtensionSlot);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseOnClickOutside = vi.mocked(useOnClickOutside);

const patientUuid = 'patient-uuid';
const patient = { id: patientUuid, resourceType: 'Patient' } as fhir.Patient;

describe('PatientBannerActionsMenu', () => {
  beforeEach(() => {
    mockExtensionSlot.mockReset();
    mockUseExtensionSlot.mockReturnValue({ extensions: [{ name: 'patient-action' }] } as ReturnType<
      typeof useExtensionSlot
    >);
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseOnClickOutside.mockReturnValue({ current: null });
  });

  it('hides the Actions trigger when every registered action renders empty', async () => {
    mockExtensionSlot.mockReturnValue(null);

    render(
      <PatientBannerActionsMenu actionsSlotName="patient-actions-slot" patient={patient} patientUuid={patientUuid} />,
    );

    await waitFor(() => expect(screen.queryByRole('button', { name: /actions/i })).not.toBeInTheDocument());
  });

  it('shows the Actions trigger when an authorized action renders a menu item', async () => {
    mockExtensionSlot.mockReturnValue(
      <button role="menuitem" type="button">
        Authorized action
      </button>,
    );

    render(
      <PatientBannerActionsMenu actionsSlotName="patient-actions-slot" patient={patient} patientUuid={patientUuid} />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /actions/i })).toBeVisible());
  });

  it('updates the trigger when the rendered actions change', async () => {
    mockExtensionSlot.mockReturnValue(null);

    const { rerender } = render(
      <PatientBannerActionsMenu actionsSlotName="patient-actions-slot" patient={patient} patientUuid={patientUuid} />,
    );

    await waitFor(() => expect(screen.queryByRole('button', { name: /actions/i })).not.toBeInTheDocument());

    mockExtensionSlot.mockReturnValue(
      <button role="menuitem" type="button">
        Authorized action
      </button>,
    );
    rerender(
      <PatientBannerActionsMenu actionsSlotName="patient-actions-slot" patient={patient} patientUuid={patientUuid} />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /actions/i })).toBeVisible());
  });
});
