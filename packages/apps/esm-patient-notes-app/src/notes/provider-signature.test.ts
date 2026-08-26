import { getProviderProfessionalRegistration, type RestProvider } from './visit-notes.resource';

describe('provider professional registration', () => {
  const attributeTypeUuid = '0da4d3db-4385-40de-a4b0-fd8d89c4ec10';

  it('reads only the configured active Provider attribute and never treats the login identifier as CMP', () => {
    const provider: RestProvider = {
      uuid: 'provider-uuid',
      identifier: 'GDeLaCruz',
      attributes: [
        {
          uuid: 'other-attribute',
          value: 'not-a-registration',
          attributeType: { uuid: 'other-type', display: 'CMP' },
        },
        {
          uuid: 'voided-registration',
          voided: true,
          value: 'CMP-OLD',
          attributeType: { uuid: attributeTypeUuid, display: 'Número de Colegiatura' },
        },
        {
          uuid: 'active-registration',
          value: ' CMP-12345 ',
          attributeType: { uuid: attributeTypeUuid.toUpperCase(), display: 'Número de Colegiatura' },
        },
      ],
    };

    expect(getProviderProfessionalRegistration(provider, attributeTypeUuid)).toBe('CMP-12345');
    expect(getProviderProfessionalRegistration({ ...provider, attributes: [] }, attributeTypeUuid)).toBeUndefined();
  });
});
