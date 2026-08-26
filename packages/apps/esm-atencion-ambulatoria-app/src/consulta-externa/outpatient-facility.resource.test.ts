import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import {
  buildOutpatientFacilityAddress,
  getOutpatientFacilityLocationUrl,
  resolveOutpatientFacilityIdentity,
  useOutpatientFacilityIdentity,
  type OutpatientFacilityIdentityOptions,
  type OutpatientFacilityLocation,
} from './outpatient-facility.resource';

vi.mock('swr', () => ({ default: vi.fn() }));

const HSC_LOCATION_UUID = '35d2234e-129a-4c40-abb2-1ae0b72c1602';
const PHONE_ATTRIBUTE_TYPE_UUID = '07c79e2a-b4e8-4100-9210-6f87bc9b77c9';
const IPRESS_ATTRIBUTE_TYPE_UUID = '5fd2b028-5b40-4c85-9a65-01a7ea2cde2b';

const fallbackOptions: OutpatientFacilityIdentityOptions = {
  sessionLocationUuid: HSC_LOCATION_UUID,
  fallbackLocationUuid: HSC_LOCATION_UUID,
  phoneAttributeTypeUuid: PHONE_ATTRIBUTE_TYPE_UUID,
  ipressCodeAttributeTypeUuid: IPRESS_ATTRIBUTE_TYPE_UUID,
  fallbackAddress: 'Distrito de Napo, provincia de Maynas, Loreto',
  fallbackPhone: '965 336 199',
  fallbackIpressCode: '00000066',
};

const contentLocation: OutpatientFacilityLocation = {
  uuid: HSC_LOCATION_UUID,
  display: 'Hospital Santa Clotilde',
  address1: 'LORETO',
  address4: '',
  cityVillage: 'SANTA CLOTILDE',
  countyDistrict: 'NAPO',
  stateProvince: 'MAYNAS',
  country: 'PERU',
  attributes: [
    {
      uuid: 'phone-attribute',
      value: '966 000 001',
      attributeType: { uuid: PHONE_ATTRIBUTE_TYPE_UUID },
    },
    {
      uuid: 'ipress-attribute',
      value: '00009999',
      attributeType: { uuid: IPRESS_ATTRIBUTE_TYPE_UUID },
    },
  ],
};

const mockUseSWR = vi.mocked(useSWR);

describe('outpatient facility identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the matching active Location metadata before the temporary frontend fallback', () => {
    expect(resolveOutpatientFacilityIdentity(contentLocation, fallbackOptions)).toEqual({
      facilityAddress: 'Distrito de NAPO, provincia de MAYNAS, LORETO',
      facilityPhone: '966 000 001',
      facilityIpressCode: '00009999',
    });
  });

  it('maps only the configured address fields and does not invent a street', () => {
    const address = buildOutpatientFacilityAddress(contentLocation);

    expect(address).toBe('Distrito de NAPO, provincia de MAYNAS, LORETO');
    expect(address).not.toContain('ACTUALIZAR');
    expect(address).not.toContain('SANTA CLOTILDE');
  });

  it('uses the matching HSC fallback when attributes are blank, voided or missing', () => {
    const incompleteLocation: OutpatientFacilityLocation = {
      uuid: HSC_LOCATION_UUID,
      display: 'Hospital Santa Clotilde',
      attributes: [
        {
          uuid: 'voided-phone',
          voided: true,
          value: '900 000 000',
          attributeType: { uuid: PHONE_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'blank-phone',
          value: '   ',
          attributeType: { uuid: PHONE_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'blank-ipress',
          value: '',
          attributeType: { uuid: IPRESS_ATTRIBUTE_TYPE_UUID },
        },
      ],
    };

    expect(resolveOutpatientFacilityIdentity(incompleteLocation, fallbackOptions)).toEqual({
      facilityAddress: fallbackOptions.fallbackAddress,
      facilityPhone: fallbackOptions.fallbackPhone,
      facilityIpressCode: fallbackOptions.fallbackIpressCode,
    });
    expect(resolveOutpatientFacilityIdentity(undefined, fallbackOptions)).toEqual({
      facilityAddress: fallbackOptions.fallbackAddress,
      facilityPhone: fallbackOptions.fallbackPhone,
      facilityIpressCode: fallbackOptions.fallbackIpressCode,
    });
  });

  it('does not trust the legacy HSC address hierarchy before the coordinated content attributes exist', () => {
    const legacyLocation: OutpatientFacilityLocation = {
      uuid: HSC_LOCATION_UUID,
      display: 'Hospital Santa Clotilde',
      address1: 'LORETO',
      cityVillage: 'SANTA CLOTILDE',
      countyDistrict: 'NAPO',
      stateProvince: 'LORETO',
      country: 'PERU',
      attributes: [],
    };

    expect(resolveOutpatientFacilityIdentity(legacyLocation, fallbackOptions)).toEqual({
      facilityAddress: fallbackOptions.fallbackAddress,
      facilityPhone: fallbackOptions.fallbackPhone,
      facilityIpressCode: fallbackOptions.fallbackIpressCode,
    });
  });

  it('keeps the verified HSC address fallback during a partial attribute migration', () => {
    const partiallyMigratedLocation: OutpatientFacilityLocation = {
      uuid: HSC_LOCATION_UUID,
      display: 'Hospital Santa Clotilde',
      address1: 'LORETO',
      cityVillage: 'SANTA CLOTILDE',
      countyDistrict: 'NAPO',
      stateProvince: 'LORETO',
      attributes: [
        {
          value: '966 000 001',
          attributeType: { uuid: PHONE_ATTRIBUTE_TYPE_UUID },
        },
      ],
    };

    expect(resolveOutpatientFacilityIdentity(partiallyMigratedLocation, fallbackOptions)).toEqual({
      facilityAddress: fallbackOptions.fallbackAddress,
      facilityPhone: '966 000 001',
      facilityIpressCode: fallbackOptions.fallbackIpressCode,
    });
  });

  it('never combines another session Location with the HSC fallback', () => {
    const otherOptions = {
      ...fallbackOptions,
      sessionLocationUuid: 'other-location-uuid',
    };

    expect(resolveOutpatientFacilityIdentity(undefined, otherOptions)).toEqual({
      facilityAddress: null,
      facilityPhone: null,
      facilityIpressCode: null,
    });
    expect(resolveOutpatientFacilityIdentity(contentLocation, otherOptions)).toEqual({
      facilityAddress: null,
      facilityPhone: null,
      facilityIpressCode: null,
    });
  });

  it('rejects retired Location metadata before applying the scoped fallback', () => {
    expect(resolveOutpatientFacilityIdentity({ ...contentLocation, retired: true }, fallbackOptions)).toEqual({
      facilityAddress: fallbackOptions.fallbackAddress,
      facilityPhone: fallbackOptions.fallbackPhone,
      facilityIpressCode: fallbackOptions.fallbackIpressCode,
    });
    expect(
      resolveOutpatientFacilityIdentity(
        { ...contentLocation, uuid: 'other-location-uuid', retired: true },
        { ...fallbackOptions, sessionLocationUuid: 'other-location-uuid' },
      ),
    ).toEqual({
      facilityAddress: null,
      facilityPhone: null,
      facilityIpressCode: null,
    });
  });

  it('uses another Location own metadata without borrowing HSC values', () => {
    const otherLocation: OutpatientFacilityLocation = {
      uuid: 'other-location-uuid',
      display: 'Puesto de Salud Sintético',
      address4: 'Dirección sintética 123',
      cityVillage: 'Comunidad sintética',
      countyDistrict: 'Distrito sintético',
      stateProvince: 'Provincia sintética',
      address1: 'Región sintética',
      attributes: [
        {
          value: '900 111 222',
          attributeType: { uuid: PHONE_ATTRIBUTE_TYPE_UUID },
        },
        {
          value: '00001111',
          attributeType: { uuid: IPRESS_ATTRIBUTE_TYPE_UUID },
        },
      ],
    };

    expect(
      resolveOutpatientFacilityIdentity(otherLocation, {
        ...fallbackOptions,
        sessionLocationUuid: otherLocation.uuid,
      }),
    ).toEqual({
      facilityAddress:
        'Dirección sintética 123, Comunidad sintética, distrito de Distrito sintético, provincia de Provincia sintética, Región sintética',
      facilityPhone: '900 111 222',
      facilityIpressCode: '00001111',
    });
  });

  it('omits all HSC fallback values when the session Location UUID is unavailable', () => {
    expect(
      resolveOutpatientFacilityIdentity(undefined, {
        ...fallbackOptions,
        sessionLocationUuid: null,
      }),
    ).toEqual({
      facilityAddress: null,
      facilityPhone: null,
      facilityIpressCode: null,
    });
  });

  it('falls back safely when the Location request fails and only requests the active session Location', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('synthetic backend failure'),
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() => useOutpatientFacilityIdentity(fallbackOptions));

    expect(result.current).toEqual({
      facilityAddress: fallbackOptions.fallbackAddress,
      facilityPhone: fallbackOptions.fallbackPhone,
      facilityIpressCode: fallbackOptions.fallbackIpressCode,
      isLoading: false,
    });
    expect(mockUseSWR).toHaveBeenCalledWith(getOutpatientFacilityLocationUrl(HSC_LOCATION_UUID), openmrsFetch);
    expect(getOutpatientFacilityLocationUrl(HSC_LOCATION_UUID)).toMatch(
      new RegExp(`^${restBaseUrl}/location/${HSC_LOCATION_UUID}\\?v=`),
    );
  });

  it('exposes the loading state while retaining only a matching configured fallback', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: true,
      mutate: vi.fn(),
    } as never);

    const matching = renderHook(() => useOutpatientFacilityIdentity(fallbackOptions));
    expect(matching.result.current).toEqual({
      facilityAddress: fallbackOptions.fallbackAddress,
      facilityPhone: fallbackOptions.fallbackPhone,
      facilityIpressCode: fallbackOptions.fallbackIpressCode,
      isLoading: true,
    });

    const otherLocation = renderHook(() =>
      useOutpatientFacilityIdentity({
        ...fallbackOptions,
        sessionLocationUuid: 'other-location-uuid',
      }),
    );
    expect(otherLocation.result.current).toEqual({
      facilityAddress: null,
      facilityPhone: null,
      facilityIpressCode: null,
      isLoading: true,
    });
  });
});
