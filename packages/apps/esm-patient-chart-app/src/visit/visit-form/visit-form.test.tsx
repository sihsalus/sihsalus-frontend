import {
  type AssignedExtension,
  ExtensionSlot,
  type FetchResponse,
  getDefaultsFromConfigSchema,
  getUserFacingErrorMessage,
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
import { createOfflineVisitForPatient } from '@openmrs/esm-patient-common-lib';
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
  useVisitAttributeTypeAvailability,
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
const visitAttributes = {
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
};

const mockSaveVisit = vi.mocked(saveVisit);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
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
const mockUseVisitAttributeTypeAvailability = vi.mocked(useVisitAttributeTypeAvailability);
const mockCreateOfflineVisitForPatient = vi.mocked(createOfflineVisitForPatient);
const mockUsePersonAttributesForVisitDefaults = vi.mocked(usePersonAttributesForVisitDefaults);
const mockUseVisitProvenanceAddressOptions = vi.mocked(useVisitProvenanceAddressOptions);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  createOfflineVisitForPatient: vi.fn(),
  useActivePatientEnrollment: vi.fn().mockReturnValue({
    activePatientEnrollment: [],
    isLoading: false,
  }),
}));

vi.mock('../hooks/useVisitAttributeType', async () => ({
  useVisitAttributeType: vi.fn((attributeUuid) => {
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
  useConceptAnswersForVisitAttributeType: vi.fn(() => ({
    isLoading: false,
    error: null,
    answers: [
      {
        uuid: '66cdc0a1-aa19-4676-af51-80f66d78d9eb',
        display: 'On time',
        links: [
          {
            rel: 'self',
            uri: 'http://localhost:8080/openmrs/ws/rest/v1/concept/66cdc0a1-aa19-4676-af51-80f66d78d9eb',
            resourceAlias: 'concept',
          },
        ],
      },
      {
        uuid: '66cdc0a1-aa19-4676-af51-80f66d78d9ec',
        display: 'Late',
        links: [
          {
            rel: 'self',
            uri: 'http://localhost:8080/openmrs/ws/rest/v1/concept/66cdc0a1-aa19-4676-af51-80f66d78d9ec',
            resourceAlias: 'concept',
          },
        ],
      },
    ],
  })),
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
    useVisitAttributeTypeAvailability: vi.fn(),
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
    mockUseVisitAttributeTypeAvailability.mockReturnValue({ status: 'available' });
    mockUseConnectivity.mockReturnValue(true);
    mockOnVisitCreatedOrUpdatedCallback.mockResolvedValue(undefined);
    mockUseSession.mockReturnValue({
      user: {
        privileges: [{ display: 'app:home.admision' }],
      },
      sessionLocation: mockLocations.data.results[0],
    } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'app:home.admision');
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

    expect(screen.getByRole('textbox', { name: /Date/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Time/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Time/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Select a location/i })).toBeInTheDocument();
    const visitTypeCategory = screen.getByRole('combobox', { name: /categoría de consulta/i });
    expect(visitTypeCategory).toBeInTheDocument();
    await user.click(visitTypeCategory);
    expect(await screen.findByText(/HIV Return Visit/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /AM/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /PM/i })).toBeInTheDocument();
    expect(screen.getByText(/Punctuality/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Start Visit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discard/i })).toBeInTheDocument();

    // Testing the location picker
    const combobox = screen.getByRole('combobox', {
      name: /Select a location/i,
    });
    expect(screen.getByText(/Outpatient Visit/i)).toBeInTheDocument();
    expect(combobox).toHaveDisplayValue('Mosoriot');
    expect(screen.getByRole('option', { name: /Mosoriot/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Inpatient Ward/i })).toBeInTheDocument();
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

    expect(screen.queryByRole('textbox', { name: /Date/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Time/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add patient to queue/i })).toBeInTheDocument();

    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a location/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Add patient to queue/i }));

    await waitFor(() => expect(mockSaveVisit).toHaveBeenCalledTimes(1));
    const payload = mockSaveVisit.mock.calls[0][0];
    expect(payload.startDatetime.getTime()).toBeGreaterThanOrEqual(beforeSubmission.getTime());
    expect(payload.startDatetime.getTime()).toBeLessThanOrEqual(Date.now());
    expect(showSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Visit started' }));
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
    expect(screen.queryByRole('combobox', { name: /categoría de consulta/i })).not.toBeInTheDocument();
  });

  it('renders a validation error when required fields are not filled', async () => {
    const user = userEvent.setup();

    renderVisitForm();

    const saveButton = screen.getByRole('button', { name: /start visit/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /select a location/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');
    await user.click(saveButton);

    expect(screen.getByText(/missing visit type/i)).toBeInTheDocument();
    expect(screen.getByText(/please select a visit type/i)).toBeInTheDocument();

    await selectVisitType(user);
  });

  it('displays an error message when the visit start time is in the future', async () => {
    const user = userEvent.setup();

    renderVisitForm();

    const dateInput = screen.getByRole('textbox', { name: /date/i });
    const timeInput = screen.getByRole('textbox', { name: /time/i });
    const amPmSelect = screen.getByRole('combobox', { name: /time format/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /select a location/i,
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

    const dateInput = screen.getByRole('textbox', { name: /date/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /select a location/i,
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

    const timeInput = screen.getByRole('textbox', { name: /time/i });
    const amPmSelect = screen.getByRole('combobox', { name: /time format/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /select a location/i,
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
      name: /Select a location/i,
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
      name: /Select a location/i,
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
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a location/i }), 'Inpatient Ward');
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

    await user.selectOptions(screen.getByRole('combobox', { name: /Select a location/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    expect(mockSaveVisit).not.toHaveBeenCalled();
    expect(mockCreateOfflineVisitForPatient).not.toHaveBeenCalled();
    expect(queuePreSave).not.toHaveBeenCalled();
    expect(queueCallback).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        title: 'No se puede registrar la atención sin conexión',
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
    expect(screen.queryByRole('combobox', { name: /Select a location/i })).not.toBeInTheDocument();
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

  it('blocks generic visit creation until the persistence attribute type is verified', async () => {
    mockUseVisitAttributeTypeAvailability.mockReturnValue({ status: 'loading' });
    render(
      React.createElement(StartVisitForm, {
        ...testProps,
        requiredVisitLocation: {
          uuid: mockLocations.data.results[1].uuid,
          display: mockLocations.data.results[1].display ?? 'Inpatient Ward',
        },
        requiredVisitTypeUuid: 'some-uuid2',
      }),
    );

    const saveButton = screen.getByRole('button', { name: /Start visit/i });
    expect(saveButton).toBeDisabled();
    expect(
      screen.getByText('Se está verificando la configuración de guardado seguro. Espere y vuelva a intentar.'),
    ).toBeInTheDocument();

    const form = saveButton.closest('form');
    if (!form) {
      throw new Error('The visit form was not rendered.');
    }
    fireEvent.submit(form);

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'No se puede iniciar la consulta',
        }),
      ),
    );
    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it.each([
    'missing',
    'unconfigured',
  ] as const)('blocks online visit creation when persistence metadata is %s', async (status) => {
    mockUseVisitAttributeTypeAvailability.mockReturnValue({ status });
    render(
      React.createElement(StartVisitForm, {
        ...testProps,
        requiredVisitLocation: {
          uuid: mockLocations.data.results[1].uuid,
          display: mockLocations.data.results[1].display ?? 'Inpatient Ward',
        },
        requiredVisitTypeUuid: 'some-uuid2',
      }),
    );

    const saveButton = screen.getByRole('button', { name: /Start visit/i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/No se pudo verificar la configuración de guardado seguro/i)).toBeInTheDocument();

    const form = saveButton.closest('form');
    if (!form) {
      throw new Error('The visit form was not rendered.');
    }
    fireEvent.submit(form);

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'No se puede iniciar la consulta',
        }),
      ),
    );
    expect(mockSaveVisit).not.toHaveBeenCalled();
  });

  it('verifies the attribute type supplied by an explicit appointment correlation', () => {
    const correlation = {
      attributeType: 'appointment-visit-attribute-type',
      value: 'appointment-uuid',
    };
    mockUseVisitAttributeTypeAvailability.mockReturnValue({
      status: 'error',
      error: new Error('appointment persistence type endpoint unavailable'),
    });

    render(React.createElement(StartVisitForm, { ...testProps, visitPersistenceCorrelation: correlation }));

    expect(mockUseVisitAttributeTypeAvailability).toHaveBeenCalledWith(correlation.attributeType);
    expect(screen.getByRole('button', { name: /Start visit/i })).toBeDisabled();
    expect(screen.getByText(/No se pudo verificar la configuración de guardado seguro/i)).toBeInTheDocument();
  });

  it('does not gate a generic offline visit on backend persistence metadata', () => {
    mockUseConnectivity.mockReturnValue(false);
    mockUseVisitAttributeTypeAvailability.mockReturnValue({ status: 'loading' });

    render(React.createElement(StartVisitForm, testProps));

    expect(mockUseVisitAttributeTypeAvailability).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole('button', { name: /Start visit/i })).not.toBeDisabled();
    expect(screen.queryByText(/configuración de guardado seguro/i)).not.toBeInTheDocument();
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
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a location/i }), 'Inpatient Ward');
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    const queueLocationPicker = screen.getByRole('combobox', { name: 'Queue location' });
    const queuePicker = screen.getByRole('combobox', { name: 'Queue service' });
    expect(screen.getByRole('combobox', { name: /Select a location/i })).toBeDisabled();
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
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a location/i }), 'Inpatient Ward');
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

    expect(screen.queryByRole('combobox', { name: /Select a location/i })).not.toBeInTheDocument();
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
      name: /Select a location/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');

    const punctualityPicker = screen.getByRole('combobox', {
      name: 'Punctuality (optional)',
    });
    await user.selectOptions(punctualityPicker, 'On time');

    const insuranceNumberInput = screen.getByRole('textbox', {
      name: 'Insurance Policy Number (optional)',
    });
    await user.clear(insuranceNumberInput);
    await user.type(insuranceNumberInput, '183299');

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

    expect(mockCreateVisitAttribute).toHaveBeenCalledTimes(2);
    expect(mockCreateVisitAttribute).toHaveBeenCalledWith(
      visitUuid,
      visitAttributes.punctuality.uuid,
      '66cdc0a1-aa19-4676-af51-80f66d78d9eb',
    );
    expect(mockCreateVisitAttribute).toHaveBeenCalledWith(
      visitUuid,
      visitAttributes.insurancePolicyNumber.uuid,
      '183299',
    );

    expect(mockOnVisitCreatedOrUpdatedCallback).toHaveBeenCalled();

    expect(mockCloseWorkspace).toHaveBeenCalled();

    expect(showSnackbar).toHaveBeenCalledTimes(2);
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      subtitle: expect.stringContaining('started successfully'),
      kind: 'success',
      title: 'Visit started',
    });
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      title: expect.stringContaining('Additional visit information updated successfully'),
      kind: 'success',
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
      name: /Select a location/i,
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

  it('prefills visit attributes from matching patient person attributes', async () => {
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
      name: 'Insurance Policy Number',
    });
    await waitFor(() => expect(insuranceNumberInput).toHaveValue('SIS-183299'));
    expect(insuranceNumberInput).toHaveAttribute('readonly');

    await selectVisitType(user);

    const locationPicker = screen.getByRole('combobox', {
      name: /Select a location/i,
    });
    fireEvent.change(locationPicker, { target: { value: mockLocations.data.results[1].uuid } });

    fireEvent.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(mockCreateVisitAttribute).toHaveBeenCalledWith(
        visitUuid,
        visitAttributes.insurancePolicyNumber.uuid,
        'SIS-183299',
      ),
    );
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
        name: /Select a location/i,
      }),
      'Inpatient Ward',
    );
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(mockCreateVisitAttribute).toHaveBeenCalledWith(
        visitUuid,
        visitAttributes.provenance.uuid,
        'San Rafael, Napo, Maynas, Loreto, PERU',
      ),
    );
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
        name: /Select a location/i,
      }),
      'Inpatient Ward',
    );
    await user.click(screen.getByRole('button', { name: /Start visit/i }));

    await waitFor(() =>
      expect(mockCreateVisitAttribute).toHaveBeenCalledWith(
        visitUuid,
        visitAttributes.provenance.uuid,
        'MAYNAS, PERÚ, SAN JUAN',
      ),
    );
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

    renderVisitForm(mockVisitWithAttributes);

    const saveButton = screen.getByRole('button', { name: /Update visit/i });

    // Set visit type
    await selectVisitType(user);

    // Set location
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a location/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');

    const punctualityPicker = screen.getByRole('combobox', {
      name: 'Punctuality (optional)',
    });
    await user.selectOptions(punctualityPicker, 'Late');

    const insuranceNumberInput = screen.getByRole('textbox', {
      name: 'Insurance Policy Number (optional)',
    });
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
      mockVisitWithAttributes.uuid,
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

    renderVisitForm(mockVisitWithAttributes);

    const saveButton = screen.getByRole('button', { name: /Update visit/i });

    // Set visit type
    await selectVisitType(user);

    // Set location
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a location/i,
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
      mockVisitWithAttributes.uuid,
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
      name: /Select a location/i,
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

  it('renders an error message if there was a problem updating visit attributes after starting a new visit', async () => {
    const user = userEvent.setup();

    mockCreateVisitAttribute.mockRejectedValue({
      status: 500,
      statusText: 'Internal server error',
    });

    renderVisitForm();

    await selectVisitType(user);

    const saveButton = screen.getByRole('button', { name: /Start Visit/i });
    const locationPicker = screen.getByRole('combobox', {
      name: /Select a location/i,
    });
    await user.selectOptions(locationPicker, 'Inpatient Ward');

    const punctualityPicker = screen.getByRole('combobox', {
      name: 'Punctuality (optional)',
    });
    await user.selectOptions(punctualityPicker, 'On time');

    const insuranceNumberInput = screen.getByRole('textbox', {
      name: 'Insurance Policy Number (optional)',
    });
    await user.clear(insuranceNumberInput);
    await user.type(insuranceNumberInput, '183299');

    await user.click(saveButton);

    expect(showSnackbar).toHaveBeenCalledTimes(2);
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      subtitle: 'No se pudo guardar el atributo de la consulta. Intente nuevamente.',
      kind: 'error',
      title: 'No se pudo crear el atributo Punctuality',
    });
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      subtitle: 'La consulta ya fue guardada. Pulse Reintentar para completar el registro; no inicie otra consulta.',
      kind: 'error',
      title: 'Consulta iniciada con acciones pendientes',
    });

    expect(mockOnVisitCreatedOrUpdatedCallback).not.toHaveBeenCalled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
  });

  it('retries only the visit attribute that failed and does not create a second visit', async () => {
    const user = userEvent.setup();
    let insuranceAttempts = 0;
    mockCreateVisitAttribute.mockImplementation((_visitUuid, attributeType) => {
      if (attributeType === visitAttributes.insurancePolicyNumber.uuid && insuranceAttempts++ === 0) {
        return Promise.reject(new Error('database detail that must only be logged'));
      }
      return Promise.resolve({} as unknown as FetchResponse);
    });

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a location/i }), 'Inpatient Ward');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Punctuality (optional)' }), 'On time');
    const insuranceNumberInput = screen.getByRole('textbox', { name: 'Insurance Policy Number (optional)' });
    await user.clear(insuranceNumberInput);
    await user.type(insuranceNumberInput, '183299');

    await user.click(screen.getByRole('button', { name: /Start Visit/i }));
    const retryButton = await screen.findByRole('button', { name: /Reintentar registro|Retry registration/i });
    await user.click(retryButton);

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(
      mockCreateVisitAttribute.mock.calls.filter(([, type]) => type === visitAttributes.punctuality.uuid),
    ).toHaveLength(1);
    expect(
      mockCreateVisitAttribute.mock.calls.filter(([, type]) => type === visitAttributes.insurancePolicyNumber.uuid),
    ).toHaveLength(2);
  });

  it('reconciles an attribute when the write succeeded but its response failed', async () => {
    const user = userEvent.setup();
    mockCreateVisitAttribute.mockRejectedValueOnce(new Error('connection closed after commit'));
    mockGetVisitAttributes.mockResolvedValueOnce([
      {
        uuid: 'persisted-punctuality-attribute',
        attributeType: { uuid: visitAttributes.punctuality.uuid },
        value: {
          uuid: '66cdc0a1-aa19-4676-af51-80f66d78d9eb',
          display: 'On time',
        },
      },
    ]);

    renderVisitForm();
    await selectVisitType(user);
    await user.selectOptions(screen.getByRole('combobox', { name: /Select a location/i }), 'Inpatient Ward');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Punctuality (optional)' }), 'On time');
    await user.click(screen.getByRole('button', { name: /Start Visit/i }));

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockSaveVisit).toHaveBeenCalledTimes(1);
    expect(mockCreateVisitAttribute).toHaveBeenCalledTimes(1);
    expect(mockGetVisitAttributes).toHaveBeenCalledWith(visitUuid);
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
      name: /Select a location/i,
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
  await user.click(screen.getByRole('combobox', { name: /categoría de consulta/i }));
  await user.click(await screen.findByText(visitType));
}

function renderVisitForm(visitToEdit?: Visit, overrides: Partial<typeof testProps> = {}) {
  render(React.createElement(StartVisitForm, { ...testProps, ...overrides, visitToEdit }));
}

function hasRenderedExtensionSlot(name: string) {
  return mockExtensionSlot.mock.calls.some(([props]) => props.name === name);
}

function ExtraVisitSlotTestDouble({
  attributes,
  setExtraVisitInfo,
}: {
  attributes: Array<{ attributeType: string; value: string }>;
  setExtraVisitInfo: (state: { attributes: Array<{ attributeType: string; value: string }> }) => void;
}) {
  React.useEffect(() => {
    setExtraVisitInfo({ attributes });
  }, [attributes, setExtraVisitInfo]);

  return <div data-testid="extra-visit-attribute-slot" />;
}
