import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Formik } from 'formik';
import type React from 'react';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../../../config-schema';
import { fetchPersonRegistrationCopyData, type PersonRegistrationCopyData } from '../../patient-registration.resource';
import { type FormValues } from '../../patient-registration.types';
import { PatientRegistrationContext, type PatientRegistrationContextProps } from '../../patient-registration-context';
import { birthAddressMarker, birthAddressMarkerField } from '../../patient-registration-utils';
import {
  peruEmailAttributeTypeUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
  peruInsuranceTypeAttributeTypeUuid,
  peruMobilePhoneAttributeTypeUuid,
  peruPhoneAttributeTypeUuid,
} from '../../peru-registration-config';

import { CopyResponsibleDataButton } from './copy-responsible-data-button.component';

vi.mock('../../patient-registration.resource', async () => ({
  ...(await vi.importActual('../../patient-registration.resource')),
  fetchPersonRegistrationCopyData: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);
const mockFetchPersonRegistrationCopyData = vi.mocked(fetchPersonRegistrationCopyData);

const baseValues = {
  additionalFamilyName: '',
  additionalFamilyName2: '',
  additionalGivenName: '',
  additionalMiddleName: '',
  addNameInLocalLanguage: false,
  address: {},
  attributes: {},
  birthAddress: {},
  birthdate: '2020-01-01',
  birthdateEstimated: false,
  deathCause: '',
  deathDate: '',
  deathTime: '',
  deathTimeFormat: 'AM',
  familyName: '',
  familyName2: '',
  gender: '',
  givenName: '',
  identifiers: {},
  isDead: false,
  middleName: '',
  monthsEstimated: 0,
  nonCodedCauseOfDeath: '',
  patientUuid: '',
  relationships: [
    {
      action: 'ADD',
      relatedPersonUuid: 'responsible-person-uuid',
      relationshipType: '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
    },
  ],
  telephoneNumber: '',
  yearsEstimated: 0,
} as FormValues;

function renderCopyButton(mode: React.ComponentProps<typeof CopyResponsibleDataButton>['mode'], values = baseValues) {
  const setFieldValue = vi.fn();
  const setFieldTouched = vi.fn();
  const contextValues = {
    currentPhoto: null,
    identifierTypes: [],
    inEditMode: false,
    initialFormValues: values,
    isOffline: false,
    setCapturePhotoProps: vi.fn(),
    setFieldTouched,
    setFieldValue,
    validationSchema: null,
    values,
  } as unknown as PatientRegistrationContextProps;

  const view = render(
    <Formik initialValues={{}} onSubmit={vi.fn()}>
      <Form>
        <PatientRegistrationContext.Provider value={contextValues}>
          <CopyResponsibleDataButton mode={mode} />
        </PatientRegistrationContext.Provider>
      </Form>
    </Formik>,
  );

  return { ...view, setFieldTouched, setFieldValue };
}

describe('CopyResponsibleDataButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(esmPatientRegistrationSchema));
    mockFetchPersonRegistrationCopyData.mockResolvedValue({
      uuid: 'responsible-person-uuid',
      display: 'María Quispe',
      addresses: [
        {
          preferred: false,
          address1: 'Hospital de nacimiento',
          [birthAddressMarkerField]: birthAddressMarker,
        },
        {
          preferred: true,
          country: 'PERU',
          stateProvince: 'HUANCAVELICA',
          countyDistrict: 'CHURCAMPA',
          cityVillage: 'PAUCARBAMBA',
          address1: 'Jr. Principal 123',
        },
      ],
      attributes: [
        {
          uuid: 'phone-attribute',
          display: 'Número de Teléfono = 066123456',
          attributeType: {
            uuid: peruPhoneAttributeTypeUuid,
            display: 'Número de Teléfono',
            format: 'java.lang.String',
          },
          value: '066123456',
        },
        {
          uuid: 'mobile-attribute',
          display: 'Número de Celular = 999888777',
          attributeType: {
            uuid: peruMobilePhoneAttributeTypeUuid,
            display: 'Número de Celular',
            format: 'java.lang.String',
          },
          value: '999888777',
        },
        {
          uuid: 'email-attribute',
          display: 'Correo Electrónico = responsable@example.org',
          attributeType: {
            uuid: peruEmailAttributeTypeUuid,
            display: 'Correo Electrónico',
            format: 'java.lang.String',
          },
          value: 'responsable@example.org',
        },
        {
          uuid: 'insurance-type',
          display: 'Tipo de seguro = SIS Gratuito',
          attributeType: {
            uuid: peruInsuranceTypeAttributeTypeUuid,
            display: 'Tipo de seguro',
            format: 'org.openmrs.Concept',
          },
          value: { uuid: 'b61a9ff9-1485-4388-9f67-9c341f847f85', display: 'SIS Gratuito' },
        },
        {
          uuid: 'insurance-code',
          display: 'Código de seguro = SIS-123456',
          attributeType: {
            uuid: peruInsuranceCodeAttributeTypeUuid,
            display: 'Código de seguro',
            format: 'java.lang.String',
          },
          value: 'SIS-123456',
        },
        {
          uuid: 'insurance-status',
          display: 'Estado de acreditación de seguro = Vigente',
          attributeType: {
            uuid: peruInsuranceAccreditationStatusAttributeTypeUuid,
            display: 'Estado de acreditación de seguro',
            format: 'org.openmrs.Concept',
          },
          value: { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2051', display: 'Vigente' },
        },
        {
          uuid: 'insurance-date',
          display: 'Fecha de acreditación = 2026-06-17',
          attributeType: {
            uuid: peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
            display: 'Fecha de acreditación',
            format: 'java.lang.String',
          },
          value: '2026-06-17',
        },
      ],
    });
  });

  it('copies residence and contact fields from the responsible person', async () => {
    const user = userEvent.setup();
    const { setFieldTouched, setFieldValue } = renderCopyButton('residenceContact');

    await user.click(screen.getByRole('button', { name: /copiar residencia y contacto del responsable/i }));

    await waitFor(() =>
      expect(mockFetchPersonRegistrationCopyData).toHaveBeenCalledWith(
        'responsible-person-uuid',
        expect.any(AbortSignal),
      ),
    );
    expect(setFieldValue).toHaveBeenCalledWith('address.country', 'PERU', false);
    expect(setFieldValue).toHaveBeenCalledWith('address.stateProvince', 'HUANCAVELICA', false);
    expect(setFieldValue).toHaveBeenCalledWith('address.countyDistrict', 'CHURCAMPA', false);
    expect(setFieldValue).toHaveBeenCalledWith('address.cityVillage', 'PAUCARBAMBA', false);
    expect(setFieldValue).toHaveBeenCalledWith('address.address1', 'Jr. Principal 123', false);
    expect(setFieldValue).toHaveBeenCalledWith(`attributes.${peruPhoneAttributeTypeUuid}`, '066123456', false);
    expect(setFieldValue).toHaveBeenCalledWith(`attributes.${peruMobilePhoneAttributeTypeUuid}`, '999888777', false);
    expect(setFieldValue).toHaveBeenCalledWith(
      `attributes.${peruEmailAttributeTypeUuid}`,
      'responsable@example.org',
      false,
    );
    expect(setFieldTouched).toHaveBeenCalledWith('address.address1', true, false);
    expect(screen.getByText('Residencia y contacto copiados del responsable')).toBeInTheDocument();
  });

  it('copies the responsible residence into the birthplace address when explicitly requested', async () => {
    const user = userEvent.setup();
    const { setFieldValue } = renderCopyButton('birthAddress');

    await user.click(
      screen.getByRole('button', { name: /copiar residencia del responsable como lugar de nacimiento/i }),
    );

    await waitFor(() =>
      expect(mockFetchPersonRegistrationCopyData).toHaveBeenCalledWith(
        'responsible-person-uuid',
        expect.any(AbortSignal),
      ),
    );
    expect(setFieldValue).toHaveBeenCalledWith('birthAddress.country', 'PERU', false);
    expect(setFieldValue).toHaveBeenCalledWith('birthAddress.stateProvince', 'HUANCAVELICA', false);
    expect(setFieldValue).toHaveBeenCalledWith('birthAddress.countyDistrict', 'CHURCAMPA', false);
    expect(setFieldValue).toHaveBeenCalledWith('birthAddress.cityVillage', 'PAUCARBAMBA', false);
    expect(setFieldValue).toHaveBeenCalledWith('birthAddress.address1', 'Jr. Principal 123', false);
    expect(setFieldValue).not.toHaveBeenCalledWith(
      `birthAddress.${birthAddressMarkerField}`,
      birthAddressMarker,
      false,
    );
    expect(screen.getByText('Lugar de nacimiento copiado desde la residencia del responsable')).toBeInTheDocument();
  });

  it('copies insurance fields from the responsible person', async () => {
    const user = userEvent.setup();
    const { setFieldValue } = renderCopyButton('insurance');

    await user.click(screen.getByRole('button', { name: /copiar seguro del responsable/i }));

    await waitFor(() =>
      expect(mockFetchPersonRegistrationCopyData).toHaveBeenCalledWith(
        'responsible-person-uuid',
        expect.any(AbortSignal),
      ),
    );
    expect(setFieldValue).toHaveBeenCalledWith(
      `attributes.${peruInsuranceTypeAttributeTypeUuid}`,
      'b61a9ff9-1485-4388-9f67-9c341f847f85',
      false,
    );
    expect(setFieldValue).toHaveBeenCalledWith(`attributes.${peruInsuranceCodeAttributeTypeUuid}`, 'SIS-123456', false);
    expect(setFieldValue).toHaveBeenCalledWith(
      `attributes.${peruInsuranceAccreditationStatusAttributeTypeUuid}`,
      '9b3df0a1-0c58-4f55-9868-9c38f1db2051',
      false,
    );
    expect(setFieldValue).toHaveBeenCalledWith(
      `attributes.${peruInsuranceAccreditationCheckedAtAttributeTypeUuid}`,
      '2026-06-17',
      false,
    );
    expect(screen.getByText('Seguro copiado del responsable')).toBeInTheDocument();
  });

  it('does not call the backend when there is no selected responsible person', async () => {
    const user = userEvent.setup();
    renderCopyButton('residenceContact', { ...baseValues, relationships: [] });

    await user.click(screen.getByRole('button', { name: /copiar residencia y contacto del responsable/i }));

    expect(mockFetchPersonRegistrationCopyData).not.toHaveBeenCalled();
    expect(screen.getByText('Seleccione un responsable antes de copiar datos')).toBeInTheDocument();
  });

  it('does not copy from an unrelated relationship when no responsible person is selected', async () => {
    const user = userEvent.setup();
    renderCopyButton('insurance', {
      ...baseValues,
      relationships: [
        {
          action: 'ADD',
          relatedPersonUuid: 'unrelated-person-uuid',
          relationshipType: 'unrelated-type-uuid/aIsToB',
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: /copiar seguro del responsable/i }));

    expect(mockFetchPersonRegistrationCopyData).not.toHaveBeenCalled();
    expect(screen.getByText('Seleccione un responsable antes de copiar datos')).toBeInTheDocument();
  });

  it('requires an explicit source when more than one responsible person is available', async () => {
    const user = userEvent.setup();
    const relationshipType = '057de23f-3d9c-4314-9391-4452970739c6/aIsToB';
    renderCopyButton('insurance', {
      ...baseValues,
      relationships: [
        {
          action: 'ADD',
          relatedPersonName: 'María Quispe',
          relatedPersonUuid: 'responsible-person-uuid',
          relationshipType,
        },
        {
          action: 'ADD',
          relatedPersonName: 'Juan Quispe',
          relatedPersonUuid: 'second-responsible-uuid',
          relationshipType,
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: /copiar seguro del responsable/i }));
    expect(mockFetchPersonRegistrationCopyData).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText('Responsable de origen'), 'second-responsible-uuid');
    await user.click(screen.getByRole('button', { name: /copiar seguro del responsable/i }));

    await waitFor(() =>
      expect(mockFetchPersonRegistrationCopyData).toHaveBeenCalledWith(
        'second-responsible-uuid',
        expect.any(AbortSignal),
      ),
    );
  });

  it('aborts an in-flight copy when the selected responsible person changes', async () => {
    const user = userEvent.setup();
    const relationshipType = '057de23f-3d9c-4314-9391-4452970739c6/aIsToB';
    let resolveFirstRequest: (person: PersonRegistrationCopyData) => void = () => {};
    const firstRequest = new Promise<PersonRegistrationCopyData>((resolve) => {
      resolveFirstRequest = resolve;
    });
    mockFetchPersonRegistrationCopyData
      .mockReset()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({
        uuid: 'second-responsible-uuid',
        attributes: [
          {
            uuid: 'second-insurance-code',
            display: 'Código de seguro = SECOND',
            attributeType: {
              uuid: peruInsuranceCodeAttributeTypeUuid,
              display: 'Código de seguro',
              format: 'java.lang.String',
            },
            value: 'SECOND',
          },
        ],
      });
    const { setFieldValue } = renderCopyButton('insurance', {
      ...baseValues,
      relationships: [
        {
          action: 'ADD',
          relatedPersonName: 'María Quispe',
          relatedPersonUuid: 'responsible-person-uuid',
          relationshipType,
        },
        {
          action: 'ADD',
          relatedPersonName: 'Juan Quispe',
          relatedPersonUuid: 'second-responsible-uuid',
          relationshipType,
        },
      ],
    });
    const sourceSelect = screen.getByLabelText('Responsable de origen');
    const copyButton = screen.getByRole('button', { name: /copiar seguro del responsable/i });

    await user.selectOptions(sourceSelect, 'responsible-person-uuid');
    await user.click(copyButton);
    await waitFor(() => expect(mockFetchPersonRegistrationCopyData).toHaveBeenCalledTimes(1));
    const firstSignal = mockFetchPersonRegistrationCopyData.mock.calls[0][1];

    await user.selectOptions(sourceSelect, 'second-responsible-uuid');
    expect(firstSignal?.aborted).toBe(true);
    await user.click(copyButton);

    await waitFor(() =>
      expect(setFieldValue).toHaveBeenCalledWith(`attributes.${peruInsuranceCodeAttributeTypeUuid}`, 'SECOND', false),
    );

    await act(async () => {
      resolveFirstRequest({
        uuid: 'responsible-person-uuid',
        attributes: [
          {
            uuid: 'first-insurance-code',
            display: 'Código de seguro = FIRST',
            attributeType: {
              uuid: peruInsuranceCodeAttributeTypeUuid,
              display: 'Código de seguro',
              format: 'java.lang.String',
            },
            value: 'FIRST',
          },
        ],
      });
    });
    expect(setFieldValue).not.toHaveBeenCalledWith(`attributes.${peruInsuranceCodeAttributeTypeUuid}`, 'FIRST', false);
  });

  it('aborts an in-flight copy when the component unmounts', async () => {
    const user = userEvent.setup();
    mockFetchPersonRegistrationCopyData.mockReset().mockReturnValue(new Promise(() => {}));
    const { unmount } = renderCopyButton('residenceContact');

    await user.click(screen.getByRole('button', { name: /copiar residencia y contacto del responsable/i }));
    await waitFor(() => expect(mockFetchPersonRegistrationCopyData).toHaveBeenCalledTimes(1));
    const signal = mockFetchPersonRegistrationCopyData.mock.calls[0][1];
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('does not show copy actions for adult patients', () => {
    renderCopyButton('residenceContact', { ...baseValues, birthdate: '1990-01-01' });

    expect(
      screen.queryByRole('button', { name: /copiar residencia y contacto del responsable/i }),
    ).not.toBeInTheDocument();
    expect(mockFetchPersonRegistrationCopyData).not.toHaveBeenCalled();
  });
});
