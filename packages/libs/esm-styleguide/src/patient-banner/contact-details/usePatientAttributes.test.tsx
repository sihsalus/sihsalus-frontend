import { useConfig } from '@openmrs/esm-react-utils';
import { renderHook } from '@testing-library/react';
import useSWRImmutable from 'swr/immutable';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientAdditionalAttributes, usePatientContactAttributes } from './usePatientAttributes';

vi.mock('swr/immutable', () => ({
  default: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUseSWRImmutable = vi.mocked(useSWRImmutable);

const patientAttributes = [
  {
    uuid: 'contact-attribute',
    value: '999999999',
    attributeType: {
      uuid: 'contact-type',
      display: 'Phone number',
    },
  },
  {
    uuid: 'additional-attribute',
    value: 'Peruana',
    attributeType: {
      uuid: 'additional-type',
      display: 'Nacionalidad',
    },
  },
];

const swrResponse = {
  data: {
    data: {
      person: {
        attributes: patientAttributes,
      },
    },
  },
  error: null,
  isLoading: false,
};

describe('usePatientAttributes', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      contactAttributeTypes: ['contact-type'],
      additionalAttributeTypes: ['additional-type'],
    });
    mockUseSWRImmutable.mockReturnValue(swrResponse as never);
  });

  it('loads contact attribute config from the SIHSALUS patient banner module', () => {
    const { result } = renderHook(() => usePatientContactAttributes('patient-uuid'));

    expect(mockUseConfig).toHaveBeenCalledWith({
      externalModuleName: '@sihsalus/esm-patient-banner-app',
    });
    expect(result.current.contactAttributes).toEqual([patientAttributes[0]]);
  });

  it('loads additional attribute config from the SIHSALUS patient banner module', () => {
    const { result } = renderHook(() => usePatientAdditionalAttributes('patient-uuid'));

    expect(mockUseConfig).toHaveBeenCalledWith({
      externalModuleName: '@sihsalus/esm-patient-banner-app',
    });
    expect(result.current.additionalAttributes).toEqual([patientAttributes[1]]);
  });
});
