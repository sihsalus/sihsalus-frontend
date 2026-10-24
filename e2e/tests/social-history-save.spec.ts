import { type APIResponse, expect, type Page } from '@playwright/test';
import { test } from '../utils/e2e-native-synthetic-fixtures';
import { FixtureAuthorizationError } from '../utils/e2e-synthetic-fixtures';

// Published CE-SOC-001 1.0.0 contract; the JSON schema UUID is not its REST form UUID.
const formUuid = '76067e7a-48e5-3f69-92a4-70cf53e3e994';
const encounterTypeUuid = 'c7059f4b-385f-45e7-82ad-204e5b380196';
const cigarettesConceptUuid = '1546AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const roleName = 'Médico Responsable';

interface Encounter {
  uuid: string;
  voided: boolean;
  patient: { uuid: string };
  visit: { uuid: string };
  form: { uuid: string };
  encounterProviders: Array<{
    provider: { uuid: string };
    encounterRole: { uuid: string };
  }>;
  obs: Array<{ concept: { uuid: string }; value: number }>;
}

async function read<T>(response: APIResponse | Awaited<ReturnType<Page['waitForResponse']>>): Promise<T> {
  if ([401, 403].includes(response.status())) {
    throw new FixtureAuthorizationError('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
  }
  if (!response.ok()) throw new Error(`SOCIAL_HISTORY_REQUEST_FAILED_${response.status()}`);
  return response.json();
}

function isEncounterWrite(url: string, method: string): boolean {
  return method === 'POST' && /\/ws\/rest\/v1\/encounter(?:\/[^/]+)?\/?$/.test(new URL(url).pathname);
}

async function save(page: Page): Promise<{ uuid: string }> {
  const response = page.waitForResponse((item) => isEncounterWrite(item.url(), item.request().method()));
  await page
    .getByRole('button', { name: /^(Guardar|Save)$/ })
    .filter({ visible: true })
    .click();
  return read(await response);
}

test('social history selects a role and preserves its encounter after save, reload and edit', async ({
  page,
  api,
  nativeSyntheticFixture: fixture,
}) => {
  test.setTimeout(120_000);
  const form = await read<{
    uuid: string;
    published: boolean;
    retired: boolean;
    version: string;
  }>(await api.get(`form/${formUuid}?v=custom:(uuid,published,retired,version)`));
  expect(form).toMatchObject({
    uuid: formUuid,
    published: true,
    retired: false,
    version: '1.0.0',
  });
  const roles = await read<{
    results: Array<{ uuid: string; name: string; retired: boolean }>;
    links?: Array<{ rel: string }>;
  }>(await api.get('encounterrole?v=custom:(uuid,name,retired)&limit=100'));
  expect(roles.links?.some((link) => link.rel === 'next')).not.toBe(true);
  expect(roles.results.some((role) => !role.retired && role.name === 'Clinician')).toBe(false);
  const selectedRole = roles.results.find((role) => !role.retired && role.name === roleName);
  if (!selectedRole) throw new Error('SOCIAL_HISTORY_ROLE_UNAVAILABLE');

  const openHistory = async () => {
    await page.goto(`patient/${fixture.patientUuid}/chart/consulta-externa`);
    await page
      .getByRole('tablist', {
        name: /Pestañas de Consulta Externa|Consulta Externa tabs/i,
      })
      .getByRole('tab', { name: /Antecedentes/i })
      .click();
  };
  const roleInput = page.getByRole('combobox', {
    name: /Rol del profesional en esta atención/i,
  });
  const cigarettesInput = page.getByRole('spinbutton', {
    name: /Cigarrillos por día/i,
  });
  const history = page.getByRole('region', { name: /^Historia social$/i });
  let encounterWrites = 0;
  page.on('request', (request) => {
    if (isEncounterWrite(request.url(), request.method())) encounterWrites++;
  });

  await openHistory();
  await page.getByRole('button', { name: /Registrar historia social/i }).click();
  await expect(roleInput).toBeVisible();
  await expect(roleInput).toHaveValue('');
  await cigarettesInput.fill('0');
  await page
    .getByRole('button', { name: /^(Guardar|Save)$/ })
    .filter({ visible: true })
    .click();
  await expect(roleInput).toHaveAttribute('aria-invalid', 'true');
  await expect(cigarettesInput).toHaveValue('0');
  expect(encounterWrites).toBe(0);

  await roleInput.press('ArrowDown');
  await page.getByRole('option', { name: roleName, exact: true }).click();
  await expect(roleInput).toHaveValue(roleName);
  const created = await save(page);

  const readSaved = async (value: number) => {
    const representation =
      'custom:(uuid,voided,patient:(uuid),visit:(uuid),form:(uuid),encounterProviders:(provider:(uuid),encounterRole:(uuid)),obs:(concept:(uuid),value))';
    const saved = await read<{
      results: Encounter[];
      links?: Array<{ rel: string }>;
    }>(
      await api.get(
        `encounter?patient=${fixture.patientUuid}&encounterType=${encounterTypeUuid}&limit=20&v=${encodeURIComponent(representation)}`,
      ),
    );
    expect(saved.links?.some((link) => link.rel === 'next')).not.toBe(true);
    const encounters = saved.results.filter((item) => !item.voided && item.form?.uuid === formUuid);
    expect(encounters).toHaveLength(1);
    const encounter = encounters[0];
    if (!encounter) throw new Error('SOCIAL_HISTORY_ENCOUNTER_MISSING');
    expect(encounter).toMatchObject({
      uuid: created.uuid,
      patient: { uuid: fixture.patientUuid },
      visit: { uuid: fixture.visitUuid },
      encounterProviders: [
        {
          provider: { uuid: fixture.providerUuid },
          encounterRole: { uuid: selectedRole.uuid },
        },
      ],
    });
    expect(encounter.encounterProviders).toHaveLength(1);
    expect(encounter.obs.find((obs) => obs.concept.uuid === cigarettesConceptUuid)?.value).toBe(value);
  };
  await readSaved(0);

  await openHistory();
  await history.getByRole('button', { name: /^(Editar|Edit)$/ }).click();
  await expect(roleInput).toHaveValue(roleName);
  await expect(cigarettesInput).toHaveValue('0');
  await cigarettesInput.fill('1');
  const edited = await save(page);
  expect(edited.uuid).toBe(created.uuid);
  await readSaved(1);
  expect(encounterWrites).toBe(2);

  await openHistory();
  await history.getByRole('button', { name: /^(Editar|Edit)$/ }).click();
  await expect(roleInput).toHaveValue(roleName);
  await expect(cigarettesInput).toHaveValue('1');
  // The fixture lifecycle verifies ownership and voids this patient's observations,
  // encounters and visit before removing its identity; recovery journals remain private.
});
