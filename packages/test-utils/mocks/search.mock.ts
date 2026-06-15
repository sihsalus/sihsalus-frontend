export const mockSearchResults = {
  data: {
    results: [
      {
        display: '10000F1 - Eric Test Ric',
        identifiers: [
          {
            display: 'OpenMRS ID = 10000F1',
            identifier: '10000F1',
            voided: false,
          },
        ],
        patientId: 20,
        patientIdentifier: {
          identifier: '10000F1',
        },
        person: {
          gender: 'M',
          age: 35,
          birthdate: '1986-04-03T00:00:00.000+0000',
          birthdateEstimated: false,
          dead: false,
          deathDate: null,
          display: 'Eric Test Ric',
          personName: {
            display: 'Ric Test Eric',
            givenName: 'Eric',
            middleName: 'Test',
            familyName: 'Ric',
            familyName2: '',
          },
        },
        uuid: 'cc75ad73-c24b-499c-8db9-a7ef4fc0b36d',
      },
    ],
  },
};

export const mockAdvancedSearchResults = [
  {
    patientId: 14,
    uuid: 'e46dfea6-f32d-4b61-bc7d-e79fd35332a4',
    identifiers: [
      {
        identifier: '100008E',
        identifierType: {
          uuid: '05a29f94-c0ed-11e2-94be-8c13b969e334',
          display: 'OpenMRS ID',
        },
      },
    ],
    display: '100008E - Joshua Johnson',
    patientIdentifier: {
      uuid: '1e6c2da6-f63f-4ea5-a595-ded69df9f882',
      identifier: '100008E',
    },
    person: {
      gender: 'M',
      age: 5,
      birthdate: '2019-09-25T00:00:00.000+0000',
      birthdateEstimated: false,
      personName: {
        display: 'Joshua Johnson',
        givenName: 'Joshua',
        middleName: '',
        familyName: 'Johnson',
        familyName2: '',
      },
      addresses: [
        {
          address1: 'Address16442',
          cityVillage: 'City6442',
          stateProvince: 'State6442',
          country: 'Country6442',
          postalCode: '20839',
          preferred: true,
        },
      ],
      dead: false,
      deathDate: null,
    },
    attributes: [
      {
        value: 'true',
        attributeType: {
          uuid: '8b56eac7-5c76-4b9c-8c6f-1deab8d3fc47',
          display: 'Paciente No Identificado',
        },
      },
      {
        value: 'SAMU Loreto',
        attributeType: {
          uuid: '4697d0e6-5b24-416b-aee6-708cd9a3a1db',
          display: 'Nombre del Acompañante',
        },
      },
    ],
  },
  {
    patientId: 42,
    uuid: 'a83747aa-3041-489a-a112-1c024582c83d',
    identifiers: [
      {
        identifier: '100016H',
        identifierType: {
          uuid: '05a29f94-c0ed-11e2-94be-8c13b969e334',
          display: 'OpenMRS ID',
        },
      },
    ],
    display: '100016H - Joseph Davis',
    patientIdentifier: {
      uuid: '0ac0a9a0-b040-4c0a-9c35-c4e0bb52a570',
      identifier: '100016H',
    },
    person: {
      gender: 'M',
      age: 30,
      birthdate: '1994-10-13T00:00:00.000+0000',
      birthdateEstimated: false,
      personName: {
        display: 'Joseph Davis',
        givenName: 'Joseph',
        middleName: '',
        familyName: 'Davis',
        familyName2: '',
      },
      addresses: [
        {
          address1: 'Address19050',
          cityVillage: 'City9050',
          stateProvince: 'State9050',
          country: 'Country9050',
          postalCode: '46548',
          preferred: true,
        },
      ],
      dead: false,
      deathDate: null,
    },
    attributes: [
      {
        value: 'Familiar',
        attributeType: {
          uuid: 'a180fa5f-c44e-4490-a981-d7196b70c6ac',
          display: 'Parentesco del Acompañante',
        },
      },
      {
        value: {
          uuid: '1ce1b7d4-c865-4178-82b0-5932e51503d6',
          display: 'Community Outreach',
          links: [
            {
              rel: 'self',
              uri: 'http://dev3.openmrs.org/openmrs/ws/rest/v1/location/1ce1b7d4-c865-4178-82b0-5932e51503d6',
              resourceAlias: 'location',
            },
          ],
        },
        attributeType: {
          uuid: '8d87236c-c2cc-11de-8d13-0010c6dffd0f',
          display: 'Health Center',
        },
      },
    ],
  },
];
