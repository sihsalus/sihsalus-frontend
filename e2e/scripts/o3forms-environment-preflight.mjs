import https from 'node:https';
import { pathToFileURL } from 'node:url';

export const devOrigin = 'https://gidis-hsc-dev.inf.pucp.edu.pe';
export const formNames = ['CE-ANAM-001-ANAMNESIS', 'CE-SOAP-001-NOTA SOAP'];
const restPath = '/openmrs/ws/rest/v1/';
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const representations = {
  session: 'custom:(authenticated,user:(retired,privileges:(name,retired)))',
  module: 'custom:(uuid,version,started)',
  form: 'custom:(uuid,name,published,retired,encounterType:(uuid,display))',
  'idgen/identifiersource': 'custom:(uuid,display,retired,identifierType:(uuid,display))',
  patientidentifiertype: 'custom:(uuid,display,retired,required,locationBehavior)',
  visittype: 'custom:(uuid,display,retired)',
  encountertype: 'custom:(uuid,display,retired)',
};
const errorCodes = new Set([
  'CONFIGURATION',
  'FORBIDDEN_REQUEST',
  'HTTP_401',
  'HTTP_403',
  'HTTP_FAILURE',
  'NETWORK',
  'INVALID_JSON',
  'RESPONSE_TOO_LARGE',
  'UNAUTHENTICATED',
  'SESSION_AUTH_METADATA_MISSING',
  'SESSION_USER_RETIRED',
  'INVALID_METADATA',
  'INCOMPLETE_METADATA',
]);
class PreflightError extends Error {}
function check(condition, code) {
  if (!condition) throw new PreflightError(code);
}
export function safeErrorCode(error) {
  return error instanceof PreflightError && errorCodes.has(error.message) ? error.message : 'UNEXPECTED_FAILURE';
}

export function readPreflightConfig(environment = process.env) {
  check(environment.O3FORMS_READONLY_PREFLIGHT === 'true', 'CONFIGURATION');
  check(environment.E2E_GATE_TARGET === 'DEV' && environment.O3FORMS_PREFLIGHT_ORIGIN === devOrigin, 'CONFIGURATION');
  const username = environment.E2E_USER_ADMIN_USERNAME;
  const password = environment.E2E_USER_ADMIN_PASSWORD;
  check(typeof username === 'string' && username.length > 0 && !/[:\r\n]/.test(username), 'CONFIGURATION');
  check(typeof password === 'string' && password.length > 0, 'CONFIGURATION');
  check(['true', 'false'].includes(environment.E2E_IGNORE_HTTPS_ERRORS), 'CONFIGURATION');
  return {
    origin: devOrigin,
    allowSelfSigned: environment.E2E_IGNORE_HTTPS_ERRORS === 'true',
    authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
  };
}

export function validateMetadataUrl(value, config) {
  const url = new URL(value);
  check(
    config.origin === devOrigin && url.origin === devOrigin && !url.username && !url.password && !url.hash,
    'FORBIDDEN_REQUEST',
  );
  if (url.pathname === '/openmrs/spa/build-info.json') {
    check(!url.search, 'FORBIDDEN_REQUEST');
    return url;
  }
  check(url.pathname.startsWith(restPath), 'FORBIDDEN_REQUEST');
  const resource = url.pathname.slice(restPath.length);
  check(
    Object.hasOwn(representations, resource) && url.searchParams.get('v') === representations[resource],
    'FORBIDDEN_REQUEST',
  );
  for (const key of url.searchParams.keys()) {
    check(
      ['v', 'limit', 'startIndex', 'q'].includes(key) && url.searchParams.getAll(key).length === 1,
      'FORBIDDEN_REQUEST',
    );
  }
  if (resource === 'session') {
    check([...url.searchParams.keys()].length === 1, 'FORBIDDEN_REQUEST');
  } else {
    check(
      url.searchParams.get('limit') === '100' &&
        /^(?:0|[1-9][0-9]{0,3})$/.test(url.searchParams.get('startIndex') ?? ''),
      'FORBIDDEN_REQUEST',
    );
    check(
      resource === 'form' ? formNames.includes(url.searchParams.get('q')) : !url.searchParams.has('q'),
      'FORBIDDEN_REQUEST',
    );
  }
  return url;
}

export function createMetadataClient(config, request = https.request) {
  return {
    async get(value) {
      const url = validateMetadataUrl(value, config);
      return new Promise((resolve, reject) => {
        const fail = (code) => reject(new PreflightError(code));
        const outgoing = request(
          url,
          {
            method: 'GET',
            rejectUnauthorized: !config.allowSelfSigned,
            headers: { Accept: 'application/json', Authorization: config.authorization, 'Cache-Control': 'no-cache' },
          },
          (response) => {
            response.on('error', () => fail('NETWORK'));
            response.on('aborted', () => fail('NETWORK'));
            if (response.statusCode !== 200) {
              response.resume();
              fail([401, 403].includes(response.statusCode) ? `HTTP_${response.statusCode}` : 'HTTP_FAILURE');
              return;
            }
            let size = 0;
            const chunks = [];
            response.on('data', (chunk) => {
              size += chunk.length;
              if (size > 2 * 1024 * 1024) {
                fail('RESPONSE_TOO_LARGE');
                response.destroy();
              } else chunks.push(chunk);
            });
            response.on('end', () => {
              try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
              } catch {
                fail('INVALID_JSON');
              }
            });
          },
        );
        outgoing.on('error', () => fail('NETWORK'));
        outgoing.setTimeout(15000, () => {
          fail('NETWORK');
          outgoing.destroy();
        });
        outgoing.end();
      });
    },
  };
}

function metadataLabel(value) {
  check(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 200 &&
      Array.from(value).every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127),
    'INVALID_METADATA',
  );
  return value;
}
function metadataIdentity(value) {
  check(value && uuidPattern.test(value.uuid ?? ''), 'INVALID_METADATA');
  return { uuid: value.uuid, display: metadataLabel(value.display) };
}
function metadataRecord(value) {
  check(typeof value.retired === 'boolean', 'INVALID_METADATA');
  return { ...metadataIdentity(value), retired: value.retired };
}
function resourceUrl(resource, startIndex = 0, name) {
  const url = new URL(`${restPath}${resource}`, devOrigin);
  url.searchParams.set('v', representations[resource]);
  if (resource !== 'session') {
    url.searchParams.set('limit', '100');
    url.searchParams.set('startIndex', String(startIndex));
  }
  if (name) url.searchParams.set('q', name);
  return url.href;
}
async function allMetadata(client, resource, name) {
  const records = [];
  for (let page = 0; page < 10; page++) {
    const result = await client.get(resourceUrl(resource, records.length, name));
    check(Array.isArray(result?.results) && result.results.length <= 100, 'INVALID_METADATA');
    check(result.links === undefined || Array.isArray(result.links), 'INVALID_METADATA');
    records.push(...result.results);
    if (!result.links?.some((link) => link.rel === 'next')) return records;
    check(result.results.length > 0, 'INCOMPLETE_METADATA');
    // Never follow server-provided URLs: pagination stays in the fixed allowlist.
  }
  throw new PreflightError('INCOMPLETE_METADATA');
}

export async function inventoryEnvironment(client, onMetadata = () => {}) {
  const report = { target: 'DEV', clinicalValidation: 'NOT_RUN' };
  const emit = (section, data) => {
    report[section] = data;
    onMetadata(section, data);
  };
  const session = await client.get(resourceUrl('session'));
  check(typeof session?.authenticated === 'boolean', 'SESSION_AUTH_METADATA_MISSING');
  check(session.authenticated === true, 'UNAUTHENTICATED');
  check(session.user && typeof session.user === 'object' && Array.isArray(session.user.privileges), 'INVALID_METADATA');
  check(session.user.retired === undefined || typeof session.user.retired === 'boolean', 'INVALID_METADATA');
  check(session.user.retired !== true, 'SESSION_USER_RETIRED');
  check(
    session.user.privileges.every(
      (entry) => entry && (entry.retired === undefined || typeof entry.retired === 'boolean'),
    ),
    'INVALID_METADATA',
  );
  const privileges = session.user.privileges
    .filter((entry) => entry.retired !== true)
    .map((entry) => metadataLabel(entry.name));
  // REST 3.5.0 /session ignores v and omits retirement flags in its fixed representation.
  // This GET-only inventory reports unknown flags; it is not an active-account/clinical-write gate.
  emit('session', {
    authenticated: true,
    retired: typeof session.user.retired === 'boolean' ? session.user.retired : null,
    privilegesRetirementKnown: session.user.privileges.every((entry) => typeof entry.retired === 'boolean'),
    privileges: [...new Set(privileges)].sort(),
  });
  const build = await client.get(`${devOrigin}/openmrs/spa/build-info.json`);
  check(/^[0-9a-f]{40}$/.test(build?.gitSha ?? ''), 'INVALID_METADATA');
  emit('frontendBuild', { gitSha: build.gitSha });
  const modules = await allMetadata(client, 'module');
  const matches = modules.filter((module) => module.uuid === 'o3forms');
  check(matches.length === 1 && /^[0-9A-Za-z.+-]{1,80}$/.test(matches[0].version ?? ''), 'INVALID_METADATA');
  emit('o3forms', {
    version: matches[0].version,
    started: typeof matches[0].started === 'boolean' ? matches[0].started : null,
  });
  emit(
    'dependentModules',
    ['webservices.rest', 'patientdocuments'].map((uuid) => {
      const dependencies = modules.filter((module) => module.uuid === uuid);
      check(dependencies.length <= 1, 'INVALID_METADATA');
      const dependency = dependencies[0];
      check(!dependency || /^[0-9A-Za-z.+-]{1,80}$/.test(dependency.version ?? ''), 'INVALID_METADATA');
      return {
        uuid,
        version: dependency?.version ?? null,
        started: typeof dependency?.started === 'boolean' ? dependency.started : null,
      };
    }),
  );
  const forms = [];
  for (const name of formNames) {
    const candidates = await allMetadata(client, 'form', name);
    const exact = candidates.filter((form) => form.name === name && form.retired === false && form.published === true);
    forms.push({
      name,
      publishedMatches: exact.map((form) => ({
        ...metadataIdentity({ uuid: form.uuid, display: name }),
        encounterType: metadataIdentity(form.encounterType),
      })),
    });
  }
  emit('forms', forms);
  const sources = await allMetadata(client, 'idgen/identifiersource');
  emit(
    'identifierSources',
    sources.map((source) => ({ ...metadataRecord(source), identifierType: metadataIdentity(source.identifierType) })),
  );
  const identifierTypes = await allMetadata(client, 'patientidentifiertype');
  emit(
    'identifierTypes',
    identifierTypes.map((type) => ({
      ...metadataRecord(type),
      required: typeof type.required === 'boolean' ? type.required : null,
      locationBehavior: ['REQUIRED', 'NOT_USED', 'OPTIONAL'].includes(type.locationBehavior)
        ? type.locationBehavior
        : null,
    })),
  );
  emit('visitTypes', (await allMetadata(client, 'visittype')).map(metadataRecord));
  emit('encounterTypes', (await allMetadata(client, 'encountertype')).map(metadataRecord));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const client = createMetadataClient(readPreflightConfig());
    await inventoryEnvironment(client, (section, data) => console.log(JSON.stringify({ section, data })));
    console.log(
      JSON.stringify({ status: 'PASSED', scope: 'READ_ONLY_METADATA', target: 'DEV', clinicalValidation: 'NOT_RUN' }),
    );
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED', code: safeErrorCode(error), clinicalValidation: 'NOT_RUN' }));
    process.exitCode = 1;
  }
}
