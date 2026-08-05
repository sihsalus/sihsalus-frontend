#!/usr/bin/env node

/**
 * Validates that the concept UUIDs referenced as defaults in app config
 * schemas exist on a running OpenMRS backend.
 *
 * PR #737 found 11 dead concept UUIDs by scanning DEV/QLTY by hand; this
 * script makes that check repeatable. It extracts:
 *   - every flat `Type.ConceptUuid` entry's literal or same-file constant-backed `_default` from each
 *     `packages/apps/* + packages/libs/*` config-schema.ts, and
 *   - the target (right-hand) UUIDs of `legacyConceptCompatibilityMap`
 *     defaults, which must exist for rerouted form questions to save.
 *
 * Usage:
 *   SIHSALUS_BACKEND_URL=https://dev.example/openmrs \
 *   E2E_USER_ADMIN_USERNAME=admin E2E_USER_ADMIN_PASSWORD=... \
 *   node packages/tooling/scripts/validate-concept-existence.js [--json]
 *
 * Reads .env from the repo root (same contract as sihsalus-doctor).
 * Exits 1 when any referenced concept does not exist on the server.
 */

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$|^[0-9]+A{10,}$/;
// Flat config entries only: `{ _type: Type.ConceptUuid, ..., _default: '<uuid>' }`.
const FLAT_PROPERTY_BLOCK_PATTERN = /([A-Za-z0-9_]+):\s*\{([^{}]*)\}/g;
const CONSTANT_OBJECT_PATTERN = /(?:export\s+)?const\s+([A-Za-z0-9_]+)[^=]*=\s*\{([\s\S]*?)\}\s*(?:as\s+const)?\s*;/g;
const CONSTANT_UUID_PROPERTY_PATTERN = /(?:'([^']+)'|([A-Za-z0-9_]+))\s*:\s*'([^']+)'/g;
// Matches the `defaultLegacyConceptCompatibilityMap = { ... }` assignment (the
// config-schema KEY of the same name has no `=` and is skipped by `[^=]`).
const COMPATIBILITY_MAP_PATTERN = /[Ll]egacyConceptCompatibilityMap[^={}]{0,80}=\s*\{([\s\S]*?)\}/;
const MAP_PAIR_PATTERN = /'([^']+)':\s*'([^']+)'/g;
const REQUEST_CONCURRENCY = 8;

function extractConceptReferences(source, filePath) {
  const references = [];
  const constantObjects = new Map();

  for (const objectMatch of source.matchAll(CONSTANT_OBJECT_PATTERN)) {
    const [, objectName, objectBody] = objectMatch;
    const values = new Map();
    for (const propertyMatch of objectBody.matchAll(CONSTANT_UUID_PROPERTY_PATTERN)) {
      const propertyName = propertyMatch[1] || propertyMatch[2];
      const value = propertyMatch[3];
      if (UUID_PATTERN.test(value)) {
        values.set(propertyName, value);
      }
    }
    constantObjects.set(objectName, values);
  }

  for (const match of source.matchAll(FLAT_PROPERTY_BLOCK_PATTERN)) {
    const [, key, body] = match;
    if (!body.includes('Type.ConceptUuid')) {
      continue;
    }
    const literalDefaultMatch = body.match(/_default:\s*'([^']+)'/);
    const constantDefaultMatch = body.match(/_default:\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/);
    const constantUuid = constantDefaultMatch
      ? constantObjects.get(constantDefaultMatch[1])?.get(constantDefaultMatch[2])
      : undefined;
    const uuid = literalDefaultMatch?.[1] ?? constantUuid;
    if (uuid && UUID_PATTERN.test(uuid)) {
      references.push({
        file: filePath,
        key,
        uuid,
        source: constantUuid ? 'ConceptUuid constant default' : 'ConceptUuid default',
      });
    }
  }

  const mapMatch = source.match(COMPATIBILITY_MAP_PATTERN);
  if (mapMatch) {
    for (const pair of mapMatch[1].matchAll(MAP_PAIR_PATTERN)) {
      const [, legacyUuid, targetUuid] = pair;
      if (UUID_PATTERN.test(targetUuid)) {
        references.push({
          file: filePath,
          key: `legacyConceptCompatibilityMap['${legacyUuid}']`,
          uuid: targetUuid,
          source: 'compatibility-map target',
        });
      }
    }
  }

  return references;
}

function collectConfigSchemaFiles() {
  const files = [];
  for (const group of ['apps', 'libs']) {
    const groupDir = path.join(repoRoot, 'packages', group);
    if (!fs.existsSync(groupDir)) continue;
    for (const pkg of fs.readdirSync(groupDir)) {
      const candidates = [
        path.join(groupDir, pkg, 'src', 'config-schema.ts'),
        path.join(groupDir, pkg, 'src', 'notes', 'visit-note-config-schema.ts'),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          files.push(candidate);
        }
      }
    }
  }
  return files;
}

function requestConcept(baseUrl, uuid, auth, allowSelfSigned, timeoutMs = 15_000) {
  return new Promise((resolve) => {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/ws/rest/v1/concept/${uuid}?v=custom:(uuid,display)`);
    const client = url.protocol === 'https:' ? https : http;
    const options = {
      method: 'GET',
      timeout: timeoutMs,
      headers: {
        'user-agent': 'sihsalus-validate-concepts',
        ...(auth ? { authorization: `Basic ${Buffer.from(auth).toString('base64')}` } : {}),
      },
    };
    if (url.protocol === 'https:') {
      options.rejectUnauthorized = !allowSelfSigned;
    }

    const request = client.request(url, options, (response) => {
      response.resume();
      resolve({ status: response.statusCode });
    });
    request.on('timeout', () => {
      request.destroy(new Error('timeout'));
    });
    request.on('error', (error) => resolve({ error: error.message }));
    request.end();
  });
}

async function validateConcepts(references, { baseUrl, auth, allowSelfSigned }) {
  const uniqueUuids = [...new Set(references.map((ref) => ref.uuid))];
  const resultsByUuid = new Map();

  let cursor = 0;
  async function worker() {
    while (cursor < uniqueUuids.length) {
      const uuid = uniqueUuids[cursor++];
      resultsByUuid.set(uuid, await requestConcept(baseUrl, uuid, auth, allowSelfSigned));
    }
  }
  await Promise.all(Array.from({ length: Math.min(REQUEST_CONCURRENCY, uniqueUuids.length) }, worker));

  return references.map((ref) => {
    const result = resultsByUuid.get(ref.uuid) ?? {};
    const status = result.error
      ? 'error'
      : result.status === 200
        ? 'exists'
        : result.status === 404
          ? 'missing'
          : 'error';
    return { ...ref, status, detail: result.error ?? `HTTP ${result.status}` };
  });
}

async function preflightBackend(baseUrl, uuid, auth, allowSelfSigned) {
  const result = await requestConcept(baseUrl, uuid, auth, allowSelfSigned, 5_000);
  if (result.error) {
    throw new Error(`OpenMRS preflight failed: ${result.error}`);
  }
  if (result.status === 401 || result.status === 403) {
    throw new Error(`OpenMRS preflight failed: HTTP ${result.status}; check the configured credentials.`);
  }
  if (!result.status || result.status >= 500) {
    throw new Error(`OpenMRS preflight failed: HTTP ${result.status ?? 'unknown'}`);
  }
}

async function main() {
  try {
    require('dotenv').config({ path: path.join(repoRoot, '.env'), quiet: true });
  } catch {
    // dotenv is optional; environment variables may be provided directly.
  }

  const asJson = process.argv.includes('--json');
  const baseUrl = process.env.SIHSALUS_BACKEND_URL;
  if (!baseUrl) {
    console.error('[validate:concepts] SIHSALUS_BACKEND_URL is required (e.g. https://dev.example/openmrs).');
    process.exit(2);
  }
  const username = process.env.E2E_USER_ADMIN_USERNAME || process.env.OPENMRS_USERNAME;
  const password = process.env.E2E_USER_ADMIN_PASSWORD || process.env.OPENMRS_PASSWORD;
  const auth = username && password ? `${username}:${password}` : null;
  const allowSelfSigned = process.env.SIHSALUS_ALLOW_SELF_SIGNED_TLS === 'true';

  const references = collectConfigSchemaFiles().flatMap((file) =>
    extractConceptReferences(fs.readFileSync(file, 'utf8'), path.relative(repoRoot, file)),
  );

  if (!references.length) {
    throw new Error('No configured concept references were found.');
  }
  await preflightBackend(baseUrl, references[0].uuid, auth, allowSelfSigned);

  const validated = await validateConcepts(references, { baseUrl, auth, allowSelfSigned });
  const missing = validated.filter((ref) => ref.status === 'missing');
  const errored = validated.filter((ref) => ref.status === 'error');

  if (asJson) {
    console.log(JSON.stringify({ total: validated.length, missing, errored }, null, 2));
  } else {
    console.log(
      `[validate:concepts] Checked ${validated.length} concept references (${new Set(validated.map((r) => r.uuid)).size} unique) against ${baseUrl}`,
    );
    for (const ref of missing) {
      console.error(`  MISSING  ${ref.uuid}  ${ref.key}  (${ref.file})`);
    }
    for (const ref of errored) {
      console.error(`  ERROR    ${ref.uuid}  ${ref.key}  (${ref.file}): ${ref.detail}`);
    }
    if (!missing.length && !errored.length) {
      console.log('[validate:concepts] All referenced concepts exist.');
    }
  }

  process.exit(missing.length || errored.length ? 1 : 0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[validate:concepts] ${error.stack || error.message}`);
    process.exit(2);
  });
}

module.exports = { extractConceptReferences, collectConfigSchemaFiles };
