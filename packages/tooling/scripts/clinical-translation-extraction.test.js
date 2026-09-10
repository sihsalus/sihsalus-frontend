const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../..');
const appsRoot = path.join(repositoryRoot, 'packages/apps');
// Exercise the i18next dependency declared by the runtime translations workspace.
const i18next = createRequire(path.join(repositoryRoot, 'packages/libs/esm-translations/package.json'))('i18next');

function readCatalog(app, locale) {
  return JSON.parse(readFileSync(path.join(appsRoot, app, 'translations', `${locale}.json`), 'utf8'));
}

test('medication catalog extraction uses the catalogs loaded by the app and preserves reviewed Spanish', () => {
  const app = 'esm-patient-medications-app';
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'sihsalus-i18n-'));
  try {
    mkdirSync(path.join(fixture, 'translations'));
    for (const locale of ['en', 'es']) {
      writeFileSync(path.join(fixture, 'translations', `${locale}.json`), JSON.stringify(readCatalog(app, locale)));
    }

    const component = path.join(appsRoot, app, 'src/add-drug-order/drug-search/missing-catalog-item.component.tsx');
    writeFileSync(path.join(fixture, 'catalog-request.tsx'), readFileSync(component));
    execFileSync(
      process.execPath,
      [
        path.join(repositoryRoot, 'node_modules/i18next-parser/bin/cli.js'),
        'catalog-request.tsx',
        '--config',
        path.join(repositoryRoot, 'packages/tooling/scripts/i18next-parser.config.js'),
      ],
      { cwd: fixture, stdio: 'pipe', timeout: 30000 },
    );

    assert.deepEqual(readdirSync(fixture).sort(), ['catalog-request.tsx', 'translations']);
    assert.deepEqual(readdirSync(path.join(fixture, 'translations')).sort(), ['en.json', 'es.json']);
    for (const locale of ['en', 'es']) {
      const extracted = JSON.parse(readFileSync(path.join(fixture, 'translations', `${locale}.json`), 'utf8'));
      assert.deepEqual(extracted, readCatalog(app, locale));
      assert.ok(extracted.catalogRequestNotice);
      assert.ok(extracted.missingCatalogItem);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

const pluralCases = [
  {
    app: 'esm-patient-registration-app',
    key: 'bulkPatientImportManifestSubtitle',
    es: [/\bfila$/, /\bfilas$/],
    en: [/\brow$/, /\brows$/],
    variables: { hash: 'synthetic-hash' },
  },
  {
    app: 'esm-patient-search-app',
    key: 'recentlyViewedPatientsCount',
    es: [/paciente visto/, /pacientes vistos/],
    en: [/viewed patient$/, /viewed patients$/],
  },
  {
    app: 'esm-implementer-tools-app',
    key: 'missingBackendModulesCount',
    es: [/Falta .* módulo/, /Faltan .* módulos/],
    en: [/module is missing/, /modules are missing/],
  },
  {
    app: 'esm-implementer-tools-app',
    key: 'incompatibleBackendModulesCount',
    es: [/módulo backend tiene/, /módulos backend tienen/],
    en: [/module has/, /modules have/],
  },
  {
    app: 'esm-fua-app',
    key: 'fuasGeneratedSuccessfully',
    es: [/Se generó/, /Se generaron/],
    en: [/FUA form generated/, /FUA forms generated/],
  },
  {
    app: 'esm-fua-app',
    key: 'fuasGenerationFailed',
    es: [/No se pudo generar/, /No se pudieron generar/],
    en: [/FUA form could/, /FUA forms could/],
  },
  {
    app: 'esm-patient-vitals-app',
    key: 'daysOldVitals',
    es: [/día de antigüedad/, /días de antigüedad/],
    en: [/day old/, /days old/],
  },
];

for (const scenario of pluralCases) {
  for (const locale of ['en', 'es']) {
    test(`${scenario.app}: ${scenario.key} resolves ${locale} plurals without language fallback or lost variables`, async () => {
      const instance = i18next.createInstance();
      await instance.init({
        lng: locale,
        fallbackLng: false,
        resources: { [locale]: { translation: readCatalog(scenario.app, locale) } },
      });

      for (const count of [0, 1, 2, 1000000]) {
        const result = instance.t(scenario.key, { count, ...scenario.variables, returnDetails: true });
        const category = new Intl.PluralRules(locale).select(count);
        assert.equal(result.exactUsedKey, `${scenario.key}_${category}`);
        assert.equal(result.usedLng, locale);
        assert.match(result.res, scenario[locale][count === 1 ? 0 : 1]);
        assert.ok(result.res.includes(String(count)), 'the count must be interpolated');
        assert.ok(!result.res.includes('{{'), 'all interpolation variables must resolve');
        for (const value of Object.values(scenario.variables ?? {})) {
          assert.ok(result.res.includes(value));
        }
      }
    });
  }
}
