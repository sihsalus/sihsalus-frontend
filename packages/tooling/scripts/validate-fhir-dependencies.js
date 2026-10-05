#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '../../..');
const frameworkFhirNames = new Set(['fhirBaseUrl', 'useFhirFetchAll', 'useFhirPagination']);

function sourceUsesOpenmrsFhir(source, filename = 'source.ts') {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const frameworkNamespaces = new Set();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== '@openmrs/esm-framework') {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (
      bindings &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some((element) => frameworkFhirNames.has((element.propertyName ?? element.name).text))
    ) {
      return true;
    }
    if (bindings && ts.isNamespaceImport(bindings)) frameworkNamespaces.add(bindings.name.text);
  }
  if (!frameworkNamespaces.size) return false;
  let usesFhir = false;
  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      frameworkNamespaces.has(node.expression.text) &&
      frameworkFhirNames.has(node.name.text)
    )
      usesFhir = true;
    if (!usesFhir) ts.forEachChild(node, visit);
  };
  visit(ast);
  return usesFhir;
}

function getSourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return getSourceFiles(filename);
    return /\.[jt]sx?$/.test(entry.name) && !/\.(?:test|spec|d)\.[jt]sx?$/.test(entry.name) ? [filename] : [];
  });
}

function findMissingFhirDependencies(appsDirectory = path.join(repoRoot, 'packages/apps')) {
  const missing = [];
  for (const app of fs.readdirSync(appsDirectory, { withFileTypes: true })) {
    if (!app.isDirectory()) continue;
    const appDirectory = path.join(appsDirectory, app.name);
    const manifestPath = path.join(appDirectory, 'src/routes.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.backendDependencies?.fhir2 || manifest.optionalBackendDependencies?.fhir2) continue;
    const consumers = getSourceFiles(path.join(appDirectory, 'src')).filter((filename) =>
      sourceUsesOpenmrsFhir(fs.readFileSync(filename, 'utf8'), filename),
    );
    if (consumers.length)
      missing.push({ app: app.name, consumers: consumers.map((filename) => path.relative(repoRoot, filename)) });
  }
  return missing;
}

function main() {
  const missing = findMissingFhirDependencies();
  if (missing.length) {
    for (const { app, consumers } of missing) {
      console.error(`${app}: declare fhir2 in src/routes.json for ${consumers.join(', ')}`);
    }
    process.exitCode = 1;
  } else {
    console.log('FHIR2 manifest dependencies are declared for all framework FHIR consumers.');
  }
}

if (require.main === module) main();

module.exports = { findMissingFhirDependencies, sourceUsesOpenmrsFhir };
