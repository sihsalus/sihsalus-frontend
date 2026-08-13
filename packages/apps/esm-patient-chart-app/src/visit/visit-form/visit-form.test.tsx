import {
  type AssignedExtension,
  ExtensionSlot,
  type FetchResponse,
  getDefaultsFromConfigSchema,
  getUserFacingErrorMessage,
  navigate,
  saveVisit,
  showSnackbar,
  updateVisit,
  useConfig,
  useConnectivity,
  useLocations,
  usePatient,
  userHasAccess,
  useSession,
  useVisitTypes,
  type Visit,
} from '@openmrs/esm-framework';
import {
  copyFinanciadorToVisitPrivileges,
  createOfflineVisitForPatient,
  fetchFreshPatientVitalStatus,
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
  SELF_FINANCED_CONCEPT_UUID,
  SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID,
  SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_CONCEPT_UUID,
  safeCopyFinanciadorToVisit,
} from '@openmrs/esm-patient-common-lib';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import React from 'react';
import { mockLocations, mockPatient, mockVisitTypes, mockVisitWithAttributes } from 'test-utils';

import { type ChartConfig, esmPatientChartSchema } from '../../config-schema';
import { useEmrConfiguration } from '../hooks/useEmrConfiguration';
import { useVisitAttributeType } from '../hooks/useVisitAttributeType';

import {
  createVisitAttribute,
  deleteVisitAttribute,
  getVisitAttributes,
  reconcileVisitCreation,
  updateVisitAttribute,
  usePersonAttributesForVisitDefaults,
  useVisitFormCallbacks,
} from './visit-form.resource';
import StartVisitForm from './visit-form.workspace';
import { useVisitProvenanceAddressOptions } from './visit-provenance.resource';

vi.mock('@carbon/react', async () => {
  const actual = await vi.importActual('@carbon/react');
  const React = await vi.importActual<typeof import('react')>('react');
  const { default: dayjs } = await vi.importActual<{ default: typeof import('dayjs') }>('dayjs');
  const { default: customParseFormat } = await vi.importActual<{
    default: typeof import('dayjs/plugin/customParseFormat');
  }>('dayjs/plugin/customParseFormat');

  dayjs.extend(customParseFormat);

  const MockDatePickerInput = React.forwardRef<
    HTMLInputElement,
    React.ComponentPropsWithoutRef<'input'> & {
      labelText?: React.ReactNode;
      invalid?: boolean;
      invalidText?: React.ReactNode;
    }
  >(function MockDatePickerInput(
    { id, labelText, invalid, invalidText, placeholder, style, value, onChange, ...props },
    ref,
  ) {
    return (
      <>
        <label htmlFor={id}>{labelText}</label>
        <input
          {...props}
          aria-invalid={invalid}
          id={id}
          onChange={onChange}
          placeholder={placeholder}
          ref={ref}
          style={style}
          type="text"
          value={value ?? ''}
        />
        {invalid ? <span>{invalidText}</span> : null}
      </>
    );
  });

  return {
    ...actual,
    ComboBox: ({ 'aria-label': ariaLabel, id, items, itemToString, onChange, selectedItem, titleText }) => {
      const selectedValue = selectedItem?.uuid ?? items[0]?.uuid ?? '';

      return (
        <>
          <label htmlFor={id}>{titleText}</label>
          <select
            aria-label={ariaLabel ?? titleText}
            id={id}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChange?.({
                selectedItem: items.find((item) => item?.uuid === nextValue) ?? null,
              });
            }}
            value={selectedValue}
          >
            <option value="" />
            {items.map((item) => (
              <option key={item.uuid} value={item.uuid}>
                {itemToString(item)}
              </option>
            ))}
          </select>
        </>
      );
    },
    DatePicker: ({
      children,
      onChange,
      value,
    }: {
      children: React.ReactNode;
      onChange?: (dates: Array<Date | undefined>) => void;
      value?: Date | string;
    }) => {
      const child = React.Children.only(children) as React.ReactElement<
        React.ComponentPropsWithoutRef<'input'> & {
          onChange?: (...args: unknown[]) => void;
        }
      >;
      const formattedValue = typeof value === 'string' ? value : value ? dayjs(value).format('DD/MM/YYYY') : '';

      return React.cloneElement(child, {
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          child.props.onChange?.(event);
          const parsedDate = dayjs(event.target.value, 'DD/MM/YYYY', true);
          onChange?.([parsedDate.isValid() ? parsedDate.toDate() : undefined]);
        },
        value: formattedValue,
      });
    },
    DatePickerInput: MockDatePickerInput,
  };
});

const visitUuid = 'test_visit_uuid';
const essaludConceptUuid = 'f38b048f-ee8b-4244-b3eb-a47a34c38f04';
const sisAccreditationStatusConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2051';
const coverageCopyPrivileges = new Set<string>(copyFinanciadorToVisitPrivileges);
const visitAttributes = {
  financiador: {
    uuid: '3a988e33-a6c0-4b76-b924-01abb998944b',
    name: 'Financiador',
    display: 'Financiador',
    datatypeConfig: 'financiador-config',
    datatypeClassname: 'org.openmrs.customdatatype.datatype.ConceptDatatype' as const,
    description: '',
    preferredHandlerClassname: 'default',
    retired: false,
  },
  punctuality: {
    uuid: '57ea0cbb-064f-4d09-8cf4-e8228700491c',
    name: 'Punctuality',
    display: 'Punctuality',
    datatypeClassname: 'org.openmrs.customdatatype.datatype.ConceptDatatype' as const,
    datatypeConfig: '',
    preferredHandlerClassname: 'default',
    description: '',
    retired: false,
  },
  insurancePolicyNumber: {
    uuid: 'aac48226-d143-4274-80e0-264db4e368ee',
    name: 'Insurance Policy Number',
    display: 'Insurance Policy Number',
    datatypeConfig: '',
    datatypeClassname: 'org.openmrs.customdatatype.datatype.FreeTextDatatype',
    description: '',
    preferredHandlerClassname: 'default',
    retired: false,
  },
  accreditationStatus: {
    uuid: '5e13e902-2030-4f65-b9d5-9a4810c9a603',
    name: 'Estado de Acreditación SIS',
    display: 'Estado de Acreditación SIS',
    datatypeConfig: 'accreditation-status-config',
    datatypeClassname: 'org.openmrs.customdatatype.datatype.ConceptDatatype' as const,
    description: '',
    preferredHandlerClassname: 'default',
    retired: false,
  },
  accreditationCheckedAt: {
    uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
    name: 'Fecha de Acreditación SIS',
    display: 'Fecha de Acreditación SIS',
    datatypeConfig: '',
    datatypeClassname: 'org.openmrs.customdatatype.datatype.DateDatatype',
    description: '',
    preferredHandlerClassname: 'default',
    retired: false,
  },
  provenance: {
    uuid: '9b640334-69e7-49a8-bc8d-1a379742f2f1',
    name: 'Procedencia',
    display: 'Procedencia',
    datatypeConfig: '',
    datatypeClassname: 'org.openmrs.customdatatype.datatype.FreeTextDatatype',
    description: '',
    preferredHandlerClassname: 'default',
    retired: false,
  },
};

const mockInsuredVisitWithAttributes = {
  ...mockVisitWithAttributes,
  attributes: [
    {
      uuid: 'financiador-visit-attribute-uuid',
      attributeType: {
        uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
        display: 'Financiador',
      },
      value: { uuid: essaludConceptUuid, display: 'EsSalud' },
    },
    ...mockVisitWithAttributes.attributes,
  ],
} as unknown as Visit;

const mockSisVisitWithAttributes = {
  ...mockVisitWithAttributes,
  attributes: [
    {
      uuid: 'financiador-visit-attribute-uuid',
      attributeType: {
        uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
        display: 'Financiador',
      },
      value: { uuid: SIS_CONCEPT_UUID, display: 'SIS' },
    },
    ...mockVisitWithAttributes.attributes,
    {
      uuid: 'sis-status-visit-attribute-uuid',
      attributeType: {
        uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
        display: 'Estado de Acreditación SIS',
      },
      value: { uuid: sisAccreditationStatusConceptUuid, display: 'Vigente' },
    },
    {
      uuid: 'sis-checked-at-visit-attribute-uuid',
      attributeType: {
        uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
        display: 'Fecha de Acreditación SIS',
      },
      value: '2026-08-10',
    },
  ],
} as unknown as Visit;

const mockCloseWorkspace = vi.fn();
const mockPromptBeforeClosing = vi.fn();
const mockSetTitle = vi.fn();

const testProps = {
  openedFrom: 'test',
  patientUuid: mockPatient.id,
  closeWorkspace: mockCloseWorkspace,
  closeWorkspaceWithSavedChanges: mockCloseWorkspace,
  promptBeforeClosing: mockPromptBeforeClosing,
  showVisitEndDateTimeFields: false,
  setTitle: mockSetTitle,
  workspaceDescription: undefined as string | undefined,
  additionalVisitAttributes: undefined as Array<{ attributeType: string; value: string }> | undefined,
  requireActiveSisFinancing: undefined as boolean | undefined,
};

const mockSaveVisit = vi.mocked(saveVisit);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockNavigate = vi.mocked(navigate);
const mockUpdateVisit = vi.mocked(updateVisit);
const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockUseConfig = vi.mocked(useConfig<ChartConfig>);
const mockUseConnectivity = vi.mocked(useConnectivity);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseVisitAttributeType = vi.mocked(useVisitAttributeType);
const mockUseVisitTypes = vi.mocked(useVisitTypes);
const mockUsePatient = vi.mocked(usePatient);
const mockUseLocations = vi.mocked(useLocations);
const mockUseEmrConfiguration = vi.mocked(useEmrConfiguration);
const mockFhirPatient = mockPatient as unknown as fhir.Patient;

// from ./visit-form.resource
const mockOnVisitCreatedOrUpdatedCallback = vi.fn();
const mockUseVisitFormCallbacks = vi.mocked(useVisitFormCallbacks);
mockUseVisitFormCallbacks.mockReturnValue([
  new Map([['test-extension-id', { onVisitCreatedOrUpdated: mockOnVisitCreatedOrUpdatedCallback }]]), // visitFormCallbacks
  vi.fn(), // setVisitFormCallbacks
]);
const mockCreateVisitAttribute = vi.mocked(createVisitAttribute).mockResolvedValue({} as unknown as FetchResponse);
const mockUpdateVisitAttribute = vi.mocked(updateVisitAttribute).mockResolvedValue({} as unknown as FetchResponse);
const mockDeleteVisitAttribute = vi.mocked(deleteVisitAttribute).mockResolvedValue({} as unknown as FetchResponse);
const mockGetVisitAttributes = vi.mocked(getVisitAttributes);
const mockReconcileVisitCreation = vi.mocked(reconcileVisitCreation);
const mockCreateOfflineVisitForPatient = vi.mocked(createOfflineVisitForPatient);
const mockFetchFreshPatientVitalStatus = vi.mocked(fetchFreshPatientVitalStatus);
const mockSafeCopyFinanciadorToVisit = vi.mocked(safeCopyFinanciadorToVisit);
const mockUsePersonAttributesForVisitDefaults = vi.mocked(usePersonAttributesForVisitDefaults);
const mockUseVisitProvenanceAddressOptions = vi.mocked(useVisitProvenanceAddressOptions);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  createOfflineVisitForPatient: vi.fn(),
  fetchFreshPatientVitalStatus: vi.fn(),
  safeCopyFinanciadorToVisit: vi.fn(),
  useActivePatientEnrollment: vi.fn().mockReturnValue({
    activePatientEnrollment: [],
    isLoading: false,
  }),
}));

vi.mock('../hooks/useVisitAttributeType', async () => ({
  useVisitAttributeType: vi.fn((attributeUuid) => {
    if (attributeUuid === visitAttributes.financiador.uuid) {
      return {
        isLoading: false,
        error: null,
        data: visitAttributes.financiador,
      };
    }
    if (attributeUuid === visitAttributes.punctuality.uuid) {
      return {
        isLoading: false,
        error: null,
        data: visitAttributes.punctuality,
      };
    }
    if (attributeUuid === visitAttributes.insurancePolicyNumber.uuid) {
      return {
        isLoading: false,
        error: null,
        data: visitAttributes.insurancePolicyNumber,
      };
    }
    if (attributeUuid === visitAttributes.accreditationStatus.uuid) {
      return {
        isLoading: false,
        error: null,
        data: visitAttributes.accreditationStatus,
      };
    }
    if (attributeUuid === visitAttributes.accreditationCheckedAt.uuid) {
      return {
        isLoading: false,
        error: null,
        data: visitAttributes.accreditationCheckedAt,
      };
    }
    if (attributeUuid === visitAttributes.provenance.uuid) {
      return {
        isLoading: false,
        error: null,
        data: visitAttributes.provenance,
      };
    }
  }),
  useVisitAttributeTypes: vi.fn(() => ({
    isLoading: false,
    error: null,
    visitAttributeTypes: [
      visitAttributes.punctuality,
      visitAttributes.insurancePolicyNumber,
      visitAttributes.provenance,
    ],
  })),
  useConceptAnswersForVisitAttributeType: vi.fn((datatypeConfig) => {
    const answersByConfig = {
      'financiador-config': [
        { uuid: '97c6e901-7570-4ab8-a9c0-9cf2b0f5bc0c', display: 'SIS', links: [] },
        { uuid: 'f38b048f-ee8b-4244-b3eb-a47a34c38f04', display: 'EsSalud', links: [] },
        { uuid: 'cc72568e-d0d9-46a8-a618-91f0d679f518', display: 'Autofinanciamiento', links: [] },
      ],
      'accreditation-status-config': [{ uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2051', display: 'Vigente', links: [] }],
    };
    const defaultAnswers = [
      {
        uuid: '66cdc0a1-aa19-4676-af51-80f66d78d9eb',
        display: 'On time',
        links: [],
      },
      {
        uuid: '66cdc0a1-aa19-4676-af51-80f66d78d9ec',
        display: 'Late',
        links: [],
      },
    ];

    return {
      isLoading: false,
      error: null,
      answers: answersByConfig[datatypeConfig] ?? defaultAnswers,
    };
  }),
  useConceptDisplay: vi.fn(() => ({
    isLoading: false,
    error: null,
    display: undefined,
  })),
}));

vi.mock('../hooks/useEmrConfiguration', async () => ({
  useEmrConfiguration: vi.fn(() => ({})),
}));

vi.mock('../hooks/useDefaultFacilityLocation', async () => {
  const requireActual = await vi.importActual('../hooks/useDefaultFacilityLocation');

  return {
    ...requireActual,
    useDefaultLoginLocation: vi.fn(() => ({
      defaultFacility: null,
      isLoading: false,
    })),
  };
});

vi.mock('./visit-form.resource', async () => {
  const requireActual = await vi.importActual('./visit-form.resource');
  return {
    ...requireActual,
    useVisitFormCallbacks: vi.fn(),
    usePersonAttributesForVisitDefaults: vi.fn(),
    createVisitAttribute: vi.fn(),
    updateVisitAttribute: vi.fn(),
    deleteVisitAttribute: vi.fn(),
    getVisitAttributes: vi.fn(),
    reconcileVisitCreation: vi.fn(),
  };
});

vi.mock('./visit-provenance.resource', async () => {
  const requireActual = await vi.importActual('./visit-provenance.resource');
  return {
    ...requireActual,
    useVisitProvenanceAddressOptions: vi.fn(() => ({
      addresses: [],
      error: null,
      isLoading: false,
    })),
  };
});

mockSaveVisit.mockResolvedValue({
  status: 201,
  data: {
    uuid: visitUuid,
    visitType: {
      display: 'Facility Visit',
    },
  },
} as unknown as FetchResponse<Visit>);

describe('Visit form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVisitFormCallbacks.mockReturnValue([
      new Map([['test-extension-id', { onVisitCreatedOrUpdated: mockOnVisitCreatedOrUpdatedCallback }]]),
      vi.fn(),
    ]);
    mockCreateVisitAttribute.mockResolvedValue({} as unknown as FetchResponse);
    mockUpdateVisitAttribute.mockResolvedValue({} as unknown as FetchResponse);
    mockDeleteVisitAttribute.mockResolvedValue({} as unknown as FetchResponse);
    mockGetVisitAttributes.mockResolvedValue([]);
    mockReconcileVisitCreation.mockResolvedValue(null);
    mockSafeCopyFinanciadorToVisit.mockResolvedValue({
      ok: true,
      skipped: false,
      created: 0,
      updated: 0,
    });
    mockUseConnectivity.mockReturnValue(true);
    mockCreateOfflineVisitForPatient.mockResolvedValue({} as Awaited<
      ReturnType<typeof createOfflineVisitForPatient>
    >);
    mockFetchFreshPatientVitalStatus.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
    mockOnVisitCreatedOrUpdatedCallback.mockResolvedValue(undefined);
    mockUseSession.mockReturnValue({
      user: {
        privileges: [
          { display: 'app:home.admision' },
          ...copyFinanciadorToVisitPrivileges.map((display) => ({ display })),
        ],
      },
      sessionLocation: mockLocations.data.results[0],
    } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation(
      (privilege) =>
        typeof privilege === 'string' && (privilege === 'app:home.admision' || coverageCopyPrivileges.has(privilege)),
    );
    mockExtensionSlot.mockImplementation(({ children }): React.JSX.Element => {
      if (typeof children === 'function') {
        return (
          <>
            {children({
              id: 'test-extension-id',
              meta: {},
              moduleName: '@openmrs/esm-patient-chart-app',
              name: 'test-extension-name',
              config: {},
            } as AssignedExtension)}
          </>
        );
      }

      return <>{children ?? null}</>;
    });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      visitAttributeTypes: [
        {
          uuid: visitAttributes.punctuality.uuid,
          required: false,
          displayInThePatientBanner: true,
        },
        {
          uuid: visitAttributes.insurancePolicyNumber.uuid,
          required: false,
          displayInThePatientBanner: true,
        },
      ],
      defaultVisitAttributesFromPersonAttributes: [],
    });
    mockUsePatient.mockReturnValue({
      error: null,
      isLoading: false,
      patient: mockFhirPatient,
      patientUuid: mockPatient.id,
    });
    mockUseVisitTypes.mockReturnValue(mockVisitTypes);
    mockUseLocations.mockReturnValue(mockLocations.data.results);
    mockUseEmrConfiguration.mockReturnValue({
      emrConfiguration: {
        atFacilityVisitType: null,
      },
      isLoadingEmrConfiguration: false,
      errorFetchingEmrConfiguration: null,
      mutateEmrConfiguration: null,
    });
    mockUsePersonAttributesForVisitDefaults.mockReturnValue({
      attributes: [],
      error: null,
      isLoading: false,
    });
    mockUseVisitProvenanceAddressOptions.mockReturnValue({
      addresses: [],
      error: null,
      isLoading: false,
    });
  });

  it('renders the Start Visit form with all the relevant fields and values', async () => {
    const user = userEvent.setup();

    renderVisitForm();

    expect(screen.getByRole('textbox', { name: /Fecha/i })).toBeRequired();
    expect(screen.getByRole('textbox', { name: /Hora/i })).toBeRequired();
    expect(screen.getByRole('combobox', { name: /Time Format/i })).toBeRequired();
    expect(screen.getByRole('combobox', { name: /Select a UPSS/i })).toBeInTheDocument();
    const visitType = screen.getByRole('combobox', { name: /tipo de atención/i });
    expect(visitType).toBeInTheDocument();
    await user.click(visitType);
    expect(await screen.findByText(/HIV Return Visit/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^AM$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^PM$/i })).toBeInTheDocument();
    expect(screen.getByText(/Punctuality/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Start Visit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discard/i })).toBeInTheDocument();

    // Testing the location picker
    const combobox = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    expect(screen.getByText(/Outpatient Visit/i)).toBeInTheDocument();
    expect(combobox).toHaveDisplayValue('Mosoriot');
    expect(screen.getByRole('option', { name: /Mosoriot/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Inpatient Ward/i })).toBeInTheDocument();
  });

  it('shows contextual instructions when the form is opened from an appointment', () => {
    renderVisitForm(undefined, {
      workspaceDescription: 'Revise los datos y confirme el inicio de la atención.',
    });

    expect(screen.getByText(/Revise los datos de la atención|Review the care details/i)).toBeInTheDocument();
    expect(screen.getByText('Revise los datos y confirme el inicio de la atención.')).toBeInTheDocument();
  });

  it('shows payer-compatible fields and clears complements when the payer changes', async () => {
    const user = userEvent.setup();
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      visitAttributeTypes: [
        { uuid: visitAttributes.financiador.uuid, required: false, displayInThePatientBanner: false },
        { uuid: visitAttributes.insurancePolicyNumber.uuid, required: false, displayInThePatientBanner: false },
        { uuid: visitAttributes.accreditationStatus.uuid, required: false, displayInThePatientBanner: false },
      ],
      defaultVisitAttributesFromPersonAttributes: [],
    });

    renderVisitForm();

    const financiador = screen.getByRole('combobox', { name: 'Financiador (optional)' });
    expect(screen.queryByRole('textbox', { name: 'Insurance Policy Number (optional)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Estado de Acreditación SIS (optional)' })).not.toBeInTheDocument();

    await user.selectOptions(financiador, '97c6e901-7570-4ab8-a9c0-9cf2b0f5bc0c');
    const insuranceNumber = await screen.findByRole('textbox', { name: 'Insurance Policy Number (optional)' });
    const accreditationStatus = await screen.findByRole('combobox', {
      name: 'Estado de Acreditación SIS (optional)',
    });
    await user.type(insuranceNumber, 'SIS-900');
    await user.selectOptions(accreditationStatus, '9b3df0a1-0c58-4f55-9868-9c38f1db2051');

    await user.selectOptions(financiador, 'f38b048f-ee8b-4244-b3eb-a47a34c38f04');
    expect(await screen.findByRole('textbox', { name: 'Insurance Policy Number (optional)' })).toHaveValue('');
    expect(screen.queryByRole('combobox', { name: 'Estado de Acreditación SIS (optional)' })).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Insurance Policy Number (optional)' }), 'ESSALUD-10');
    await user.selectOptions(financiador, 'cc72568e-d0d9-46a8-a618-91f0d679f518');
    expect(screen.queryByRole('textbox', { name: 'Insurance Policy Number (optional)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Estado de Acreditación SIS (optional)' })).not.toBeInTheDocument();
  });

  it('keeps canonical coverage fields available after a generic visit-attribute override', () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      visitAttributeTypes: [],
      defaultVisitAttributesFromPersonAttributes: [],
    });

    renderVisitForm();

    expect(screen.getByRole('combobox', { name: 'Financiador (optional)' })).toBeInTheDocument();
  });

  it('registers the queue admission time internally when opened from service queues', async () => {
    const user = userEvent.setup();
    const beforeSubmission = new Date();
    mockUseVisitFormCallbacks.mockReturnValue([
      new Map([
        [
          'queue-extension',
          {
            kind: 'queue-entry',
            onBeforeVisitSave: () => true,
            onVisitCreatedOrUpdated: vi.fn().mockResolvedValue(undefined),
          },
        ],
      ]),
      vi.fn(),
    ]);

    renderVisitForm(undefined, { openedFrom: 'service-queues-add-patient' });

    expect(screen.queryByRole('textbox', { name: /Fecha/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Hora/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add patient to queue/i })).toBeInTheDocument();

    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Add patient to queue/i }));

    await waitFor(() => expect(mockSaveVisit).toHaveBeenCalledTimes(1));
    const payload = mockSaveVisit.mock.calls[0][0];
    expect(payload.startDatetime.getTime()).toBeGreaterThanOrEqual(beforeSubmission.getTime());
    expect(payload.startDatetime.getTime()).toBeLessThanOrEqual(Date.now());
    expect(showSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Visit started' }));
  });

  it('opens both companion flows configured by an embedding queue window', async () => {
    const user = userEvent.setup();
    const launchChildWorkspace = vi.fn().mockResolvedValue(undefined);
    mockUserHasAccess.mockImplementation(
      (privilege) =>
        typeof privilege === 'string' &&
        ['app:home.admision', 'Get People', 'Add People', 'app:opciones.registrarAcompanante'].includes(privilege),
    );
    mockUsePatient.mockReturnValue({
      error: null,
      isLoading: false,
      patient: {
        ...mockFhirPatient,
        birthDate: dayjs().subtract(1, 'year').format('YYYY-MM-DD'),
      },
      patientUuid: mockPatient.id,
    });

    render(
      React.createElement(StartVisitForm, {
        groupProps: { patientUuid: mockPatient.id },
        workspaceProps: {
          companionPersonRegistrationWorkspaceName: 'queue-companion-registration',
          companionPersonSearchWorkspaceName: 'queue-companion-search',
          openedFrom: 'service-queues-add-patient',
          patientUuid: mockPatient.id,
        },
        closeWorkspace: mockCloseWorkspace,
        launchChildWorkspace,
        promptBeforeClosing: mockPromptBeforeClosing,
      } as never),
    );

    await user.click(screen.getByRole('button', { name: /Seleccionar persona existente|Select existing person/i }));
    await user.click(screen.getByRole('button', { name: /Registrar nueva persona|Register new person/i }));

    expect(launchChildWorkspace).toHaveBeenNthCalledWith(1, 'queue-companion-search', {
      onCompanionSelected: expect.any(Function),
      patientUuid: mockPatient.id,
      requireAdult: true,
    });
    expect(launchChildWorkspace).toHaveBeenNthCalledWith(2, 'queue-companion-registration', {
      onCompanionSelected: expect.any(Function),
      patientUuid: mockPatient.id,
      requireAdult: true,
    });
  });

  it('does not expose companion registration without its dedicated frontend privilege', () => {
    mockUserHasAccess.mockImplementation(
      (privilege) =>
        typeof privilege === 'string' && ['app:home.admision', 'Get People', 'Add People'].includes(privilege),
    );

    render(
      React.createElement(StartVisitForm, {
        groupProps: { patientUuid: mockPatient.id },
        workspaceProps: {
          openedFrom: 'service-queues-add-patient',
          patientUuid: mockPatient.id,
        },
        closeWorkspace: mockCloseWorkspace,
        launchChildWorkspace: vi.fn(),
        promptBeforeClosing: mockPromptBeforeClosing,
      } as never),
    );

    expect(screen.getByRole('button', { name: /Seleccionar persona existente|Select existing person/i })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Registrar nueva persona|Register new person/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render the extra visit attributes slot by default', () => {
    renderVisitForm();

    expect(hasRenderedExtensionSlot('extra-visit-attribute-slot')).toBe(false);
  });

  it('does not render visit type combo box if atFacilityVisitType set', async () => {
    mockUseEmrConfiguration.mockReturnValue({
      emrConfiguration: {
        atFacilityVisitType: {
          uuid: 'some-uuid1',
        },
      },
      isLoadingEmrConfiguration: false,
      errorFetchingEmrConfiguration: null,
      mutateEmrConfiguration: null,
    });
    renderVisitForm();
    expect(screen.queryByRole('combobox', { name: /tipo de atención/i })).not.toBeInTheDocument();
  });

  it('renders a validation error when required fields are not filled', async () => {
    const user = userEvent.setup();

    renderVisitForm();

    const saveButton = screen.getByRole('button', { name: /start visit/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /select a UPSS/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');
    await user.click(saveButton);

    expect(screen.getByText(/missing visit type/i)).toBeInTheDocument();
    expect(screen.getByText(/select a care type/i)).toBeInTheDocument();

    await selectVisitType(user);
  });

  it('displays an error message when the visit start time is in the future', async () => {
    const user = userEvent.setup();

    renderVisitForm();

    const dateInput = screen.getByRole('textbox', { name: /fecha/i });
    const timeInput = screen.getByRole('textbox', { name: /hora/i });
    const amPmSelect = screen.getByRole('combobox', { name: /time format/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /select a UPSS/i,
    });
    const futureTime = dayjs().add(1, 'hour');

    fireEvent.change(dateInput, { target: { value: futureTime.format('DD/MM/YYYY') } });
    fireEvent.change(timeInput, { target: { value: futureTime.format('hh:mm') } });
    await user.selectOptions(amPmSelect, futureTime.format('A'));
    await user.selectOptions(locationPicker, 'Inpatient Ward');
    await selectVisitType(user);
    await user.click(screen.getByRole('button', { name: /start visit/i }));

    expect(await screen.findByText(/start time cannot be in the future/i)).toBeInTheDocument();
  });

  it('displays an error message when the visit start date is before the patient birth date', async () => {
    const user = userEvent.setup();

    renderVisitForm();

    const dateInput = screen.getByRole('textbox', { name: /fecha/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /select a UPSS/i,
    });
    const dateBeforeBirthDate = '02/04/1986';

    fireEvent.change(dateInput, { target: { value: dateBeforeBirthDate } });
    await user.selectOptions(locationPicker, 'Inpatient Ward');
    await selectVisitType(user);
    await user.click(screen.getByRole('button', { name: /start visit/i }));

    expect(await screen.findByText(/start date cannot be before the patient's birth date/i)).toBeInTheDocument();
    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it('shows a friendly error when AM/PM is missing from the visit start time', async () => {
    const user = userEvent.setup();

    renderVisitForm();

    const timeInput = screen.getByRole('textbox', { name: /hora/i });
    const amPmSelect = screen.getByRole('combobox', { name: /time format/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /select a UPSS/i,
    });

    fireEvent.change(timeInput, { target: { value: '0800' } });
    fireEvent.blur(timeInput);
    fireEvent.change(amPmSelect, { target: { value: '' } });
    await user.selectOptions(locationPicker, 'Inpatient Ward');
    await selectVisitType(user);
    await user.click(screen.getByRole('button', { name: /start visit/i }));

    expect(await screen.findByText(/select AM or PM/i)).toBeInTheDocument();
    expect(screen.queryByText(/invalid enum value/i)).not.toBeInTheDocument();
    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it('starts a new visit upon successful submission of the form', async () => {
    const user = userEvent.setup();

    renderVisitForm();

    const saveButton = screen.getByRole('button', { name: /Start visit/i });

    // Set visit type
    await selectVisitType(user);

    // Set location
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');

    await user.click(saveButton);

    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockSaveVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        location: mockLocations.data.results[1].uuid,
        patient: mockPatient.id,
        visitType: 'some-uuid1',
      }),
      expect.any(Object),
    );

    expect(showSnackbar).toHaveBeenCalledTimes(1);
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      subtitle: expect.stringContaining('started successfully'),
      kind: 'success',
      title: 'Visit started',
    });
  });

  it('fresh-checks patient-search visit creation and performs no write after a concurrent death', async () => {
    const user = userEvent.setup();
    const handleCreateExtraVisitInfo = vi.fn();
    mockFetchFreshPatientVitalStatus.mockResolvedValue({
      dead: true,
      deathDate: '2026-08-12T15:41:28.000Z',
      isDeceased: true,
    });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      showExtraVisitAttributesSlot: true,
      visitAttributeTypes: [],
      defaultVisitAttributesFromPersonAttributes: [],
    });
    mockExtensionSlot.mockImplementation(({ children, name, state }): React.JSX.Element => {
      if (name === 'extra-visit-attribute-slot') {
        return (
          <ExtraVisitSlotTestDouble
            attributes={[]}
            handleCreateExtraVisitInfo={handleCreateExtraVisitInfo}
            setExtraVisitInfo={
              (
                state as {
                  setExtraVisitInfo: (value: {
                    attributes: Array<{ attributeType: string; value: string }>;
                    handleCreateExtraVisitInfo?: () => Promise<void>;
                  }) => void;
                }
              ).setExtraVisitInfo
            }
          />
        );
      }
      return typeof children === 'function' ? <>{children({} as AssignedExtension)}</> : <>{children ?? null}</>;
    });

    renderVisitForm(undefined, { openedFrom: 'patient-search-start-visit' });
    await screen.findByTestId('extra-visit-attribute-slot');
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledWith(mockPatient.id));
    expect(handleCreateExtraVisitInfo).not.toHaveBeenCalled();
    expect(mockSaveVisit).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle: 'No se puede iniciar una consulta para un paciente fallecido.',
      }),
    );
  });

  it('fails closed before extra-info or visit writes when the fresh vital-status request fails', async () => {
    const user = userEvent.setup();
    const handleCreateExtraVisitInfo = vi.fn();
    mockFetchFreshPatientVitalStatus.mockRejectedValue(new TypeError('Failed to fetch'));
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      showExtraVisitAttributesSlot: true,
      visitAttributeTypes: [],
      defaultVisitAttributesFromPersonAttributes: [],
    });
    mockExtensionSlot.mockImplementation(({ children, name, state }): React.JSX.Element => {
      if (name === 'extra-visit-attribute-slot') {
        return (
          <ExtraVisitSlotTestDouble
            attributes={[]}
            handleCreateExtraVisitInfo={handleCreateExtraVisitInfo}
            setExtraVisitInfo={
              (
                state as {
                  setExtraVisitInfo: (value: {
                    attributes: Array<{ attributeType: string; value: string }>;
                    handleCreateExtraVisitInfo?: () => Promise<void>;
                  }) => void;
                }
              ).setExtraVisitInfo
            }
          />
        );
      }
      return typeof children === 'function' ? <>{children({} as AssignedExtension)}</> : <>{children ?? null}</>;
    });

    renderVisitForm();
    await screen.findByTestId('extra-visit-attribute-slot');
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledWith(mockPatient.id));
    expect(handleCreateExtraVisitInfo).not.toHaveBeenCalled();
    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it('re-checks after extra-info and does not create a visit when the patient dies during that write', async () => {
    const user = userEvent.setup();
    const handleCreateExtraVisitInfo = vi.fn().mockResolvedValue(undefined);
    mockFetchFreshPatientVitalStatus
      .mockResolvedValueOnce({ dead: false, deathDate: null, isDeceased: false })
      .mockResolvedValueOnce({
        dead: true,
        deathDate: '2026-08-12T15:41:28.000Z',
        isDeceased: true,
      });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      showExtraVisitAttributesSlot: true,
      visitAttributeTypes: [],
      defaultVisitAttributesFromPersonAttributes: [],
    });
    mockExtensionSlot.mockImplementation(({ children, name, state }): React.JSX.Element => {
      if (name === 'extra-visit-attribute-slot') {
        return (
          <ExtraVisitSlotTestDouble
            attributes={[]}
            handleCreateExtraVisitInfo={handleCreateExtraVisitInfo}
            setExtraVisitInfo={
              (
                state as {
                  setExtraVisitInfo: (value: {
                    attributes: Array<{ attributeType: string; value: string }>;
                    handleCreateExtraVisitInfo?: () => Promise<void>;
                  }) => void;
                }
              ).setExtraVisitInfo
            }
          />
        );
      }
      return typeof children === 'function' ? <>{children({} as AssignedExtension)}</> : <>{children ?? null}</>;
    });

    renderVisitForm();
    await screen.findByTestId('extra-visit-attribute-slot');
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledTimes(2));
    expect(handleCreateExtraVisitInfo).toHaveBeenCalledOnce();
    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it('keeps care moving and offers an idempotent coverage retry for the same visit', async () => {
    const user = userEvent.setup();
    const copyFailure = new Error('coverage write failed');
    mockSafeCopyFinanciadorToVisit.mockResolvedValueOnce({ ok: false, error: copyFailure });

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          actionButtonLabel: 'Reintentar cobertura',
          kind: 'warning',
          onActionButtonClick: expect.any(Function),
          title: 'Consulta iniciada; cobertura pendiente',
        }),
      ),
    );
    expect(mockCloseWorkspace).toHaveBeenCalled();
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        onlyFillMissing: true,
        patientUuid: mockPatient.id,
        visitUuid,
      }),
    );

    const warning = vi
      .mocked(showSnackbar)
      .mock.calls.map(([options]) => options)
      .find((options) => options.actionButtonLabel === 'Reintentar cobertura');
    await act(async () => warning?.onActionButtonClick?.());

    await waitFor(() => expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(2));
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        onlyFillMissing: true,
        patientUuid: mockPatient.id,
        visitUuid,
      }),
    );
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'success',
        title: 'Cobertura registrada en la consulta',
      }),
    );
  });

  it('creates the visit but hands coverage off without a dead retry when REST privileges are missing', async () => {
    const user = userEvent.setup();
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'app:home.admision');

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'warning',
          title: 'Consulta iniciada; cobertura requiere apoyo',
        }),
      ),
    );
    const handoffWarning = vi
      .mocked(showSnackbar)
      .mock.calls.map(([options]) => options)
      .find((options) => options.title === 'Consulta iniciada; cobertura requiere apoyo');
    expect(handoffWarning).not.toHaveProperty('actionButtonLabel');
    expect(handoffWarning).not.toHaveProperty('onActionButtonClick');
    expect(mockSafeCopyFinanciadorToVisit).not.toHaveBeenCalled();
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockCloseWorkspace).toHaveBeenCalled();
  });

  it('does not require copy privileges when complete coverage was captured in the visit payload', async () => {
    const user = userEvent.setup();
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'app:home.admision');

    renderVisitForm(undefined, {
      additionalVisitAttributes: [
        { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SELF_FINANCED_CONCEPT_UUID },
      ],
    });
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSaveVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.arrayContaining([
          { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SELF_FINANCED_CONCEPT_UUID },
        ]),
      }),
      expect.any(Object),
    );
    expect(mockSafeCopyFinanciadorToVisit).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Consulta iniciada; cobertura requiere apoyo' }),
    );
  });

  it('uses an active SIS payload as the triage fast path without recopying coverage', async () => {
    const user = userEvent.setup();

    renderVisitForm(undefined, {
      requireActiveSisFinancing: true,
      additionalVisitAttributes: [
        { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SIS_CONCEPT_UUID },
        { attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, value: 'SIS-123' },
        { attributeType: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID, value: sisAccreditationStatusConceptUuid },
        { attributeType: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID, value: '2026-08-12' },
      ],
    });
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockSafeCopyFinanciadorToVisit).not.toHaveBeenCalled();
    expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(1);
  });

  it('does not use self-financing as an active SIS triage fast path', async () => {
    const user = userEvent.setup();
    mockSafeCopyFinanciadorToVisit.mockResolvedValueOnce({
      ok: true,
      skipped: false,
      created: 0,
      updated: 0,
      reviewReason: 'incomplete-coverage',
    });
    mockOnVisitCreatedOrUpdatedCallback.mockRejectedValueOnce(
      Object.assign(new Error('The visit does not have active SIS financing.'), {
        code: 'TRIAGE_SIS_FINANCING_REQUIRED',
      }),
    );

    renderVisitForm(undefined, {
      requireActiveSisFinancing: true,
      additionalVisitAttributes: [
        { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SELF_FINANCED_CONCEPT_UUID },
      ],
    });
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1));
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledWith(
      expect.objectContaining({ onlyFillMissing: false, patientUuid: mockPatient.id, visitUuid }),
    );
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(1);
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
  });

  it('does not treat an unknown SIS payload as complete in a non-triage flow', async () => {
    const user = userEvent.setup();
    mockSafeCopyFinanciadorToVisit.mockResolvedValueOnce({
      ok: true,
      skipped: false,
      created: 0,
      updated: 0,
      reviewReason: 'unknown-accreditation-status',
    });

    renderVisitForm(undefined, {
      additionalVisitAttributes: [
        { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SIS_CONCEPT_UUID },
        { attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, value: 'SIS-123' },
        {
          attributeType: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
          value: 'unknown-sis-accreditation-status',
        },
        { attributeType: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID, value: '2026-08-12' },
      ],
    });
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1));
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledWith(
      expect.objectContaining({ onlyFillMissing: true, patientUuid: mockPatient.id, visitUuid }),
    );
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', title: 'Estado de acreditación SIS no reconocido' }),
    );
    expect(showSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Cobertura registrada en la consulta' }),
    );
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
  });

  it('treats a backend authorization denial as deterministic even if the session advertised the privileges', async () => {
    const user = userEvent.setup();
    mockSafeCopyFinanciadorToVisit.mockResolvedValueOnce({
      ok: false,
      error: Object.assign(new Error('Forbidden'), { response: { status: 403 } }),
    });

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Consulta iniciada; cobertura requiere apoyo' }),
      ),
    );
    const handoffWarning = vi
      .mocked(showSnackbar)
      .mock.calls.map(([options]) => options)
      .find((options) => options.title === 'Consulta iniciada; cobertura requiere apoyo');
    expect(handoffWarning).not.toHaveProperty('actionButtonLabel');
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1);
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
  });

  it('does not delay visit callbacks while the coverage request is pending', async () => {
    const user = userEvent.setup();
    let resolveCoverage: (result: { ok: true; skipped: false; created: number; updated: number }) => void = () => {};
    mockSafeCopyFinanciadorToVisit.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCoverage = resolve;
      }),
    );

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1);
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);

    await act(async () => resolveCoverage({ ok: true, skipped: false, created: 1, updated: 0 }));
  });

  it('waits for coverage before visit callbacks when active SIS financing is required', async () => {
    const user = userEvent.setup();
    let resolveCoverage: (result: { ok: true; skipped: false; created: number; updated: number }) => void = () => {};
    mockSafeCopyFinanciadorToVisit.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCoverage = resolve;
      }),
    );

    renderVisitForm(undefined, { requireActiveSisFinancing: true });
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1));
    expect(mockOnVisitCreatedOrUpdatedCallback).not.toHaveBeenCalled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();

    await act(async () => resolveCoverage({ ok: true, skipped: false, created: 1, updated: 0 }));

    await waitFor(() => expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalledTimes(1));
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
  });

  it('retries pending coverage during a main-form retry without posting a second visit', async () => {
    const user = userEvent.setup();
    mockSafeCopyFinanciadorToVisit
      .mockResolvedValueOnce({ ok: false, error: new Error('coverage write failed') })
      .mockResolvedValueOnce({ ok: true, skipped: false, created: 1, updated: 0 });
    mockOnVisitCreatedOrUpdatedCallback
      .mockRejectedValueOnce(new Error('later callback failed'))
      .mockResolvedValueOnce(undefined);

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    await waitFor(() => expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1));
    expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(1);
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);

    await user.click(retryButton);

    await waitFor(() => expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ patientUuid: mockPatient.id, visitUuid }),
    );
  });

  it.each([
    [
      'missing financer',
      {
        ok: true,
        skipped: true,
        created: 0,
        updated: 0,
        reviewReason: 'missing-financiador',
      },
    ],
    [
      'incomplete SIS bundle',
      {
        ok: true,
        skipped: false,
        created: 1,
        updated: 0,
        reviewReason: 'incomplete-coverage',
      },
    ],
  ] as const)('retries %s after the affiliation is corrected without posting a second visit', async (_case, result) => {
    const user = userEvent.setup();
    mockSafeCopyFinanciadorToVisit
      .mockResolvedValueOnce(result)
      .mockResolvedValueOnce({ ok: true, skipped: false, created: 1, updated: 0 });
    mockOnVisitCreatedOrUpdatedCallback
      .mockRejectedValueOnce(
        Object.assign(new Error('The visit does not have active SIS financing.'), {
          code: 'TRIAGE_SIS_FINANCING_REQUIRED',
        }),
      )
      .mockResolvedValueOnce(undefined);

    renderVisitForm(undefined, { requireActiveSisFinancing: true });
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1);
    expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(1);
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);

    // A concurrent Admissions correction changes the next copy result. The
    // retry must propagate that corrected affiliation onto the same visit.
    await user.click(retryButton);

    await waitFor(() => expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ patientUuid: mockPatient.id, visitUuid }),
    );
  });

  it.each([
    {
      caseName: 'pending',
      statusUuid: SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
      firstCopyResult: { ok: true, skipped: false, created: 0, updated: 0 } as const,
    },
    {
      caseName: 'inactive',
      statusUuid: SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
      firstCopyResult: { ok: true, skipped: false, created: 0, updated: 0 } as const,
    },
    {
      caseName: 'not consulted',
      statusUuid: SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID,
      firstCopyResult: { ok: true, skipped: false, created: 0, updated: 0 } as const,
    },
    {
      caseName: 'unknown',
      statusUuid: 'unknown-sis-accreditation-status',
      firstCopyResult: {
        ok: true,
        skipped: false,
        created: 0,
        updated: 0,
        reviewReason: 'unknown-accreditation-status',
      } as const,
    },
  ])('recopies a $caseName SIS payload after correction to active and retries without recreating the visit', async ({
    statusUuid,
    firstCopyResult,
  }) => {
    const user = userEvent.setup();
    mockSafeCopyFinanciadorToVisit
      .mockResolvedValueOnce(firstCopyResult)
      .mockResolvedValueOnce({ ok: true, skipped: false, created: 0, updated: 1 });
    mockOnVisitCreatedOrUpdatedCallback
      .mockRejectedValueOnce(
        Object.assign(new Error('The visit does not have active SIS financing.'), {
          code: 'TRIAGE_SIS_FINANCING_REQUIRED',
        }),
      )
      .mockResolvedValueOnce(undefined);
    mockUseVisitFormCallbacks.mockReturnValue([
      new Map([
        [
          'queue-entry-extension-id',
          { kind: 'queue-entry', onVisitCreatedOrUpdated: mockOnVisitCreatedOrUpdatedCallback },
        ],
      ]),
      vi.fn(),
    ]);

    renderVisitForm(undefined, {
      requireActiveSisFinancing: true,
      additionalVisitAttributes: [
        { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SIS_CONCEPT_UUID },
        { attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, value: 'SIS-123' },
        { attributeType: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID, value: statusUuid },
        { attributeType: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID, value: '2026-08-12' },
      ],
    });
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1);
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        onlyFillMissing: false,
        patientUuid: mockPatient.id,
        visitUuid,
      }),
    );
    expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(1);
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);

    // Admissions corrects the person's SIS accreditation to active. The retry
    // must refresh coverage on the persisted visit before attempting the queue again.
    await user.click(retryButton);

    await waitFor(() => expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(2));
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        onlyFillMissing: false,
        patientUuid: mockPatient.id,
        visitUuid,
      }),
    );
    await waitFor(() => expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
  });

  it('keeps missing coverage visible instead of reporting a false repair', async () => {
    const user = userEvent.setup();
    mockUserHasAccess.mockImplementation(
      (privilege) =>
        typeof privilege === 'string' &&
        (['app:home.admision', 'app:opciones.registrarPaciente'].includes(privilege) ||
          coverageCopyPrivileges.has(privilege)),
    );
    mockSafeCopyFinanciadorToVisit.mockResolvedValue({
      ok: true,
      skipped: true,
      created: 0,
      updated: 0,
      reviewReason: 'missing-financiador',
    });

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          actionButtonLabel: 'Revisar cobertura',
          kind: 'warning',
          title: 'Consulta iniciada sin financiador',
        }),
      ),
    );
    const missingCoverageWarning = vi
      .mocked(showSnackbar)
      .mock.calls.map(([options]) => options)
      .find((options) => options.title === 'Consulta iniciada sin financiador');
    await act(async () => missingCoverageWarning?.onActionButtonClick?.());
    expect(mockNavigate).toHaveBeenCalledWith({
      to: expect.stringContaining(`/patient/${mockPatient.id}/edit?focusSection=insurance&afterUrl=`),
    });
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1);
    expect(showSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Cobertura registrada en la consulta' }),
    );
    expect(mockCloseWorkspace).toHaveBeenCalled();
  });

  it('reports incomplete coverage without blocking the visit or claiming success', async () => {
    const user = userEvent.setup();
    mockUserHasAccess.mockImplementation(
      (privilege) =>
        typeof privilege === 'string' &&
        (['app:home.admision', 'app:opciones.registrarPaciente'].includes(privilege) ||
          coverageCopyPrivileges.has(privilege)),
    );
    mockSafeCopyFinanciadorToVisit.mockResolvedValue({
      ok: true,
      skipped: false,
      created: 2,
      updated: 0,
      reviewReason: 'incomplete-coverage',
    });

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          actionButtonLabel: 'Revisar cobertura',
          kind: 'warning',
          title: 'Cobertura incompleta en la consulta',
        }),
      ),
    );
    expect(showSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Cobertura registrada en la consulta' }),
    );
    expect(mockCloseWorkspace).toHaveBeenCalled();
  });

  it('reports an unknown SIS accreditation status without claiming that the financer is missing', async () => {
    const user = userEvent.setup();
    mockUserHasAccess.mockImplementation(
      (privilege) =>
        typeof privilege === 'string' &&
        (['app:home.admision', 'app:opciones.registrarPaciente'].includes(privilege) ||
          coverageCopyPrivileges.has(privilege)),
    );
    mockSafeCopyFinanciadorToVisit.mockResolvedValue({
      ok: true,
      skipped: false,
      created: 4,
      updated: 0,
      reviewReason: 'unknown-accreditation-status',
    });

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          actionButtonLabel: 'Revisar cobertura',
          kind: 'warning',
          title: 'Estado de acreditación SIS no reconocido',
        }),
      ),
    );
    expect(showSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Consulta iniciada sin financiador' }),
    );
    expect(mockCloseWorkspace).toHaveBeenCalled();
  });

  it('does not offer a dead coverage action when the user cannot edit patient insurance', async () => {
    const user = userEvent.setup();
    mockSafeCopyFinanciadorToVisit.mockResolvedValue({
      ok: true,
      skipped: false,
      created: 0,
      updated: 0,
      reviewReason: 'sis-accreditation-conflict',
    });

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'warning',
          title: 'La acreditación SIS requiere revisión',
        }),
      ),
    );
    const conflictWarning = vi
      .mocked(showSnackbar)
      .mock.calls.map(([options]) => options)
      .find((options) => options.title === 'La acreditación SIS requiere revisión');
    expect(conflictWarning).not.toHaveProperty('actionButtonLabel');
    expect(conflictWarning).not.toHaveProperty('onActionButtonClick');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1);
  });

  it('keeps the workspace protected while post-save callbacks are pending', async () => {
    const user = userEvent.setup();
    let resolveCallback = () => {};
    const pendingCallback = new Promise<void>((resolve) => {
      resolveCallback = resolve;
    });
    mockOnVisitCreatedOrUpdatedCallback.mockReturnValueOnce(pendingCallback);

    renderVisitForm();

    await selectVisitType(user);
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockSaveVisit).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const lastPromptPredicate = mockPromptBeforeClosing.mock.lastCall?.[0] as (() => boolean) | undefined;
      expect(lastPromptPredicate?.()).toBe(true);
    });

    await act(async () => resolveCallback());
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
  });

  it('does not create an appointment check-in visit when the queue callback is unavailable', async () => {
    const user = userEvent.setup();
    mockUseVisitFormCallbacks.mockReturnValueOnce([new Map(), vi.fn()]);
    render(React.createElement(StartVisitForm, { ...testProps, openedFrom: 'appointments-check-in' }));

    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    expect(mockSaveVisit).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        title: 'No se puede registrar la cola',
      }),
    );
  });

  it('fails closed when appointment admission is attempted offline', async () => {
    const user = userEvent.setup();
    const queuePreSave = vi.fn().mockReturnValue(true);
    const queueCallback = vi.fn();
    mockUseConnectivity.mockReturnValue(false);
    mockUseVisitFormCallbacks.mockReturnValue([
      new Map([
        [
          'queue-extension',
          {
            kind: 'queue-entry',
            onBeforeVisitSave: queuePreSave,
            onVisitCreatedOrUpdated: queueCallback,
          },
        ],
      ]),
      vi.fn(),
    ]);
    render(React.createElement(StartVisitForm, { ...testProps, openedFrom: 'appointments-check-in' }));

    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    expect(mockSaveVisit).not.toHaveBeenCalled();
    expect(queuePreSave).not.toHaveBeenCalled();
    expect(queueCallback).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        title: 'No se puede registrar la atención sin conexión',
      }),
    );
  });

  it('preserves offline visit creation for a patient not known to be deceased', async () => {
    const user = userEvent.setup();
    mockUseConnectivity.mockReturnValue(false);
    renderVisitForm();

    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockCreateOfflineVisitForPatient).toHaveBeenCalledOnce());
    expect(mockFetchFreshPatientVitalStatus).not.toHaveBeenCalled();
  });

  it('does not queue an offline visit when the cached patient is already known to be deceased', async () => {
    const user = userEvent.setup();
    mockUseConnectivity.mockReturnValue(false);
    mockUsePatient.mockReturnValue({
      error: null,
      isLoading: false,
      patient: {
        ...mockFhirPatient,
        deceasedBoolean: true,
        deceasedDateTime: '2026-08-12T15:41:28.000Z',
      },
      patientUuid: mockPatient.id,
    });
    renderVisitForm();

    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    expect(mockCreateOfflineVisitForPatient).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle: 'No se puede iniciar una consulta para un paciente fallecido.',
      }),
    );
  });

  it('continues admission with the uniquely correlated visit when the create response is lost', async () => {
    const user = userEvent.setup();
    const correlation = {
      attributeType: 'appointment-visit-attribute-type',
      value: 'appointment-uuid',
    };
    const requiredVisitLocation = {
      uuid: mockLocations.data.results[1].uuid,
      display: mockLocations.data.results[1].display ?? 'Inpatient Ward',
    };
    const recoveredVisit = {
      uuid: 'recovered-visit-uuid',
      patient: { uuid: mockPatient.id },
      location: requiredVisitLocation,
      visitType: { uuid: 'some-uuid2', display: 'HIV Return Visit' },
      startDatetime: new Date().toISOString(),
      stopDatetime: null,
      attributes: [
        {
          attributeType: { uuid: correlation.attributeType },
          value: correlation.value,
        },
      ],
    } as unknown as Visit;
    const queueCallback = vi.fn().mockResolvedValue(undefined);
    const appointmentCallback = vi.fn().mockResolvedValue(undefined);
    mockSaveVisit.mockRejectedValueOnce(new Error('connection closed after commit'));
    mockReconcileVisitCreation.mockResolvedValueOnce(recoveredVisit);
    mockUseVisitFormCallbacks.mockReturnValue([
      new Map([
        [
          'queue-extension',
          {
            kind: 'queue-entry',
            onBeforeVisitSave: () => true,
            onVisitCreatedOrUpdated: queueCallback,
          },
        ],
      ]),
      vi.fn(),
    ]);
    render(
      React.createElement(StartVisitForm, {
        ...testProps,
        additionalVisitAttributes: [correlation],
        openedFrom: 'appointments-check-in',
        onVisitStarted: appointmentCallback,
        requiredVisitLocation,
        requiredVisitTypeUuid: 'some-uuid2',
        visitPersistenceCorrelation: correlation,
      }),
    );

    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockReconcileVisitCreation).toHaveBeenCalledWith(
      mockPatient.id,
      expect.objectContaining({
        attributes: [correlation],
        location: requiredVisitLocation.uuid,
        visitType: 'some-uuid2',
      }),
      correlation,
    );
    expect(queueCallback).toHaveBeenCalledWith(recoveredVisit);
    expect(appointmentCallback).toHaveBeenCalledWith(recoveredVisit);
  });

  it('reconciles an unknown create result before retrying and never posts a second visit', async () => {
    const user = userEvent.setup();
    const correlation = {
      attributeType: 'appointment-visit-attribute-type',
      value: 'appointment-uuid',
    };
    const requiredVisitLocation = {
      uuid: mockLocations.data.results[1].uuid,
      display: mockLocations.data.results[1].display ?? 'Inpatient Ward',
    };
    const recoveredVisit = {
      uuid: 'recovered-after-retry',
      patient: { uuid: mockPatient.id },
      location: requiredVisitLocation,
      visitType: { uuid: 'some-uuid2', display: 'HIV Return Visit' },
      startDatetime: new Date().toISOString(),
      stopDatetime: null,
      attributes: [],
    } as unknown as Visit;
    const queueCallback = vi.fn().mockResolvedValue(undefined);
    mockSaveVisit.mockRejectedValueOnce(new Error('connection closed after commit'));
    mockReconcileVisitCreation.mockResolvedValueOnce(null).mockResolvedValueOnce(recoveredVisit);
    mockUseVisitFormCallbacks.mockReturnValue([
      new Map([
        [
          'queue-extension',
          {
            kind: 'queue-entry',
            onBeforeVisitSave: () => true,
            onVisitCreatedOrUpdated: queueCallback,
          },
        ],
      ]),
      vi.fn(),
    ]);
    render(
      React.createElement(StartVisitForm, {
        ...testProps,
        additionalVisitAttributes: [correlation],
        openedFrom: 'appointments-check-in',
        requiredVisitLocation,
        requiredVisitTypeUuid: 'some-uuid2',
        visitPersistenceCorrelation: correlation,
      }),
    );

    await user.click(screen.getByRole('button', { name: /Start visit/i }));
    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    expect(screen.queryByRole('combobox', { name: /Select a UPSS/i })).not.toBeInTheDocument();
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);

    await user.click(retryButton);

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockReconcileVisitCreation).toHaveBeenCalledTimes(2);
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(queueCallback).toHaveBeenCalledWith(recoveredVisit);
  });

  it('keeps reconciling an unknown create result without posting again when the visit is still not visible', async () => {
    const user = userEvent.setup();
    const correlation = {
      attributeType: 'appointment-visit-attribute-type',
      value: 'appointment-uuid',
    };
    const requiredVisitLocation = {
      uuid: mockLocations.data.results[1].uuid,
      display: mockLocations.data.results[1].display ?? 'Inpatient Ward',
    };
    mockSaveVisit.mockRejectedValueOnce(Object.assign(new Error('request timed out'), { status: 408 }));
    mockReconcileVisitCreation.mockResolvedValue(null);
    mockUseVisitFormCallbacks.mockReturnValue([
      new Map([
        [
          'queue-extension',
          {
            kind: 'queue-entry',
            onBeforeVisitSave: () => true,
            onVisitCreatedOrUpdated: vi.fn().mockResolvedValue(undefined),
          },
        ],
      ]),
      vi.fn(),
    ]);
    render(
      React.createElement(StartVisitForm, {
        ...testProps,
        additionalVisitAttributes: [correlation],
        openedFrom: 'appointments-check-in',
        requiredVisitLocation,
        requiredVisitTypeUuid: 'some-uuid2',
        visitPersistenceCorrelation: correlation,
      }),
    );

    await user.click(screen.getByRole('button', { name: /Start visit/i }));
    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);

    await user.click(retryButton);

    await waitFor(() => expect(mockReconcileVisitCreation).toHaveBeenCalledTimes(2));
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Reintentar registro|Retry registration/i })).toBeInTheDocument();
    expect(mockPromptBeforeClosing.mock.calls.at(-1)?.[0]()).toBe(true);
  });

  it('uses a stable technical token to reconcile an ambiguous service queue visit creation', async () => {
    const user = userEvent.setup();
    const tokenAttributeType = 'visit-persistence-token-type';
    const requiredVisitLocation = {
      uuid: mockLocations.data.results[1].uuid,
      display: mockLocations.data.results[1].display ?? 'Inpatient Ward',
    };
    const recoveredVisit = {
      uuid: 'queue-recovered-visit',
      patient: { uuid: mockPatient.id },
      location: requiredVisitLocation,
      visitType: { uuid: 'some-uuid2', display: 'HIV Return Visit' },
      startDatetime: new Date().toISOString(),
      stopDatetime: null,
      attributes: [],
    } as unknown as Visit;
    const queueCallback = vi.fn().mockResolvedValue(undefined);
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      visitAttributeTypes: [],
      visitPersistenceTokenAttributeTypeUuid: tokenAttributeType,
    });
    mockSaveVisit.mockRejectedValueOnce(new Error('connection closed after commit'));
    mockReconcileVisitCreation.mockResolvedValueOnce(recoveredVisit);
    mockUseVisitFormCallbacks.mockReturnValue([
      new Map([
        [
          'queue-extension',
          {
            kind: 'queue-entry',
            onBeforeVisitSave: () => true,
            onVisitCreatedOrUpdated: queueCallback,
          },
        ],
      ]),
      vi.fn(),
    ]);
    render(
      React.createElement(StartVisitForm, {
        ...testProps,
        openedFrom: 'service-queues-add-patient',
        requiredVisitLocation,
        requiredVisitTypeUuid: 'some-uuid2',
      }),
    );

    await user.click(screen.getByRole('button', { name: /Add patient to queue/i }));

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    const savedPayload = mockSaveVisit.mock.calls[0][0];
    const token = savedPayload.attributes?.find((attribute) => attribute.attributeType === tokenAttributeType);
    expect(token).toEqual({
      attributeType: tokenAttributeType,
      value: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(mockReconcileVisitCreation).toHaveBeenCalledWith(mockPatient.id, savedPayload, token);
    expect(queueCallback).toHaveBeenCalledWith(recoveredVisit);
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
  });

  it('locks the queue selection and retries a failed queue callback without creating another visit', async () => {
    const user = userEvent.setup();
    let selectedQueueLocation = 'queue-location-a';
    let selectedQueue = 'queue-a';
    const attemptedQueueSelections: Array<{ location: string; queue: string }> = [];
    const queueCallback = vi.fn().mockImplementation(() => {
      attemptedQueueSelections.push({ location: selectedQueueLocation, queue: selectedQueue });
      return attemptedQueueSelections.length === 1
        ? Promise.reject(new Error('queue write failed'))
        : Promise.resolve(undefined);
    });
    const appointmentCallback = vi.fn().mockResolvedValue(undefined);
    mockExtensionSlot.mockImplementation(({ children, name }): React.JSX.Element => {
      if (name === 'visit-form-bottom-slot') {
        return (
          <>
            <label htmlFor="test-queue-location">Queue location</label>
            <select
              defaultValue={selectedQueueLocation}
              id="test-queue-location"
              onChange={(event) => {
                selectedQueueLocation = event.target.value;
              }}
            >
              <option value="queue-location-a">Queue location A</option>
              <option value="queue-location-b">Queue location B</option>
            </select>
            <label htmlFor="test-queue">Queue service</label>
            <select
              defaultValue={selectedQueue}
              id="test-queue"
              onChange={(event) => {
                selectedQueue = event.target.value;
              }}
            >
              <option value="queue-a">Queue A</option>
              <option value="queue-b">Queue B</option>
            </select>
          </>
        );
      }

      if (typeof children === 'function') {
        return (
          <>
            {children({
              id: 'test-extension-id',
              meta: {},
              moduleName: '@openmrs/esm-patient-chart-app',
              name: 'test-extension-name',
              config: {},
            } as AssignedExtension)}
          </>
        );
      }

      return <>{children ?? null}</>;
    });
    mockUseVisitFormCallbacks.mockReturnValue([
      new Map([
        [
          'queue-extension',
          {
            kind: 'queue-entry',
            onBeforeVisitSave: () => true,
            onVisitCreatedOrUpdated: queueCallback,
          },
        ],
      ]),
      vi.fn(),
    ]);
    render(
      React.createElement(StartVisitForm, {
        ...testProps,
        openedFrom: 'appointments-check-in',
        onVisitStarted: appointmentCallback,
      }),
    );

    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    const queueLocationPicker = screen.getByRole('combobox', { name: 'Queue location' });
    const queuePicker = screen.getByRole('combobox', { name: 'Queue service' });
    expect(screen.getByRole('combobox', { name: /Select a UPSS/i })).toBeDisabled();
    expect(queueLocationPicker).toBeDisabled();
    expect(queuePicker).toBeDisabled();
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(queueCallback).toHaveBeenCalledTimes(1);
    expect(appointmentCallback).not.toHaveBeenCalled();

    await user.selectOptions(queueLocationPicker, 'queue-location-b');
    await user.selectOptions(queuePicker, 'queue-b');
    expect(queueLocationPicker).toHaveValue('queue-location-a');
    expect(queuePicker).toHaveValue('queue-a');

    await user.click(retryButton);
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());

    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(queueCallback).toHaveBeenCalledTimes(2);
    expect(attemptedQueueSelections).toEqual([
      { location: 'queue-location-a', queue: 'queue-a' },
      { location: 'queue-location-a', queue: 'queue-a' },
    ]);
    expect(appointmentCallback).toHaveBeenCalledTimes(1);
    expect(queueCallback.mock.invocationCallOrder[1]).toBeLessThan(appointmentCallback.mock.invocationCallOrder[0]);
  });

  it('does not revalidate or rewrite a persisted queue entry when a later appointment callback is retried', async () => {
    const user = userEvent.setup();
    const queuePreSave = vi.fn().mockReturnValue(true);
    const queueCallback = vi.fn().mockResolvedValue(undefined);
    const appointmentCallback = vi
      .fn()
      .mockRejectedValueOnce(new Error('appointment status write failed'))
      .mockResolvedValueOnce(undefined);
    mockUseVisitFormCallbacks.mockReturnValue([
      new Map([
        [
          'queue-extension',
          {
            kind: 'queue-entry',
            onBeforeVisitSave: queuePreSave,
            onVisitCreatedOrUpdated: queueCallback,
          },
        ],
      ]),
      vi.fn(),
    ]);
    render(
      React.createElement(StartVisitForm, {
        ...testProps,
        openedFrom: 'appointments-check-in',
        onVisitStarted: appointmentCallback,
      }),
    );

    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(queuePreSave).toHaveBeenCalledTimes(1);
    expect(queueCallback).toHaveBeenCalledTimes(1);
    expect(appointmentCallback).toHaveBeenCalledTimes(1);

    queuePreSave.mockReturnValue(false);
    await user.click(retryButton);
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());

    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(queuePreSave).toHaveBeenCalledTimes(1);
    expect(queueCallback).toHaveBeenCalledTimes(1);
    expect(appointmentCallback).toHaveBeenCalledTimes(2);
  });

  it('persists the appointment-mapped visit location and type without allowing them to be changed', async () => {
    const user = userEvent.setup();
    const requiredVisitLocation = {
      uuid: mockLocations.data.results[1].uuid,
      display: mockLocations.data.results[1].display ?? 'Inpatient Ward',
    };

    render(
      React.createElement(StartVisitForm, {
        ...testProps,
        requiredVisitLocation,
        requiredVisitTypeUuid: 'some-uuid2',
      }),
    );

    expect(screen.queryByRole('combobox', { name: /Select a UPSS/i })).not.toBeInTheDocument();
    expect(screen.getByText(requiredVisitLocation.display)).toBeInTheDocument();
    expect(screen.getByText('HIV Return Visit')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    expect(mockSaveVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        location: requiredVisitLocation.uuid,
        patient: mockPatient.id,
        visitType: 'some-uuid2',
      }),
      expect.any(Object),
    );
  });

  it('starts a new visit with attributes upon successful submission of the form', async () => {
    const user = userEvent.setup();

    renderVisitForm();

    const saveButton = screen.getByRole('button', { name: /Start visit/i });

    // Set visit type
    await selectVisitType(user);

    // Set location
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');

    const punctualityPicker = screen.getByRole('combobox', {
      name: 'Punctuality (optional)',
    });
    await user.selectOptions(punctualityPicker, 'On time');
    await selectEssaludPayer(user);

    const insuranceNumberInput = screen.getByRole('textbox', {
      name: 'Insurance Policy Number (optional)',
    });
    await user.clear(insuranceNumberInput);
    await user.type(insuranceNumberInput, '183299');

    await user.click(saveButton);

    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockSaveVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.arrayContaining([
          {
            attributeType: visitAttributes.punctuality.uuid,
            value: '66cdc0a1-aa19-4676-af51-80f66d78d9eb',
          },
          {
            attributeType: visitAttributes.insurancePolicyNumber.uuid,
            value: '183299',
          },
        ]),
        location: mockLocations.data.results[1].uuid,
        patient: mockPatient.id,
        visitType: 'some-uuid1',
      }),
      expect.any(Object),
    );

    expect(mockCreateVisitAttribute).not.toHaveBeenCalled();

    expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalled();

    expect(mockCloseWorkspace).toHaveBeenCalled();

    expect(showSnackbar).toHaveBeenCalledTimes(1);
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      subtitle: expect.stringContaining('started successfully'),
      kind: 'success',
      title: 'Visit started',
    });
  });

  it('submits extra visit attributes when the extra visit attributes slot is enabled', async () => {
    const user = userEvent.setup();
    const extraVisitAttribute = {
      attributeType: 'payment-details-attribute-type-uuid',
      value: 'paying-concept-uuid',
    };

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      showExtraVisitAttributesSlot: true,
      visitAttributeTypes: [],
      defaultVisitAttributesFromPersonAttributes: [],
    });
    mockExtensionSlot.mockImplementation(({ children, name, state }): React.JSX.Element => {
      if (name === 'extra-visit-attribute-slot') {
        const extraVisitSlotState = state as {
          setExtraVisitInfo: (state: { attributes: Array<{ attributeType: string; value: string }> }) => void;
        };

        return (
          <ExtraVisitSlotTestDouble
            setExtraVisitInfo={extraVisitSlotState.setExtraVisitInfo}
            attributes={[extraVisitAttribute]}
          />
        );
      }

      if (typeof children === 'function') {
        return (
          <>
            {children({
              id: 'test-extension-id',
              meta: {},
              moduleName: '@openmrs/esm-patient-chart-app',
              name: 'test-extension-name',
              config: {},
            } as AssignedExtension)}
          </>
        );
      }

      return <>{children ?? null}</>;
    });

    renderVisitForm();
    await screen.findByTestId('extra-visit-attribute-slot');

    await selectVisitType(user);

    const locationPicker = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');

    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    expect(mockSaveVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.arrayContaining([extraVisitAttribute]),
        location: mockLocations.data.results[1].uuid,
        patient: mockPatient.id,
        visitType: 'some-uuid1',
      }),
      expect.any(Object),
    );
  });

  it('prefills editable visit attributes from matching patient person attributes', async () => {
    const user = userEvent.setup();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      visitAttributeTypes: [
        {
          uuid: visitAttributes.punctuality.uuid,
          required: false,
          displayInThePatientBanner: true,
        },
        {
          uuid: visitAttributes.insurancePolicyNumber.uuid,
          required: false,
          displayInThePatientBanner: true,
        },
      ],
      defaultVisitAttributesFromPersonAttributes: [
        {
          personAttributeTypeUuid: '374b130f-7457-476f-87b1-f182aa77c434',
          visitAttributeTypeUuid: visitAttributes.insurancePolicyNumber.uuid,
        },
      ],
    });
    mockUsePersonAttributesForVisitDefaults.mockReturnValue({
      attributes: [
        {
          uuid: 'patient-insurance-type-attribute-uuid',
          attributeType: {
            uuid: '56188294-b42c-481d-a987-4b495116c580',
            format: 'org.openmrs.Concept',
          },
          value: { uuid: essaludConceptUuid, display: 'EsSalud' },
        },
        {
          uuid: 'patient-insurance-code-attribute-uuid',
          attributeType: {
            uuid: '374b130f-7457-476f-87b1-f182aa77c434',
            format: 'java.lang.String',
          },
          value: 'SIS-183299',
        },
      ],
      error: null,
      isLoading: false,
    });

    renderVisitForm();

    const insuranceNumberInput = screen.getByRole('textbox', {
      name: 'Insurance Policy Number (optional)',
    });
    await waitFor(() => expect(insuranceNumberInput).toHaveValue('SIS-183299'));
    expect(insuranceNumberInput).not.toHaveAttribute('readonly');

    await user.clear(insuranceNumberInput);
    await user.type(insuranceNumberInput, 'SIS-UPDATED');

    await selectVisitType(user);

    const locationPicker = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    fireEvent.change(locationPicker, { target: { value: mockLocations.data.results[1].uuid } });

    fireEvent.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(mockSaveVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            {
              attributeType: visitAttributes.insurancePolicyNumber.uuid,
              value: 'SIS-UPDATED',
            },
          ]),
        }),
        expect.any(Object),
      ),
    );
    expect(mockCreateVisitAttribute).not.toHaveBeenCalled();
  });

  it('prefills procedencia from the patient residence address when starting a visit', async () => {
    const user = userEvent.setup();
    const patientWithResidence = {
      ...mockFhirPatient,
      address: [
        {
          use: 'home',
          city: 'San Rafael',
          district: 'Napo',
          state: 'Maynas',
          country: 'PERU',
          extension: [
            {
              url: 'http://openmrs.org/fhir/StructureDefinition/address',
              extension: [
                {
                  url: 'http://openmrs.org/fhir/StructureDefinition/address#address1',
                  valueString: 'Loreto',
                },
              ],
            },
          ],
        },
      ],
    } as fhir.Patient;

    mockUsePatient.mockReturnValue({
      error: null,
      isLoading: false,
      patient: patientWithResidence,
      patientUuid: mockPatient.id,
    });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      visitAttributeTypes: [
        {
          uuid: visitAttributes.provenance.uuid,
          required: false,
          displayInThePatientBanner: true,
        },
      ],
      defaultVisitAttributesFromPersonAttributes: [],
      defaultVisitAttributesFromPatientAddress: [
        {
          visitAttributeTypeUuid: visitAttributes.provenance.uuid,
          addressKind: 'residence',
          addressFields: ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'],
          separator: ', ',
        },
      ],
    });

    renderVisitForm();

    const provenanceInput = screen.getByRole('textbox', {
      name: 'Procedencia (optional)',
    });
    await waitFor(() => expect(provenanceInput).toHaveValue('San Rafael, Napo, Maynas, Loreto, PERU'));

    await selectVisitType(user);
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /Select a UPSS/i,
      }),
      'Inpatient Ward',
    );
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(mockSaveVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            {
              attributeType: visitAttributes.provenance.uuid,
              value: 'San Rafael, Napo, Maynas, Loreto, PERU',
            },
          ]),
        }),
        expect.any(Object),
      ),
    );
    expect(mockCreateVisitAttribute).not.toHaveBeenCalled();
  });

  it('keeps the saved procedencia value when editing an existing visit', async () => {
    const patientWithResidence = {
      ...mockFhirPatient,
      address: [
        {
          use: 'home',
          city: 'San Rafael',
          district: 'Napo',
          state: 'Maynas',
          country: 'PERU',
          extension: [
            {
              url: 'http://openmrs.org/fhir/StructureDefinition/address',
              extension: [
                {
                  url: 'http://openmrs.org/fhir/StructureDefinition/address#address1',
                  valueString: 'Loreto',
                },
              ],
            },
          ],
        },
      ],
    } as fhir.Patient;
    const visitToEdit = {
      ...mockVisitWithAttributes,
      attributes: [
        {
          attributeType: {
            uuid: visitAttributes.provenance.uuid,
            display: 'Procedencia',
            links: [],
          },
          display: 'Procedencia: Comunidad guardada',
          uuid: '9acfb220-109a-48e5-b7bb-f708170491e1',
          value: 'Comunidad guardada',
        },
      ],
    } as unknown as Visit;

    mockUsePatient.mockReturnValue({
      error: null,
      isLoading: false,
      patient: patientWithResidence,
      patientUuid: mockPatient.id,
    });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      visitAttributeTypes: [
        {
          uuid: visitAttributes.provenance.uuid,
          required: false,
          displayInThePatientBanner: true,
        },
      ],
      defaultVisitAttributesFromPersonAttributes: [],
      defaultVisitAttributesFromPatientAddress: [
        {
          visitAttributeTypeUuid: visitAttributes.provenance.uuid,
          addressKind: 'residence',
          addressFields: ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'],
          separator: ', ',
        },
      ],
    });

    renderVisitForm(visitToEdit);

    expect(screen.getByRole('textbox', { name: 'Procedencia (optional)' })).toHaveValue('Comunidad guardada');
  });

  it('sanitizes procedencia so numbers and symbols are not saved', async () => {
    const user = userEvent.setup();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      visitAttributeTypes: [
        {
          uuid: visitAttributes.provenance.uuid,
          required: false,
          displayInThePatientBanner: true,
        },
      ],
      defaultVisitAttributesFromPersonAttributes: [],
      defaultVisitAttributesFromPatientAddress: [],
    });

    renderVisitForm();

    const provenanceInput = screen.getByRole('textbox', {
      name: 'Procedencia (optional)',
    });
    await user.type(provenanceInput, 'MAYNAS123, PERÚ@@@, SAN  JUAN//##');

    expect(provenanceInput).toHaveValue('MAYNAS, PERÚ, SAN JUAN');

    await selectVisitType(user);
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /Select a UPSS/i,
      }),
      'Inpatient Ward',
    );
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(mockSaveVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining([
            {
              attributeType: visitAttributes.provenance.uuid,
              value: 'MAYNAS, PERÚ, SAN JUAN',
            },
          ]),
        }),
        expect.any(Object),
      ),
    );
    expect(mockCreateVisitAttribute).not.toHaveBeenCalled();
  });

  it('lets the user select procedencia from address hierarchy results', async () => {
    const user = userEvent.setup();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(esmPatientChartSchema),
      visitAttributeTypes: [
        {
          uuid: visitAttributes.provenance.uuid,
          required: false,
          displayInThePatientBanner: true,
        },
      ],
      defaultVisitAttributesFromPersonAttributes: [],
      defaultVisitAttributesFromPatientAddress: [],
    });
    mockUseVisitProvenanceAddressOptions.mockReturnValue({
      addresses: ['San Rafael, Napo, Maynas, Loreto, PERU'],
      error: null,
      isLoading: false,
    });

    renderVisitForm();

    const provenanceInput = screen.getByRole('textbox', {
      name: 'Procedencia (optional)',
    });
    await user.type(provenanceInput, 'San');
    await user.click(screen.getByRole('option', { name: 'San Rafael, Napo, Maynas, Loreto, PERU' }));

    expect(provenanceInput).toHaveValue('San Rafael, Napo, Maynas, Loreto, PERU');
  });

  it('updates visit attributes when editing an existing visit', async () => {
    const user = userEvent.setup();
    mockGetVisitAttributes.mockResolvedValue(mockInsuredVisitWithAttributes.attributes);

    renderVisitForm(mockInsuredVisitWithAttributes);

    const saveButton = screen.getByRole('button', { name: /Update visit/i });

    // Set visit type
    await selectVisitType(user);

    // Set location
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');

    const punctualityPicker = screen.getByRole('combobox', {
      name: 'Punctuality (optional)',
    });
    await user.selectOptions(punctualityPicker, 'Late');

    const insuranceNumberInput = screen.getByRole('textbox', { name: 'Insurance Policy Number (optional)' });
    await user.clear(insuranceNumberInput);
    await user.type(insuranceNumberInput, '1873290');

    mockUpdateVisit.mockResolvedValue({
      status: 201,
      data: {
        uuid: visitUuid,
        visitType: {
          display: 'Facility Visit',
        },
      },
    } as unknown as FetchResponse<Visit>);

    await user.click(saveButton);

    expect(mockUpdateVisit).toHaveBeenCalledWith(
      mockInsuredVisitWithAttributes.uuid,
      expect.objectContaining({
        location: mockLocations.data.results[1].uuid,
        visitType: 'some-uuid1',
      }),
      expect.any(Object),
    );

    expect(mockUpdateVisitAttribute).toHaveBeenCalledTimes(2);
    expect(mockUpdateVisitAttribute).toHaveBeenCalledWith(
      visitUuid,
      'c98e66d7-7db5-47ae-b46f-91a0f3b6dda1',
      '66cdc0a1-aa19-4676-af51-80f66d78d9ec',
    );
    expect(mockUpdateVisitAttribute).toHaveBeenCalledWith(visitUuid, 'd6d7d26a-5975-4f03-8abb-db073c948897', '1873290');

    expect(mockCloseWorkspace).toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      subtitle: 'Facility Visit updated successfully',
      kind: 'success',
      title: 'Visit details updated',
    });
  });

  it('deletes visit attributes if the value of the field is cleared when editing an existing visit', async () => {
    const user = userEvent.setup();
    mockGetVisitAttributes.mockResolvedValue(mockInsuredVisitWithAttributes.attributes);

    renderVisitForm(mockInsuredVisitWithAttributes);

    const saveButton = screen.getByRole('button', { name: /Update visit/i });

    // Set visit type
    await selectVisitType(user);

    // Set location
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');

    const punctualityPicker = screen.getByRole('combobox', {
      name: 'Punctuality (optional)',
    });
    await user.selectOptions(punctualityPicker, 'Select an option');

    const insuranceNumberInput = screen.getByRole('textbox', {
      name: 'Insurance Policy Number (optional)',
    });
    await user.clear(insuranceNumberInput);

    mockUpdateVisit.mockResolvedValue({
      status: 201,
      data: {
        uuid: visitUuid,
        visitType: {
          display: 'Facility Visit',
        },
      },
    } as unknown as FetchResponse<Visit>);

    await user.click(saveButton);

    expect(mockUpdateVisit).toHaveBeenCalledWith(
      mockInsuredVisitWithAttributes.uuid,
      expect.objectContaining({
        location: mockLocations.data.results[1].uuid,
        visitType: 'some-uuid1',
      }),
      expect.any(Object),
    );

    expect(mockDeleteVisitAttribute).toHaveBeenCalledTimes(2);
    expect(mockDeleteVisitAttribute).toHaveBeenCalledWith(visitUuid, 'c98e66d7-7db5-47ae-b46f-91a0f3b6dda1');
    expect(mockDeleteVisitAttribute).toHaveBeenCalledWith(visitUuid, 'd6d7d26a-5975-4f03-8abb-db073c948897');

    expect(mockCloseWorkspace).toHaveBeenCalled();

    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      subtitle: 'Facility Visit updated successfully',
      kind: 'success',
      title: 'Visit details updated',
    });
  });

  it('invalidates SIS status before changing payer and converges safely after retry', async () => {
    const user = userEvent.setup();
    let serverAttributes = mockSisVisitWithAttributes.attributes.map((attribute) => ({
      uuid: attribute.uuid,
      attributeType: { uuid: attribute.attributeType.uuid },
      value: attribute.value,
    }));
    const readServerAttributes = () =>
      serverAttributes.map((attribute) => ({
        ...attribute,
        attributeType: { ...attribute.attributeType },
      }));
    let payerUpdateAttempts = 0;

    mockGetVisitAttributes.mockImplementation(async () => readServerAttributes());
    mockDeleteVisitAttribute.mockImplementation(async (_visitUuid, attributeUuid) => {
      serverAttributes = serverAttributes.filter((attribute) => attribute.uuid !== attributeUuid);
      return {} as FetchResponse;
    });
    mockUpdateVisitAttribute.mockImplementation(async (_visitUuid, attributeUuid, value) => {
      if (attributeUuid === 'financiador-visit-attribute-uuid' && payerUpdateAttempts++ === 0) {
        throw new Error('payer update interrupted');
      }
      const attribute = serverAttributes.find((candidate) => candidate.uuid === attributeUuid);
      if (attribute) {
        attribute.value = value;
      }
      return {} as FetchResponse;
    });
    mockCreateVisitAttribute.mockImplementation(async (_visitUuid, attributeType, value) => {
      serverAttributes.push({
        uuid: `created-${attributeType}`,
        attributeType: { uuid: attributeType },
        value,
      });
      return { data: { uuid: `created-${attributeType}` } } as FetchResponse;
    });
    mockUpdateVisit.mockResolvedValue({
      status: 201,
      data: {
        uuid: visitUuid,
        visitType: { display: 'Facility Visit' },
      },
    } as unknown as FetchResponse<Visit>);

    renderVisitForm(mockSisVisitWithAttributes);
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await selectEssaludPayer(user);
    await user.type(screen.getByRole('textbox', { name: 'Insurance Policy Number (optional)' }), 'ESSALUD-42');
    await user.click(screen.getByRole('button', { name: /Update visit/i }));

    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    const statusDeleteIndex = mockDeleteVisitAttribute.mock.calls.findIndex(
      ([, attributeUuid]) => attributeUuid === 'sis-status-visit-attribute-uuid',
    );
    const dateDeleteIndex = mockDeleteVisitAttribute.mock.calls.findIndex(
      ([, attributeUuid]) => attributeUuid === 'sis-checked-at-visit-attribute-uuid',
    );
    const numberUpdateIndex = mockUpdateVisitAttribute.mock.calls.findIndex(
      ([, attributeUuid]) => attributeUuid === 'd6d7d26a-5975-4f03-8abb-db073c948897',
    );
    const payerUpdateIndex = mockUpdateVisitAttribute.mock.calls.findIndex(
      ([, attributeUuid]) => attributeUuid === 'financiador-visit-attribute-uuid',
    );

    expect(mockDeleteVisitAttribute.mock.invocationCallOrder[statusDeleteIndex]).toBeLessThan(
      mockUpdateVisitAttribute.mock.invocationCallOrder[numberUpdateIndex],
    );
    expect(mockUpdateVisitAttribute.mock.invocationCallOrder[numberUpdateIndex]).toBeLessThan(
      mockDeleteVisitAttribute.mock.invocationCallOrder[dateDeleteIndex],
    );
    expect(mockDeleteVisitAttribute.mock.invocationCallOrder[dateDeleteIndex]).toBeLessThan(
      mockUpdateVisitAttribute.mock.invocationCallOrder[payerUpdateIndex],
    );
    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      ),
    ).toBeUndefined();
    expect(
      serverAttributes.find((attribute) => attribute.attributeType.uuid === FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)
        ?.value,
    ).toEqual(expect.objectContaining({ uuid: SIS_CONCEPT_UUID }));

    await user.click(retryButton);
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());

    expect(mockUpdateVisit).toHaveBeenCalledTimes(1);
    expect(mockGetVisitAttributes).toHaveBeenCalledTimes(3);
    expect(
      serverAttributes.find((attribute) => attribute.attributeType.uuid === FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)
        ?.value,
    ).toBe(essaludConceptUuid);
    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      ),
    ).toBeUndefined();
    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
      ),
    ).toBeUndefined();
  });

  it('commits a transition into SIS before staging complements so failures stay discoverable', async () => {
    const user = userEvent.setup();
    let serverAttributes = mockInsuredVisitWithAttributes.attributes.map((attribute) => ({
      uuid: attribute.uuid,
      attributeType: { uuid: attribute.attributeType.uuid },
      value: attribute.value,
    }));
    const readServerAttributes = () =>
      serverAttributes.map((attribute) => ({
        ...attribute,
        attributeType: { ...attribute.attributeType },
      }));
    let numberUpdateAttempts = 0;

    mockGetVisitAttributes.mockImplementation(async () => readServerAttributes());
    mockDeleteVisitAttribute.mockImplementation(async (_visitUuid, attributeUuid) => {
      serverAttributes = serverAttributes.filter((attribute) => attribute.uuid !== attributeUuid);
      return {} as FetchResponse;
    });
    mockUpdateVisitAttribute.mockImplementation(async (_visitUuid, attributeUuid, value) => {
      if (attributeUuid === 'd6d7d26a-5975-4f03-8abb-db073c948897' && numberUpdateAttempts++ === 0) {
        throw new Error('insurance number update interrupted');
      }
      const attribute = serverAttributes.find((candidate) => candidate.uuid === attributeUuid);
      if (attribute) {
        attribute.value = value;
      }
      return {} as FetchResponse;
    });
    mockCreateVisitAttribute.mockImplementation(async (_visitUuid, attributeType, value) => {
      serverAttributes.push({
        uuid: `created-${attributeType}`,
        attributeType: { uuid: attributeType },
        value,
      });
      return { data: { uuid: `created-${attributeType}` } } as FetchResponse;
    });
    mockUpdateVisit.mockResolvedValue({
      status: 201,
      data: {
        uuid: visitUuid,
        visitType: { display: 'Facility Visit' },
      },
    } as unknown as FetchResponse<Visit>);

    renderVisitForm(mockInsuredVisitWithAttributes);
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Financiador (optional)' }), SIS_CONCEPT_UUID);
    await user.type(screen.getByRole('textbox', { name: 'Insurance Policy Number (optional)' }), 'SIS-NEW-42');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Estado de Acreditación SIS (optional)' }),
      sisAccreditationStatusConceptUuid,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Fecha de Acreditación SIS (optional)' }), {
      target: { value: '11/08/2026' },
    });
    await user.click(screen.getByRole('button', { name: /Update visit/i }));

    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    const payerUpdateIndex = mockUpdateVisitAttribute.mock.calls.findIndex(
      ([, attributeUuid]) => attributeUuid === 'financiador-visit-attribute-uuid',
    );
    const numberUpdateIndex = mockUpdateVisitAttribute.mock.calls.findIndex(
      ([, attributeUuid]) => attributeUuid === 'd6d7d26a-5975-4f03-8abb-db073c948897',
    );

    expect(mockUpdateVisitAttribute.mock.invocationCallOrder[payerUpdateIndex]).toBeLessThan(
      mockUpdateVisitAttribute.mock.invocationCallOrder[numberUpdateIndex],
    );
    expect(
      serverAttributes.find((attribute) => attribute.attributeType.uuid === FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)
        ?.value,
    ).toBe(SIS_CONCEPT_UUID);
    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      ),
    ).toBeUndefined();
    expect(mockCreateVisitAttribute).not.toHaveBeenCalled();

    await user.click(retryButton);
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());

    expect(mockUpdateVisit).toHaveBeenCalledTimes(1);
    expect(
      serverAttributes.find((attribute) => attribute.attributeType.uuid === INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)
        ?.value,
    ).toBe('SIS-NEW-42');
    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
      )?.value,
    ).toBe('2026-08-11');
    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      )?.value,
    ).toBe(sisAccreditationStatusConceptUuid);
    const statusCreateIndex = mockCreateVisitAttribute.mock.calls.findIndex(
      ([, attributeType]) => attributeType === SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
    );
    expect(mockCreateVisitAttribute.mock.invocationCallOrder.at(-1)).toBe(
      mockCreateVisitAttribute.mock.invocationCallOrder[statusCreateIndex],
    );
  });

  it('keeps SIS status absent when checked-at persistence fails and restores it last on retry', async () => {
    const user = userEvent.setup();
    let serverAttributes = mockSisVisitWithAttributes.attributes.map((attribute) => ({
      uuid: attribute.uuid,
      attributeType: { uuid: attribute.attributeType.uuid },
      value: attribute.value,
    }));
    const readServerAttributes = () =>
      serverAttributes.map((attribute) => ({
        ...attribute,
        attributeType: { ...attribute.attributeType },
      }));
    let checkedAtUpdateAttempts = 0;

    mockGetVisitAttributes.mockImplementation(async () => readServerAttributes());
    mockDeleteVisitAttribute.mockImplementation(async (_visitUuid, attributeUuid) => {
      serverAttributes = serverAttributes.filter((attribute) => attribute.uuid !== attributeUuid);
      return {} as FetchResponse;
    });
    mockUpdateVisitAttribute.mockImplementation(async (_visitUuid, attributeUuid, value) => {
      if (attributeUuid === 'sis-checked-at-visit-attribute-uuid' && checkedAtUpdateAttempts++ === 0) {
        throw new Error('checked-at update interrupted');
      }
      const attribute = serverAttributes.find((candidate) => candidate.uuid === attributeUuid);
      if (attribute) {
        attribute.value = value;
      }
      return {} as FetchResponse;
    });
    mockCreateVisitAttribute.mockImplementation(async (_visitUuid, attributeType, value) => {
      serverAttributes.push({
        uuid: `created-${attributeType}`,
        attributeType: { uuid: attributeType },
        value,
      });
      return { data: { uuid: `created-${attributeType}` } } as FetchResponse;
    });
    mockUpdateVisit.mockResolvedValue({
      status: 201,
      data: {
        uuid: visitUuid,
        visitType: { display: 'Facility Visit' },
      },
    } as unknown as FetchResponse<Visit>);

    renderVisitForm(mockSisVisitWithAttributes);
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    const insuranceNumberInput = screen.getByRole('textbox', { name: 'Insurance Policy Number (optional)' });
    await user.clear(insuranceNumberInput);
    await user.type(insuranceNumberInput, 'SIS-UPDATED-42');
    const checkedAtInput = screen.getByRole('textbox', { name: 'Fecha de Acreditación SIS (optional)' });
    expect(checkedAtInput).toHaveValue('10/08/2026');
    await user.clear(checkedAtInput);
    fireEvent.change(checkedAtInput, { target: { value: '11/08/2026' } });
    await user.click(screen.getByRole('button', { name: /Update visit/i }));

    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    const statusDeleteIndex = mockDeleteVisitAttribute.mock.calls.findIndex(
      ([, attributeUuid]) => attributeUuid === 'sis-status-visit-attribute-uuid',
    );
    const numberUpdateIndex = mockUpdateVisitAttribute.mock.calls.findIndex(
      ([, attributeUuid]) => attributeUuid === 'd6d7d26a-5975-4f03-8abb-db073c948897',
    );
    const checkedAtUpdateIndex = mockUpdateVisitAttribute.mock.calls.findIndex(
      ([, attributeUuid]) => attributeUuid === 'sis-checked-at-visit-attribute-uuid',
    );

    expect(mockDeleteVisitAttribute.mock.invocationCallOrder[statusDeleteIndex]).toBeLessThan(
      mockUpdateVisitAttribute.mock.invocationCallOrder[numberUpdateIndex],
    );
    expect(mockUpdateVisitAttribute.mock.invocationCallOrder[numberUpdateIndex]).toBeLessThan(
      mockUpdateVisitAttribute.mock.invocationCallOrder[checkedAtUpdateIndex],
    );
    expect(mockCreateVisitAttribute).not.toHaveBeenCalled();
    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      ),
    ).toBeUndefined();

    await user.click(retryButton);
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());

    expect(mockUpdateVisit).toHaveBeenCalledTimes(1);
    expect(mockCreateVisitAttribute).toHaveBeenCalledTimes(1);
    expect(mockUpdateVisitAttribute.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mockCreateVisitAttribute.mock.invocationCallOrder[0],
    );
    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      )?.value,
    ).toBe(sisAccreditationStatusConceptUuid);
    expect(
      serverAttributes.find((attribute) => attribute.attributeType.uuid === INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)
        ?.value,
    ).toBe('SIS-UPDATED-42');
    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
      )?.value,
    ).toBe('2026-08-11');
  });

  it('renders the persisted SIS checked-at date and keeps it empty when the user clears it', async () => {
    const user = userEvent.setup();
    let serverAttributes = mockSisVisitWithAttributes.attributes.map((attribute) => ({
      uuid: attribute.uuid,
      attributeType: { uuid: attribute.attributeType.uuid },
      value: attribute.value,
    }));

    mockGetVisitAttributes.mockImplementation(async () =>
      serverAttributes.map((attribute) => ({
        ...attribute,
        attributeType: { ...attribute.attributeType },
      })),
    );
    mockDeleteVisitAttribute.mockImplementation(async (_visitUuid, attributeUuid) => {
      serverAttributes = serverAttributes.filter((attribute) => attribute.uuid !== attributeUuid);
      return {} as FetchResponse;
    });
    mockUpdateVisitAttribute.mockImplementation(async (_visitUuid, attributeUuid, value) => {
      const attribute = serverAttributes.find((candidate) => candidate.uuid === attributeUuid);
      if (attribute) {
        attribute.value = value;
      }
      return {} as FetchResponse;
    });
    mockUpdateVisit.mockResolvedValue({
      status: 201,
      data: {
        uuid: visitUuid,
        visitType: { display: 'Facility Visit' },
      },
    } as unknown as FetchResponse<Visit>);

    renderVisitForm(mockSisVisitWithAttributes);
    const checkedAtInput = screen.getByRole('textbox', { name: 'Fecha de Acreditación SIS (optional)' });
    expect(checkedAtInput).toHaveValue('10/08/2026');

    await user.clear(checkedAtInput);
    expect(checkedAtInput).toHaveValue('');
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Update visit/i }));
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());

    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
      ),
    ).toBeUndefined();
    expect(
      serverAttributes.find(
        (attribute) => attribute.attributeType.uuid === SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      ),
    ).toBeUndefined();
    expect(mockDeleteVisitAttribute).toHaveBeenCalledWith(visitUuid, 'sis-checked-at-visit-attribute-uuid');
    expect(mockUpdateVisitAttribute).not.toHaveBeenCalledWith(
      visitUuid,
      'sis-checked-at-visit-attribute-uuid',
      expect.anything(),
    );
    expect(mockCreateVisitAttribute).not.toHaveBeenCalledWith(
      visitUuid,
      SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
      expect.anything(),
    );
    expect(mockCreateVisitAttribute).not.toHaveBeenCalledWith(
      expect.anything(),
      SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      expect.anything(),
    );
  });

  it('shows the anti-duplication message when a legacy host cannot normalize a failed visit save', async () => {
    const user = userEvent.setup();

    mockGetUserFacingErrorMessage.mockReturnValueOnce(undefined as never);
    mockSaveVisit.mockRejectedValueOnce({
      status: 500,
      statusText: 'Internal server error',
    });

    renderVisitForm();

    await selectVisitType(user);

    const saveButton = screen.getByRole('button', { name: /Start Visit/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');

    await user.click(saveButton);

    expect(showSnackbar).toHaveBeenCalledTimes(1);
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      subtitle: 'No repita la admisión. Pulse Reintentar para verificar la consulta antes de continuar.',
      title: 'No se pudo iniciar la consulta',
    });

    expect(mockOnVisitCreatedOrUpdatedCallback).not.toHaveBeenCalled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
  });

  it('does not perform post-create attribute writes when starting a new visit', async () => {
    const user = userEvent.setup();

    mockCreateVisitAttribute.mockRejectedValue({
      status: 500,
      statusText: 'Internal server error',
    });

    renderVisitForm();

    await selectVisitType(user);

    const saveButton = screen.getByRole('button', { name: /Start Visit/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');

    const punctualityPicker = screen.getByRole('combobox', {
      name: 'Punctuality (optional)',
    });
    await user.selectOptions(punctualityPicker, 'On time');
    await selectEssaludPayer(user);

    const insuranceNumberInput = screen.getByRole('textbox', {
      name: 'Insurance Policy Number (optional)',
    });
    await user.clear(insuranceNumberInput);
    await user.type(insuranceNumberInput, '183299');

    await user.click(saveButton);

    expect(mockSaveVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.arrayContaining([
          {
            attributeType: visitAttributes.punctuality.uuid,
            value: '66cdc0a1-aa19-4676-af51-80f66d78d9eb',
          },
          {
            attributeType: visitAttributes.insurancePolicyNumber.uuid,
            value: '183299',
          },
        ]),
      }),
      expect.any(Object),
    );
    expect(mockCreateVisitAttribute).not.toHaveBeenCalled();
    expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalled();
    expect(mockCloseWorkspace).toHaveBeenCalled();
  });

  it('keeps visit attributes in the correlated create payload without posting them again', async () => {
    const user = userEvent.setup();
    const recoveredVisit = {
      uuid: 'recovered-visit-with-attributes',
      patient: { uuid: mockPatient.id },
      location: mockLocations.data.results[1],
      visitType: { uuid: 'some-uuid1', display: 'Facility Visit' },
      startDatetime: new Date().toISOString(),
      stopDatetime: null,
      attributes: [],
    } as unknown as Visit;
    mockSaveVisit.mockRejectedValueOnce(new Error('connection closed after commit'));
    mockReconcileVisitCreation.mockResolvedValueOnce(recoveredVisit);

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Punctuality (optional)' }), 'On time');
    await selectEssaludPayer(user);
    const insuranceNumberInput = screen.getByRole('textbox', {
      name: 'Insurance Policy Number (optional)',
    });
    await user.clear(insuranceNumberInput);
    await user.type(insuranceNumberInput, '183299');

    await user.click(screen.getByRole('button', { name: /Start Visit/i }));

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockReconcileVisitCreation).toHaveBeenCalledWith(
      mockPatient.id,
      expect.objectContaining({
        attributes: expect.arrayContaining([
          {
            attributeType: visitAttributes.punctuality.uuid,
            value: '66cdc0a1-aa19-4676-af51-80f66d78d9eb',
          },
          {
            attributeType: visitAttributes.insurancePolicyNumber.uuid,
            value: '183299',
          },
        ]),
      }),
      expect.any(Object),
    );
    expect(mockCreateVisitAttribute).not.toHaveBeenCalled();
  });

  it('persists a selected attribute in the initial request without a reconciliation write', async () => {
    const user = userEvent.setup();

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a UPSS/i }), 'Inpatient Ward');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Punctuality (optional)' }), 'On time');
    await user.click(screen.getByRole('button', { name: /Start Visit/i }));

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockSaveVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.arrayContaining([
          {
            attributeType: visitAttributes.punctuality.uuid,
            value: '66cdc0a1-aa19-4676-af51-80f66d78d9eb',
          },
        ]),
      }),
      expect.any(Object),
    );
    expect(mockCreateVisitAttribute).not.toHaveBeenCalled();
    expect(mockGetVisitAttributes).not.toHaveBeenCalled();
    expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalledTimes(1);
  });

  it('displays a warning modal if the user attempts to discard the visit form with unsaved changes', async () => {
    const user = userEvent.setup();

    renderVisitForm();

    await selectVisitType(user);

    const closeButton = screen.getByRole('button', { name: /Discard/i });

    await user.click(closeButton);

    expect(mockCloseWorkspace).toHaveBeenCalled();
  });

  it('renders an inline error notification if an optional visit attribute type field fails to load', async () => {
    mockUseVisitAttributeType.mockReturnValue({
      isLoading: false,
      error: new Error('failed to load'),
      data: visitAttributes.punctuality,
    });

    renderVisitForm();

    expect(screen.getByText(/Part of the form did not load/i)).toBeInTheDocument();
    expect(screen.getByText(/Please refresh to try again/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start visit/i })).toBeEnabled();
  });

  it('renders an error if a required visit attribute type is not provided', async () => {
    const user = userEvent.setup();

    mockUseConfig.mockReturnValue({
      ...(getDefaultsFromConfigSchema(esmPatientChartSchema) as ChartConfig),
      visitAttributeTypes: [
        {
          uuid: visitAttributes.punctuality.uuid,
          required: true,
          displayInThePatientBanner: true,
        },
      ],
    });

    renderVisitForm();

    const saveButton = screen.getByRole('button', { name: /Start visit/i });

    // Set visit type
    await selectVisitType(user);

    // Set location
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a UPSS/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');
    await user.click(saveButton);

    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it('should disable the submit button and display an inline error notification if required visit attribute fields fail to load', async () => {
    mockUseVisitAttributeType.mockReturnValue({
      isLoading: false,
      error: new Error('failed to load'),
      data: visitAttributes.punctuality,
    });

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema,
      visitAttributeTypes: [
        {
          uuid: visitAttributes.punctuality.uuid,
          required: true,
          displayInThePatientBanner: true,
        },
      ],
    } as ChartConfig);

    renderVisitForm();

    expect(screen.getByText(/Part of the form did not load/i)).toBeInTheDocument();
    expect(screen.getByText(/Please refresh to try again/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start visit/i })).toBeDisabled();
  });
});

async function selectVisitType(user: ReturnType<typeof userEvent.setup>, visitType = 'Outpatient Visit') {
  await user.click(screen.getByRole('combobox', { name: /tipo de atención/i }));
  await user.click(await screen.findByText(visitType));
}

async function selectEssaludPayer(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByRole('combobox', { name: 'Financiador (optional)' }), essaludConceptUuid);
}

function renderVisitForm(visitToEdit?: Visit, overrides: Partial<typeof testProps> = {}) {
  render(React.createElement(StartVisitForm, { ...testProps, ...overrides, visitToEdit }));
}

function hasRenderedExtensionSlot(name: string) {
  return mockExtensionSlot.mock.calls.some(([props]) => props.name === name);
}

function ExtraVisitSlotTestDouble({
  attributes,
  handleCreateExtraVisitInfo,
  setExtraVisitInfo,
}: {
  attributes: Array<{ attributeType: string; value: string }>;
  handleCreateExtraVisitInfo?: () => Promise<void>;
  setExtraVisitInfo: (state: {
    attributes: Array<{ attributeType: string; value: string }>;
    handleCreateExtraVisitInfo?: () => Promise<void>;
  }) => void;
}) {
  React.useEffect(() => {
    setExtraVisitInfo({ attributes, handleCreateExtraVisitInfo });
  }, [attributes, handleCreateExtraVisitInfo, setExtraVisitInfo]);

  return <div data-testid="extra-visit-attribute-slot" />;
}
