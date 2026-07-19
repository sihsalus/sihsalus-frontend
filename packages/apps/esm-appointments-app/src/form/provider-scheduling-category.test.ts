import { type AppointmentService, type Provider } from '../types';
import { assessProviderSchedulingCategory } from './provider-scheduling-category';

const attributeTypeUuid = '3961cbdd-3240-4b70-99ca-5f63af488b15';
const categoryUuid = 'a0d4e64e-eb63-4271-bdf1-ffa10392c282';
const service = {
  uuid: 'service-uuid',
  speciality: { uuid: categoryUuid, display: 'Odontología general' },
} as AppointmentService;
const provider = {
  uuid: 'provider-uuid',
  display: 'Profesional de prueba',
  person: { uuid: 'person-uuid' },
  attributes: [
    {
      uuid: 'attribute-uuid',
      attributeType: { uuid: attributeTypeUuid },
      value: categoryUuid,
    },
  ],
} as Provider;

describe('assessProviderSchedulingCategory', () => {
  it('does nothing when validation is disabled', () => {
    expect(assessProviderSchedulingCategory({ mode: 'off', provider, service })).toEqual({
      reason: 'validation-off',
      shouldBlock: false,
      shouldWarn: false,
    });
  });

  it('does not require categories for profession-only services', () => {
    expect(
      assessProviderSchedulingCategory({
        mode: 'strict',
        provider,
        providerAttributeTypeUuid: attributeTypeUuid,
        service: { ...service, speciality: {} },
      }),
    ).toEqual({
      reason: 'service-without-category',
      shouldBlock: false,
      shouldWarn: false,
    });
  });

  it('waits until a provider is selected', () => {
    expect(
      assessProviderSchedulingCategory({
        mode: 'strict',
        providerAttributeTypeUuid: attributeTypeUuid,
        service,
      }),
    ).toEqual({
      categoryUuid,
      reason: 'provider-not-selected',
      shouldBlock: false,
      shouldWarn: false,
    });
  });

  it('accepts an exact active attribute value and ignores voided values', () => {
    expect(
      assessProviderSchedulingCategory({
        mode: 'strict',
        provider,
        providerAttributeTypeUuid: attributeTypeUuid,
        service,
      }),
    ).toEqual({
      categoryUuid,
      reason: 'matched',
      shouldBlock: false,
      shouldWarn: false,
    });

    const providerWithOnlyVoidedCategory = {
      ...provider,
      attributes: provider.attributes?.map((attribute) => ({
        ...attribute,
        voided: true,
      })),
    };
    expect(
      assessProviderSchedulingCategory({
        mode: 'strict',
        provider: providerWithOnlyVoidedCategory,
        providerAttributeTypeUuid: attributeTypeUuid,
        service,
      }).shouldBlock,
    ).toBe(true);
  });

  it.each([
    ['warn', false, true],
    ['strict', true, false],
  ] as const)('handles a missing provider category in %s mode', (mode, shouldBlock, shouldWarn) => {
    const assessment = assessProviderSchedulingCategory({
      mode,
      provider: { ...provider, attributes: [] },
      providerAttributeTypeUuid: attributeTypeUuid,
      service,
    });

    expect(assessment).toMatchObject({
      reason: 'category-not-enabled',
      shouldBlock,
      shouldWarn,
    });
  });

  it('fails strict validation when the attribute type is not configured', () => {
    expect(assessProviderSchedulingCategory({ mode: 'strict', provider, service })).toMatchObject({
      reason: 'configuration-missing',
      shouldBlock: true,
      shouldWarn: false,
    });
  });
});
