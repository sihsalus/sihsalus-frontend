import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { esmPatientRegistrationSchema, type FieldDefinition, type RegistrationConfig } from '../../../config-schema';
import { PhoneField } from './phone-field.component';

vi.mock('../person-attributes/person-attribute-field.component', () => ({
  PersonAttributeField: ({ fieldDefinition }: { fieldDefinition: FieldDefinition }) => (
    <div data-testid="phone-field">{JSON.stringify(fieldDefinition)}</div>
  ),
}));

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);

function getRenderedFieldDefinition() {
  return JSON.parse(screen.getByTestId('phone-field').textContent ?? '{}') as FieldDefinition;
}

describe('PhoneField', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(esmPatientRegistrationSchema));
  });

  it('uses the Peru default phone placeholder', () => {
    render(<PhoneField />);

    expect(getRenderedFieldDefinition()).toMatchObject({
      id: 'phone',
      placeholder: '012345678',
      uuid: '14d4f066-15f5-102d-96e4-000c29c2a5d7',
    });
  });

  it('uses a configured phone placeholder when provided', () => {
    const defaultConfig = getDefaultsFromConfigSchema(esmPatientRegistrationSchema);

    mockUseConfig.mockReturnValue({
      ...defaultConfig,
      fieldConfigurations: {
        ...defaultConfig.fieldConfigurations,
        phone: {
          ...defaultConfig.fieldConfigurations.phone,
          personAttributeUuid: '11111111-1111-1111-1111-111111111111',
          placeholder: '01 234 5678',
          validation: {
            required: true,
            matches: '^01[0-9]{7}$',
          },
        },
      },
    });

    render(<PhoneField />);

    expect(getRenderedFieldDefinition()).toMatchObject({
      id: 'phone',
      placeholder: '01 234 5678',
      uuid: '11111111-1111-1111-1111-111111111111',
      validation: {
        required: true,
        matches: '^01[0-9]{7}$',
      },
    });
  });
});
