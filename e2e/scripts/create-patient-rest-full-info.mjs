const openmrsBase = (process.env.E2E_API_BASE_URL ?? process.env.OPENMRS_BASE)?.replace(/\/$/, '');
const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

if (!openmrsBase || !username || !password) {
  throw new Error(
    'E2E_API_BASE_URL, E2E_USERNAME and E2E_PASSWORD are required to create a synthetic patient via REST.',
  );
}

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const runId = new Date().toISOString().replace(/\D/g, '').slice(4, 14);
const givenName = `RestTest${runId}`;
const dni = `97${runId.slice(-6)}`;

async function request(path, options = {}) {
  const response = await fetch(`${openmrsBase}${path}`, {
    ...options,
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed ${response.status}: ${text}`);
  }
  return body;
}

const locations = await request('/ws/rest/v1/location?v=default&limit=1');
const locationUuid = locations.results?.[0]?.uuid;
if (!locationUuid) {
  throw new Error('No location found');
}
const generatedHistoryNumber = await request(
  '/ws/rest/v1/idgen/identifiersource/8549f706-7e85-4c1d-9424-217d50a2988b/identifier',
  { method: 'POST', body: '{}' },
);

const payload = {
  identifiers: [
    {
      identifier: generatedHistoryNumber.identifier,
      identifierType: '05a29f94-c0ed-11e2-94be-8c13b969e334',
      location: locationUuid,
      preferred: true,
    },
    {
      identifier: dni,
      identifierType: '550e8400-e29b-41d4-a716-446655440001',
      location: locationUuid,
      preferred: false,
    },
  ],
  person: {
    names: [
      {
        givenName,
        middleName: 'QA',
        familyName: 'Registro',
        familyName2: 'Conceptos',
        preferred: true,
      },
    ],
    gender: 'M',
    birthdate: '1990-02-01',
    birthdateEstimated: false,
    addresses: [
      {
        country: 'PERU',
        address1: 'LORETO',
        stateProvince: 'MAYNAS',
        countyDistrict: 'IQUITOS',
        cityVillage: 'NUEVO TEST',
        address3: 'BARRIO QA',
        address4: 'Jr Test 123',
        preferred: true,
      },
    ],
    attributes: [
      { attributeType: '14d4f066-15f5-102d-96e4-000c29c2a5d7', value: '999888777' },
      { attributeType: '8d8718c2-c2cc-11de-8d13-0010c6dffd0f', value: 'Iquitos' },
      { attributeType: '8d871f2a-c2cc-11de-8d13-0010c6dffd0f', value: '798d5304-a301-4fb9-9a55-c568ab843c2d' },
      { attributeType: '8d871386-c2cc-11de-8d13-0010c6dffd0f', value: '35299f60-660b-454f-9fae-626b17bbb616' },
      { attributeType: '8d872150-c2cc-11de-8d13-0010c6dffd0f', value: 'Español' },
      { attributeType: '8d871afc-c2cc-11de-8d13-0010c6dffd0f', value: 'Tester' },
      { attributeType: '8d87236c-c2cc-11de-8d13-0010c6dffd0f', value: '1096f1ec-9960-4834-a31c-d465b65c20e6' },
      { attributeType: '77bbb234-2312-4644-99d0-fa894d438817', value: '2b8aef4c-ee43-4c17-bc7a-dd7efce65753' },
      { attributeType: '56188294-b42c-481d-a987-4b495116c580', value: 'b76a9a24-4905-4132-a215-8a567281852a' },
      { attributeType: '374b130f-7457-476f-87b1-f182aa77c434', value: `SIS-${runId}` },
      { attributeType: '9b3df0a1-0c58-4f55-9868-9c38f1db1001', value: 'fe9c1d29-077d-4923-acc9-f49798b86b76' },
      { attributeType: '9b3df0a1-0c58-4f55-9868-9c38f1db1002', value: '703AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
      { attributeType: '9b3df0a1-0c58-4f55-9868-9c38f1db1003', value: '9b3df0a1-0c58-4f55-9868-9c38f1db2031' },
      { attributeType: '9b3df0a1-0c58-4f55-9868-9c38f1db1004', value: '9b3df0a1-0c58-4f55-9868-9c38f1db2041' },
      { attributeType: '9b3df0a1-0c58-4f55-9868-9c38f1db1005', value: '9b3df0a1-0c58-4f55-9868-9c38f1db2051' },
      { attributeType: '9b3df0a1-0c58-4f55-9868-9c38f1db1006', value: '2026-05-12 14:30' },
      { attributeType: '4697d0e6-5b24-416b-aee6-708cd9a3a1db', value: 'Responsable QA' },
      { attributeType: '70ce4571-2e2e-44da-a39f-9dae2a658606', value: '35' },
      { attributeType: 'a180fa5f-c44e-4490-a981-d7196b70c6ac', value: 'Padre' },
    ],
  },
};

const created = await request('/ws/rest/v1/patient', {
  method: 'POST',
  body: JSON.stringify(payload),
});

const full = await request(`/ws/rest/v1/patient/${created.uuid}?v=full`);

console.log(
  JSON.stringify(
    {
      input: { givenName, dni },
      generatedHistoryNumber,
      created: { uuid: created.uuid, display: created.display },
      full: {
        uuid: full.uuid,
        display: full.display,
        identifiers: full.identifiers?.map((identifier) => identifier.display),
        attributes: full.person?.attributes?.map((attribute) => ({
          type: attribute.attributeType?.display,
          value: attribute.value?.display ?? attribute.value,
        })),
      },
    },
    null,
    2,
  ),
);
