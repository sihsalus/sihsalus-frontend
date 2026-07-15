const acorn = require('acorn');
const eslintScope = require('eslint-scope');

function findUnboundGlobalReferences(source, identifiers) {
  const identifierSet = new Set(identifiers);
  const ast = acorn.parse(source, {
    ecmaVersion: 'latest',
    locations: true,
    ranges: true,
    sourceType: 'script',
  });
  const scopeManager = eslintScope.analyze(ast, {
    ecmaVersion: 2022,
    ignoreEval: true,
    optimistic: true,
    sourceType: 'script',
  });

  return (scopeManager.globalScope?.through ?? [])
    .filter((reference) => identifierSet.has(reference.identifier.name))
    .map((reference) => ({
      column: reference.identifier.loc?.start.column ?? 0,
      line: reference.identifier.loc?.start.line ?? 0,
      name: reference.identifier.name,
    }));
}

function findUnboundReactReferences(source) {
  return findUnboundGlobalReferences(source, ['React']);
}

module.exports = {
  findUnboundGlobalReferences,
  findUnboundReactReferences,
};
