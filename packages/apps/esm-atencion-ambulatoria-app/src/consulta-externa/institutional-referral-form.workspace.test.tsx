import { useConfig, usePatient, useSession, useVisit } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { ConfigObject } from '../config-schema';
import { createInstitutionalReferral } from './institutional-referral.resource';
import InstitutionalReferralWorkspace from './institutional-referral-form.workspace';

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }: React.PropsWithChildren) => children,
}));

vi.mock('./institutional-referral.resource', async () => ({
  ...(await vi.importActual('./institutional-referral.resource')),
  createInstitutionalReferral: vi.fn(),
}));

vi.mock('@carbon/react', async () => {
  const original = await vi.importActual('@carbon/react');
  return {
    ...original,
    ButtonSet: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    ComboBox: ({
      id,
      items,
      itemToString,
      onChange,
      selectedItem,
      titleText,
    }: {
      id: string;
      items: Array<{ renaesCode: string; name: string }>;
      itemToString: (item: { renaesCode: string; name: string } | null) => string;
      onChange: ({ selectedItem }: { selectedItem: { renaesCode: string; name: string } | null }) => void;
      selectedItem: { renaesCode: string; name: string } | null;
      titleText: string;
    }) => (
      <label htmlFor={id}>
        {titleText}
        <select
          id={id}
          value={selectedItem?.renaesCode ?? ''}
          onChange={(event) =>
            onChange({ selectedItem: items.find((item) => item.renaesCode === event.target.value) ?? null })
          }
        >
          <option value="">Seleccione</option>
          {items.map((item) => (
            <option key={item.renaesCode} value={item.renaesCode}>
              {itemToString(item)}
            </option>
          ))}
        </select>
      </label>
    ),
    Form: ({ children, ...props }: React.ComponentProps<'form'>) => <form {...props}>{children}</form>,
    InlineNotification: ({ title, subtitle }: { title: string; subtitle?: string }) => (
      <div role="alert">
        <strong>{title}</strong>
        {subtitle}
      </div>
    ),
    RadioButton: ({ id, labelText, value }: { id: string; labelText: string; value: string }) => (
      <label htmlFor={id}>
        <input id={id} type="radio" value={value} />
        {labelText}
      </label>
    ),
    RadioButtonGroup: ({
      children,
      legendText,
      onChange,
    }: {
      children: React.ReactNode;
      legendText: string;
      onChange: (value: string) => void;
    }) => (
      <fieldset onChange={(event) => onChange((event.target as HTMLInputElement).value)}>
        <legend>{legendText}</legend>
        {children}
      </fieldset>
    ),
    Select: ({ children, id, labelText, ...props }: React.ComponentProps<'select'> & { labelText: string }) => (
      <label htmlFor={id}>
        {labelText}
        <select id={id} {...props}>
          {children}
        </select>
      </label>
    ),
    SelectItem: ({ text, ...props }: React.ComponentProps<'option'> & { text: string }) => (
      <option {...props}>{text}</option>
    ),
    Stack: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    TextArea: ({
      id,
      labelText,
      helperText: _helperText,
      maxCount,
      ...props
    }: React.ComponentProps<'textarea'> & { labelText: string; helperText?: string; maxCount?: number }) => (
      <label htmlFor={id}>
        {labelText}
        <textarea id={id} maxLength={maxCount} {...props} />
      </label>
    ),
    TextInput: ({ id, labelText, ...props }: React.ComponentProps<'input'> & { labelText: string }) => (
      <label htmlFor={id}>
        {labelText}
        <input id={id} {...props} />
      </label>
    ),
  };
});

const mockUseConfig = vi.mocked(useConfig);
const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);
const mockUseVisit = vi.mocked(useVisit);
const mockCreateInstitutionalReferral = vi.mocked(createInstitutionalReferral);

const config = {
  encounterTypes: { referralCounterReferral: 'referral-encounter-type' },
  visitTypes: { ambulatory: 'ambulatory-visit-type' },
  referralEncounterRoleUuid: 'clinician-role',
  referralDestinations: [{ renaesCode: '00000003', name: 'Hospital Regional de Loreto' }],
  concepts: {
    referralTypeUuid: 'referral-type-question',
    referralReasonUuid: 'referral-reason-question',
    referralDestinationUuid: 'destination-question',
    referralDestinationSpecialtyUuid: 'specialty-question',
    referralDestinationSpecialtyOtherUuid: 'specialty-other-question',
    referralOtherSpecialtyUuid: 'other-specialty',
    referralPatientConditionUuid: 'patient-condition-question',
    referralPatientStableUuid: 'stable-condition',
    referralPatientPoorConditionUuid: 'poor-condition',
    referralTransportModeUuid: 'transport-question',
    referralLandTransportUuid: 'land-transport',
    referralAirTransportUuid: 'air-transport',
    referralRiverTransportUuid: 'river-transport',
    referralEmergencyUuid: 'emergency-referral',
    referralUrgencyUuid: 'urgent-referral',
    referralElectiveUuid: 'elective-referral',
  },
} as unknown as ConfigObject;

describe('InstitutionalReferralWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue(config);
    mockUsePatient.mockReturnValue({
      patient: { id: 'patient-uuid', name: [{ text: 'Paciente Sintético' }] },
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof usePatient>);
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      currentProvider: { uuid: 'provider-uuid', identifier: 'provider' },
      user: { person: { display: 'Dra. Sintética' } },
      sessionLocation: { uuid: 'facility-uuid', display: 'Hospital Santa Clotilde', links: [] },
    } as ReturnType<typeof useSession>);
    mockUseVisit.mockReturnValue({
      currentVisit: {
        uuid: 'visit-uuid',
        startDatetime: '2026-08-25T09:00:00.000-05:00',
        visitType: { uuid: 'ambulatory-visit-type' },
        location: { uuid: 'location-uuid', display: 'Consulta Externa' },
      },
    } as ReturnType<typeof useVisit>);
    mockCreateInstitutionalReferral.mockResolvedValue({ uuid: 'referral-uuid' });
  });

  it('captures only referral-owned fields and keeps manual signature blocks out of the encounter', async () => {
    const user = userEvent.setup();
    const closeWorkspace = vi.fn().mockResolvedValue(true);
    const onAfterSave = vi.fn();

    render(
      <InstitutionalReferralWorkspace
        patientUuid="patient-uuid"
        visitUuid="visit-uuid"
        locationUuid="location-uuid"
        closeWorkspace={closeWorkspace}
        onAfterSave={onAfterSave}
      />,
    );

    expect(screen.getByText('Datos ya registrados')).toBeInTheDocument();
    expect(screen.getByText(/Responsable de la referencia.*se dejan en blanco/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Establecimiento destino'), '00000003');
    await user.selectOptions(screen.getByLabelText('Especialidad de destino'), 'fba05733-88f9-459c-acd4-b4e844c24bb7');
    await user.click(screen.getByLabelText('Urgencia'));
    await user.click(screen.getByLabelText('Estable'));
    await user.click(screen.getByLabelText('Fluvial'));
    await user.type(screen.getByLabelText('Motivo de referencia'), 'Manejo quirúrgico especializado');
    await user.click(screen.getByRole('button', { name: 'Registrar referencia' }));

    await waitFor(() =>
      expect(mockCreateInstitutionalReferral).toHaveBeenCalledWith(
        expect.objectContaining({
          patientUuid: 'patient-uuid',
          visitUuid: 'visit-uuid',
          locationUuid: 'location-uuid',
          providerUuid: 'provider-uuid',
          destination: { renaesCode: '00000003', name: 'Hospital Regional de Loreto' },
          referralTypeUuid: 'urgent-referral',
          specialtyUuid: 'fba05733-88f9-459c-acd4-b4e844c24bb7',
          patientConditionUuid: 'stable-condition',
          transportModeUuid: 'river-transport',
          reason: 'Manejo quirúrgico especializado',
        }),
        expect.anything(),
      ),
    );
    expect(onAfterSave).toHaveBeenCalledOnce();
    expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true });
  });
});
