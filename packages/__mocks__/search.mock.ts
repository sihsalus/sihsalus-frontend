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
            givenName: 'Eric',
            middleName: 'Test',
            familyName: 'Ric',
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
        familyName: 'Johnson',
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
        value: {
          uuid: 'f859ef8a-a7ca-5f74-b775-e19be71f5ba8',
          display: 'Documento Nacional de Identidad (DNI)',
        },
        attributeType: {
          uuid: '6f5c0b8a-9e91-4d41-9a8c-8b0f3c2e7a11',
          display: 'Tipo de Documento de Identidad',
        },
      },
      {
        value: '12345678',
        attributeType: {
          uuid: 'c0d1a2b3-4e5f-4a6b-9c7d-8e9f0a1b2c3d',
          display: 'Código de Documento de Identidad',
        },
      },
      {
        value: {
          uuid: '01c97f73-9e7d-420c-bd08-3ba82e8cc825',
          display: 'Validado por RENIEC',
        },
        attributeType: {
          uuid: 'a7e3f8c1-2d4b-4f9a-8c6e-1b2d3f4a5c6e',
          display: 'Estado de Verificación de Identidad',
        },
      },
      {
        value: {
          uuid: '9e42f0f1-d989-4604-902e-8a33f474f01e',
          display: 'Identificación confirmada',
        },
        attributeType: {
          uuid: '787f1ea9-1792-45e5-9076-699b1a0638cb',
          display: 'Estado de Identificación en Admisión',
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
        familyName: 'Davis',
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
        value: {
          uuid: 'a0dd88f1-d1b6-4829-8a89-c7849b7c9a59',
          display: 'Carné de Extranjería',
        },
        attributeType: {
          uuid: '6f5c0b8a-9e91-4d41-9a8c-8b0f3c2e7a11',
          display: 'Tipo de Documento de Identidad',
        },
      },
      {
        value: '87654321',
        attributeType: {
          uuid: 'c0d1a2b3-4e5f-4a6b-9c7d-8e9f0a1b2c3d',
          display: 'Código de Documento de Identidad',
        },
      },
      {
        value: {
          uuid: '4ff1586e-2186-4820-bc98-2535ddfbcb33',
          display: 'No verificado',
        },
        attributeType: {
          uuid: 'a7e3f8c1-2d4b-4f9a-8c6e-1b2d3f4a5c6e',
          display: 'Estado de Verificación de Identidad',
        },
      },
      {
        value: {
          uuid: 'bdb57e2a-d8fd-4e2b-8622-1ba60dcd3024',
          display: 'No identificado',
        },
        attributeType: {
          uuid: '787f1ea9-1792-45e5-9076-699b1a0638cb',
          display: 'Estado de Identificación en Admisión',
        },
      },
    ],
  },
];
