#!/usr/bin/env node
/**
 * Regression guard for technical errors rendered to users.
 *
 * The repository still has legacy occurrences, so this guard compares the
 * changed production sources with a Git base and rejects increases per changed
 * or renamed file. It intentionally allows validation messages that can be
 * traced to recognized form APIs, such as `fieldState.error.message` and
 * `formState.errors.email.message` from React Hook Form.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '../../..');
const sourceRoots = ['packages/apps', 'packages/libs', 'packages/templates'];
const notificationSinks = new Set([
  'dispatchActionableNotificationShown',
  'dispatchNotificationShown',
  'dispatchSnackbarShown',
  'dispatchToastShown',
  'showActionableNotification',
  'showNotification',
  'showSnackbar',
  'showToast',
]);
const safeUserFacingErrorNormalizers = new Set([
  'getUserFacingErrorMessage',
  'getUserFacingQueueErrorMessage',
  'useUserFacingErrorMessage',
]);
const formHookExports = new Set(['useController', 'useForm', 'useFormContext']);
const permittedNotificationModules = new Set([
  '@openmrs/esm-framework',
  '@openmrs/esm-framework/src/internal',
  '@openmrs/esm-globals',
]);
const technicalErrorSinks = new Set(['captureError', 'captureException', 'logError', 'reportError', 'reportException']);
const loggingMethods = new Set(['debug', 'error', 'info', 'log', 'trace', 'warn']);
const notificationProperties = new Set([
  'actionButtonLabel',
  'content',
  'description',
  'message',
  'subtitle',
  'text',
  'title',
]);
const visibleJsxProperties = new Set([
  'content',
  'description',
  'helperText',
  'invalidText',
  'label',
  'message',
  'subtitle',
  'text',
  'title',
]);
const technicalProperties = new Set([
  'code',
  'message',
  'name',
  'rawMessage',
  'reason',
  'responseBody',
  'stack',
  'status',
  'statusText',
  'translatedMessage',
]);
const ignoredPathSegments = [
  '/__fixtures__/',
  '/__mocks__/',
  '/__tests__/',
  '/fixtures/',
  '/mocks/',
  '/stories/',
  '/test-utils/',
  '/tests/',
];

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const comparison = resolveComparison(args);
  const changes = getChangedSourceFiles(comparison);
  if (changes.length === 0) {
    console.log('[error-exposure] No changed production sources to inspect.');
    return;
  }

  const baseFindings = [];
  const headFindings = [];
  const findingsByChange = [];

  for (const change of changes) {
    const baseFindingsForChange = [];
    const headFindingsForChange = [];
    if (change.basePath) {
      const source = readSource(comparison.baseRef, change.basePath);
      if (source !== null) {
        baseFindingsForChange.push(...analyzeSource(source, change.basePath));
      }
    }

    if (change.headPath) {
      const source = comparison.headRef
        ? readSource(comparison.headRef, change.headPath)
        : readWorkingTreeSource(change.headPath);
      if (source !== null) {
        headFindingsForChange.push(...analyzeSource(source, change.headPath));
      }
    }
    baseFindings.push(...baseFindingsForChange);
    headFindings.push(...headFindingsForChange);
    findingsByChange.push({ baseFindings: baseFindingsForChange, headFindings: headFindingsForChange });
  }

  const regressions = findRegressionsByChange(findingsByChange);
  if (regressions.length === 0) {
    const reduction = baseFindings.length - headFindings.length;
    const detail = reduction > 0 ? ` (${reduction} legacy exposure${reduction === 1 ? '' : 's'} removed)` : '';
    console.log(
      `[error-exposure] OK: ${changes.length} changed source file${changes.length === 1 ? '' : 's'}; ` +
        `${headFindings.length} exposure${headFindings.length === 1 ? '' : 's'} remain in the changed scope${detail}.`,
    );
    return;
  }

  console.error(
    `[error-exposure] Found ${regressions.length} new user-facing technical error exposure${
      regressions.length === 1 ? '' : 's'
    }:\n`,
  );
  for (const finding of regressions) {
    console.error(`  ${finding.file}:${finding.line}:${finding.column}  ${finding.sink} (${finding.slot})`);
    console.error(`    ${finding.text}`);
  }
  console.error('\nPass errors through the shared user-facing error normalizer before rendering them.');
  console.error(
    'Controlled validation traced to a recognized form API remains allowed (for example, fieldState.error.message).',
  );
  console.error(
    'For an intentional diagnostic UI, add `error-exposure-guard-ignore -- <reason>` on the same or preceding line.',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { base: 'HEAD', head: '', help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') {
      args.base = requireArgument(argv, index, arg);
      index += 1;
    } else if (arg === '--head') {
      args.head = requireArgument(argv, index, arg);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function requireArgument(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a Git reference.`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: yarn validate:error-exposure [--base <git-ref>] [--head <git-ref>]

Examples:
- yarn validate:error-exposure
- yarn validate:error-exposure --base origin/main
- yarn validate:error-exposure --base origin/main --head HEAD

Without --head, the guard compares the working tree with --base (HEAD by default).`);
}

function resolveComparison(args) {
  if (!args.head) {
    verifyGitRef(args.base);
    return { baseRef: args.base, headRef: '' };
  }

  verifyGitRef(args.head);
  let base = args.base;
  if (/^0+$/.test(base)) {
    base = `${args.head}^`;
  }
  verifyGitRef(base);

  const mergeBase = runGit(['merge-base', base, args.head]).trim();
  if (!mergeBase) {
    throw new Error(`Unable to determine a merge base for ${base} and ${args.head}.`);
  }
  return { baseRef: mergeBase, headRef: args.head };
}

function verifyGitRef(ref) {
  const result = spawnSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Unknown Git reference: ${ref}`);
  }
}

function getChangedSourceFiles(comparison) {
  const rangeArgs = comparison.headRef ? [comparison.baseRef, comparison.headRef] : [comparison.baseRef];
  const output = runGit(['diff', '--name-status', '-z', '--find-renames', ...rangeArgs, '--', ...sourceRoots]);
  const changes = parseNameStatus(output).filter(
    (change) =>
      (change.basePath && isProductionSource(change.basePath)) ||
      (change.headPath && isProductionSource(change.headPath)),
  );

  if (!comparison.headRef) {
    const trackedHeadPaths = new Set(changes.map((change) => change.headPath).filter(Boolean));
    const untracked = runGit(['ls-files', '--others', '--exclude-standard', '-z', '--', ...sourceRoots])
      .split('\0')
      .filter(Boolean)
      .filter(isProductionSource);
    for (const headPath of untracked) {
      if (!trackedHeadPaths.has(headPath)) {
        changes.push({ basePath: '', headPath });
      }
    }
  }

  return changes;
}

function parseNameStatus(output) {
  const fields = output.split('\0').filter(Boolean);
  const changes = [];

  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    if (status.startsWith('R') || status.startsWith('C')) {
      changes.push({ basePath: fields[index++], headPath: fields[index++] });
    } else if (status === 'A') {
      changes.push({ basePath: '', headPath: fields[index++] });
    } else if (status === 'D') {
      changes.push({ basePath: fields[index++], headPath: '' });
    } else {
      const file = fields[index++];
      changes.push({ basePath: file, headPath: file });
    }
  }

  return changes;
}

function isProductionSource(file) {
  const normalized = `/${file.replace(/\\/g, '/')}`;
  if (!/\.[cm]?[jt]sx?$/.test(normalized) || /\.d\.[cm]?ts$/.test(normalized)) {
    return false;
  }
  if (/\.(spec|test|stories)\.[cm]?[jt]sx?$/.test(normalized)) {
    return false;
  }
  return !ignoredPathSegments.some((segment) => normalized.includes(segment));
}

function readSource(ref, file) {
  const result = spawnSync('git', ['show', `${ref}:${file}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status === 0) {
    return result.stdout;
  }
  return null;
}

function readWorkingTreeSource(file) {
  const absolutePath = path.join(repoRoot, file);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : null;
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed.`);
  }
  return result.stdout;
}

function analyzeSource(source, file) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const findings = [];
  const variableDeclarations = collectVariableDeclarations(sourceFile);
  const context = {
    imports: collectImportBindings(sourceFile),
    variableDeclarations,
  };

  function addFinding(expression, sink, slot, category) {
    const unsafeNode = findTechnicalExposure(expression, sourceFile, context);
    if (!unsafeNode) {
      return;
    }

    const position = sourceFile.getLineAndCharacterOfPosition(unsafeNode.getStart(sourceFile));
    if (hasIgnoreDirective(source, position.line)) {
      return;
    }

    findings.push({
      category,
      column: position.character + 1,
      exactKey: `${category}:${slot}:${normalizeExpression(unsafeNode.getText(sourceFile))}`,
      file,
      line: position.line + 1,
      sink,
      slot,
      text: compactText(expression.getText(sourceFile)),
    });
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const sink = getNotificationSink(node.expression, node, sourceFile, context);
      if (sink) {
        inspectNotificationCall(node, sink, addFinding);
      }
    }

    if (ts.isJsxSpreadAttribute(node)) {
      addFinding(node.expression, 'JSX spread', 'props', 'jsx');
    } else if (ts.isJsxExpression(node) && node.expression) {
      if (ts.isJsxAttribute(node.parent)) {
        const slot = node.parent.name.getText(sourceFile);
        if (visibleJsxProperties.has(slot)) {
          addFinding(node.expression, 'JSX attribute', slot, 'jsx');
        }
      } else if (isRenderedJsxChild(node)) {
        addFinding(node.expression, 'JSX child', 'children', 'jsx');
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return deduplicateFindings(findings);
}

function inspectNotificationCall(call, sink, addFinding) {
  for (const argument of call.arguments) {
    const expression = unwrapExpression(argument);
    if (ts.isObjectLiteralExpression(expression)) {
      for (const property of expression.properties) {
        if (ts.isSpreadAssignment(property)) {
          addFinding(property.expression, sink, 'descriptor', 'notification');
          continue;
        }

        const name = getObjectPropertyName(property);
        if (!name || !notificationProperties.has(name)) {
          continue;
        }
        if (ts.isPropertyAssignment(property)) {
          addFinding(property.initializer, sink, name, 'notification');
        } else if (ts.isShorthandPropertyAssignment(property)) {
          addFinding(property.name, sink, name, 'notification');
        }
      }
    } else {
      addFinding(expression, sink, 'argument', 'notification');
    }
  }
}

function findTechnicalExposure(expression, sourceFile, context, seen = new Set()) {
  const node = unwrapExpression(expression);

  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    if (isStaticallySafeCopy(node, node, sourceFile, context)) {
      return null;
    }
    const chain = getAccessChain(node, sourceFile);
    if (
      isControlledValidation(node, chain, sourceFile, context) ||
      isDerivedFromSafeNormalizer(node, node, sourceFile, context, seen)
    ) {
      return null;
    }
    const leaf = chain.at(-1) ?? '';
    if (technicalProperties.has(leaf) && isErrorLikeChain(chain)) {
      return node;
    }
    return null;
  }

  if (ts.isIdentifier(node)) {
    if (isDerivedFromSafeNormalizer(node, node, sourceFile, context, seen)) {
      return null;
    }
    if (isDirectErrorIdentifier(node.text) && !isControlledValidation(node, [node.text], sourceFile, context)) {
      return node;
    }

    if (seen.has(node.text)) {
      return null;
    }
    const declaration = findNearestVariableDeclaration(context.variableDeclarations.get(node.text), node, sourceFile);
    if (declaration?.initializer) {
      const nextSeen = new Set(seen).add(node.text);
      return findTechnicalExposure(declaration.initializer, sourceFile, context, nextSeen);
    }
    return null;
  }

  if (ts.isCallExpression(node)) {
    const callee = getCalleeName(node.expression);
    if (isTechnicalErrorSink(node.expression)) {
      return null;
    }
    if ((callee === 'toString' || callee === 'toLocaleString') && ts.isPropertyAccessExpression(node.expression)) {
      return findTechnicalExposure(node.expression.expression, sourceFile, context, seen);
    }

    const isSafeNormalizer = isPermittedSafeNormalizerCall(node, sourceFile, context);
    const firstArgumentToInspect = isSafeNormalizer ? 1 : 0;
    for (const argument of node.arguments.slice(firstArgumentToInspect)) {
      const unsafe = findTechnicalExposure(argument, sourceFile, context, seen);
      if (unsafe) {
        return unsafe;
      }
    }
    if (!isSafeNormalizer && ts.isPropertyAccessExpression(node.expression)) {
      return findTechnicalExposure(node.expression.expression, sourceFile, context, seen);
    }
    return null;
  }

  if (ts.isConditionalExpression(node)) {
    return (
      findTechnicalExposure(node.whenTrue, sourceFile, context, seen) ??
      findTechnicalExposure(node.whenFalse, sourceFile, context, seen)
    );
  }

  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return findTechnicalExposure(node.right, sourceFile, context, seen);
    }
    if (
      node.operatorToken.kind !== ts.SyntaxKind.BarBarToken &&
      node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken &&
      node.operatorToken.kind !== ts.SyntaxKind.PlusToken &&
      node.operatorToken.kind !== ts.SyntaxKind.CommaToken
    ) {
      return null;
    }
    return (
      findTechnicalExposure(node.left, sourceFile, context, seen) ??
      findTechnicalExposure(node.right, sourceFile, context, seen)
    );
  }

  if (ts.isTemplateExpression(node)) {
    for (const span of node.templateSpans) {
      const unsafe = findTechnicalExposure(span.expression, sourceFile, context, seen);
      if (unsafe) {
        return unsafe;
      }
    }
    return null;
  }

  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      const initializer = ts.isPropertyAssignment(property)
        ? property.initializer
        : ts.isShorthandPropertyAssignment(property)
          ? property.name
          : ts.isSpreadAssignment(property)
            ? property.expression
            : null;
      if (initializer) {
        const unsafe = findTechnicalExposure(initializer, sourceFile, context, seen);
        if (unsafe) {
          return unsafe;
        }
      }
    }
    return null;
  }

  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      const unsafe = findTechnicalExposure(element, sourceFile, context, seen);
      if (unsafe) {
        return unsafe;
      }
    }
  }

  return null;
}

function isStaticallySafeCopy(expression, useNode, sourceFile, context, seen = new Set()) {
  const node = unwrapExpression(expression);
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) {
    return true;
  }
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }
  const nodeKey = `${node.kind}:${node.pos}:${node.end}`;
  if (seen.has(nodeKey)) {
    return false;
  }
  const nextSeen = new Set(seen).add(nodeKey);

  if (ts.isIdentifier(node)) {
    const declaration = findNearestVariableDeclaration(
      context.variableDeclarations.get(node.text),
      useNode,
      sourceFile,
    );
    return declaration?.initializer
      ? isStaticallySafeCopy(declaration.initializer, declaration, sourceFile, context, nextSeen)
      : false;
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const initializer = resolveObjectPropertyInitializer(node, useNode, sourceFile, context, nextSeen);
    return initializer ? isStaticallySafeCopy(initializer, node, sourceFile, context, nextSeen) : false;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return (
      isStaticallySafeCopy(node.left, node, sourceFile, context, nextSeen) &&
      isStaticallySafeCopy(node.right, node, sourceFile, context, nextSeen)
    );
  }
  if (ts.isConditionalExpression(node)) {
    return (
      isStaticallySafeCopy(node.whenTrue, node, sourceFile, context, nextSeen) &&
      isStaticallySafeCopy(node.whenFalse, node, sourceFile, context, nextSeen)
    );
  }
  return false;
}

function resolveObjectPropertyInitializer(access, useNode, sourceFile, context, seen) {
  const propertyName = ts.isPropertyAccessExpression(access)
    ? access.name.text
    : access.argumentExpression && ts.isStringLiteralLike(unwrapExpression(access.argumentExpression))
      ? unwrapExpression(access.argumentExpression).text
      : '';
  if (!propertyName) {
    return null;
  }

  const object = resolveObjectLiteral(access.expression, useNode, sourceFile, context, seen);
  if (!object) {
    return null;
  }
  const property = object.properties.find((candidate) => getObjectPropertyName(candidate) === propertyName);
  if (!property) {
    return null;
  }
  if (ts.isPropertyAssignment(property)) {
    return property.initializer;
  }
  if (ts.isShorthandPropertyAssignment(property)) {
    return property.name;
  }
  return null;
}

function resolveObjectLiteral(expression, useNode, sourceFile, context, seen) {
  const node = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(node)) {
    return node;
  }
  if (ts.isIdentifier(node)) {
    const declaration = findNearestVariableDeclaration(
      context.variableDeclarations.get(node.text),
      useNode,
      sourceFile,
    );
    const bindingKey = declaration ? `binding:${node.text}:${declaration.pos}` : '';
    if (!declaration?.initializer || seen.has(bindingKey)) {
      return null;
    }
    return resolveObjectLiteral(
      declaration.initializer,
      declaration,
      sourceFile,
      context,
      new Set(seen).add(bindingKey),
    );
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const initializer = resolveObjectPropertyInitializer(node, useNode, sourceFile, context, seen);
    return initializer ? resolveObjectLiteral(initializer, node, sourceFile, context, seen) : null;
  }
  return null;
}

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function getAccessChain(node, sourceFile) {
  const names = [];
  let current = node;

  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    if (ts.isPropertyAccessExpression(current)) {
      names.unshift(current.name.text);
    } else if (current.argumentExpression) {
      const argument = unwrapExpression(current.argumentExpression);
      if (ts.isStringLiteralLike(argument)) {
        names.unshift(argument.text);
      }
    }
    current = unwrapExpression(current.expression);
  }

  if (ts.isIdentifier(current)) {
    names.unshift(current.text);
  } else if (ts.isCallExpression(current)) {
    names.unshift(getCalleeName(current.expression));
  } else {
    names.unshift(current.getText(sourceFile));
  }
  return names;
}

function isErrorLikeChain(chain) {
  const owners = chain.slice(0, -1);
  return (
    chain.some(isErrorLikeName) ||
    owners.some(
      (part) =>
        /^(cause|failure|fault|issue|problem|reason|rejection)$/i.test(part) ||
        part === 'responseBody' ||
        part === 'rawMessage' ||
        part === 'globalErrors',
    )
  );
}

function isErrorLikeName(name) {
  return /error|exception/i.test(name) || /^(e|err)$/i.test(name);
}

function isDirectErrorIdentifier(name) {
  if (/message|description|label|text|title/i.test(name) || /^(can|did|has|is|should|show|will)[A-Z_]/.test(name)) {
    return false;
  }
  return (
    /^(cause|e|err|error|exception|failure|fault|problem|rejection)$/i.test(name) ||
    /Error$/.test(name) ||
    /^error[A-Z_]/.test(name)
  );
}

function isControlledValidation(node, chain, sourceFile, context) {
  const rootExpression = getRootAccessExpression(node);
  if (isFormDerivedExpression(rootExpression, node, sourceFile, context)) {
    return true;
  }

  const rootName = chain[0] ?? '';
  return (
    isControllerRenderValidation(node, rootName, sourceFile, context) ||
    isFormErrorIterationValue(node, rootName, sourceFile, context)
  );
}

function getRootAccessExpression(expression) {
  let current = unwrapExpression(expression);
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = unwrapExpression(current.expression);
  }
  return current;
}

function isFormDerivedExpression(expression, useNode, sourceFile, context, seen = new Set()) {
  const node = unwrapExpression(expression);
  if (ts.isCallExpression(node)) {
    const symbol = resolveImportedSymbol(node.expression, node, sourceFile, context);
    return symbol?.moduleSpecifier === 'react-hook-form' && formHookExports.has(symbol.importedName);
  }

  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    return isFormDerivedExpression(node.expression, useNode, sourceFile, context, seen);
  }

  if (!ts.isIdentifier(node) || seen.has(node.text)) {
    return false;
  }

  const declaration = findNearestVariableDeclaration(context.variableDeclarations.get(node.text), useNode, sourceFile);
  if (declaration?.initializer) {
    const nextSeen = new Set(seen).add(node.text);
    return isFormDerivedExpression(declaration.initializer, declaration, sourceFile, context, nextSeen);
  }

  const parameter = findEnclosingParameterBinding(node.text, useNode);
  return parameter ? hasRecognizedFormType(parameter, sourceFile) : false;
}

function isControllerRenderValidation(node, rootName, sourceFile, context) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      if (isControllerRenderCallback(current, sourceFile, context)) {
        const binding = current.parameters
          .flatMap((parameter) => getBindingEntries(parameter.name))
          .find((entry) => entry.localName === rootName);
        if (binding?.path[0] === 'fieldState') {
          return true;
        }
      }
    }
    current = current.parent;
  }
  return false;
}

function isControllerRenderCallback(callback, sourceFile, context) {
  const expression = callback.parent;
  if (!ts.isJsxExpression(expression) || !ts.isJsxAttribute(expression.parent)) {
    return false;
  }
  const attribute = expression.parent;
  if (attribute.name.getText(sourceFile) !== 'render') {
    return false;
  }

  const attributes = attribute.parent;
  const openingElement = attributes?.parent;
  if (!openingElement || (!ts.isJsxOpeningElement(openingElement) && !ts.isJsxSelfClosingElement(openingElement))) {
    return false;
  }

  const symbol = resolveImportedSymbol(openingElement.tagName, callback, sourceFile, context);
  return symbol?.moduleSpecifier === 'react-hook-form' && symbol.importedName === 'Controller';
}

function isFormErrorIterationValue(node, rootName, sourceFile, context) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const bindsRoot = current.parameters.some((parameter) =>
        getBindingEntries(parameter.name).some((entry) => entry.localName === rootName),
      );
      const call = current.parent;
      if (
        bindsRoot &&
        ts.isCallExpression(call) &&
        ts.isPropertyAccessExpression(call.expression) &&
        /^(every|filter|find|flatMap|forEach|map|reduce|some)$/.test(call.expression.name.text) &&
        containsFormDerivedExpression(call.expression.expression, call, sourceFile, context)
      ) {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

function containsFormDerivedExpression(expression, useNode, sourceFile, context) {
  const node = unwrapExpression(expression);
  if (isFormDerivedExpression(node, useNode, sourceFile, context)) {
    return true;
  }
  if (ts.isCallExpression(node)) {
    return (
      node.arguments.some((argument) => containsFormDerivedExpression(argument, node, sourceFile, context)) ||
      (ts.isPropertyAccessExpression(node.expression) &&
        containsFormDerivedExpression(node.expression.expression, node, sourceFile, context))
    );
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    return containsFormDerivedExpression(node.expression, node, sourceFile, context);
  }
  return false;
}

function findEnclosingParameterBinding(name, useNode) {
  let current = useNode.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) {
      const parameter = current.parameters.find((candidate) => getBindingNames(candidate.name).includes(name));
      if (parameter) {
        return parameter;
      }
    }
    current = current.parent;
  }
  return null;
}

function hasRecognizedFormType(parameter, sourceFile) {
  const typeNodes = [parameter.type];
  const callback = parameter.parent;
  if (
    (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
    ts.isVariableDeclaration(callback.parent) &&
    callback.parent.initializer === callback
  ) {
    typeNodes.push(callback.parent.type);
  }

  return typeNodes
    .filter(Boolean)
    .some((typeNode) =>
      /\b(?:ControllerFieldState|FieldError|FieldErrors|FormFieldInputProps|FormState)\b/.test(
        typeNode.getText(sourceFile),
      ),
    );
}

function getBindingEntries(name, path = []) {
  if (ts.isIdentifier(name)) {
    return [{ localName: name.text, path }];
  }

  const entries = [];
  name.elements.forEach((element, index) => {
    if (!ts.isBindingElement(element)) {
      return;
    }
    const propertyName = element.propertyName
      ? element.propertyName.getText()
      : ts.isIdentifier(element.name)
        ? element.name.text
        : String(index);
    entries.push(...getBindingEntries(element.name, [...path, propertyName]));
  });
  return entries;
}

function collectVariableDeclarations(sourceFile) {
  const declarations = new Map();

  function visit(node) {
    if (ts.isVariableDeclaration(node)) {
      const names = getBindingNames(node.name);
      for (const name of names) {
        const existing = declarations.get(name) ?? [];
        existing.push(node);
        declarations.set(name, existing);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return declarations;
}

function collectImportBindings(sourceFile) {
  const named = new Map();
  const namespaces = new Map();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) {
      continue;
    }
    const moduleSpecifier = statement.moduleSpecifier.text;
    const importClause = statement.importClause;
    if (!importClause) {
      continue;
    }

    if (importClause.name) {
      named.set(importClause.name.text, { importedName: 'default', moduleSpecifier });
    }
    if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
      namespaces.set(importClause.namedBindings.name.text, moduleSpecifier);
    } else if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
      for (const element of importClause.namedBindings.elements) {
        named.set(element.name.text, {
          importedName: element.propertyName?.text ?? element.name.text,
          moduleSpecifier,
        });
      }
    }
  }

  return { named, namespaces };
}

function getBindingNames(name) {
  if (ts.isIdentifier(name)) {
    return [name.text];
  }
  return name.elements.flatMap((element) => (ts.isBindingElement(element) ? getBindingNames(element.name) : []));
}

function findNearestVariableDeclaration(declarations, useNode, sourceFile) {
  if (!declarations) {
    return null;
  }
  const position = useNode.getStart(sourceFile);
  return declarations
    .filter(
      (declaration) =>
        declaration.getStart(sourceFile) < position && isAncestor(getEnclosingFunction(declaration), useNode),
    )
    .sort((left, right) => right.getStart() - left.getStart())[0];
}

function resolveImportedSymbol(expression, useNode, sourceFile, context, seen = new Set()) {
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    if (seen.has(node.text)) {
      return null;
    }

    const declaration = findNearestVariableDeclaration(
      context.variableDeclarations.get(node.text),
      useNode,
      sourceFile,
    );
    if (declaration) {
      if (!declaration.initializer) {
        return null;
      }
      return resolveImportedSymbol(
        declaration.initializer,
        declaration,
        sourceFile,
        context,
        new Set(seen).add(node.text),
      );
    }
    if (findEnclosingParameterBinding(node.text, useNode)) {
      return null;
    }

    const namedImport = context.imports.named.get(node.text);
    if (namedImport) {
      return namedImport;
    }
    const namespaceModule = context.imports.namespaces.get(node.text);
    return namespaceModule ? { importedName: '*', moduleSpecifier: namespaceModule } : null;
  }

  if (ts.isPropertyAccessExpression(node)) {
    const owner = resolveImportedSymbol(node.expression, useNode, sourceFile, context, seen);
    return owner?.importedName === '*'
      ? { importedName: node.name.text, moduleSpecifier: owner.moduleSpecifier }
      : null;
  }

  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const argument = unwrapExpression(node.argumentExpression);
    if (ts.isStringLiteralLike(argument)) {
      const owner = resolveImportedSymbol(node.expression, useNode, sourceFile, context, seen);
      return owner?.importedName === '*'
        ? { importedName: argument.text, moduleSpecifier: owner.moduleSpecifier }
        : null;
    }
  }

  return null;
}

function isPermittedSafeNormalizerCall(call, sourceFile, context) {
  const symbol = resolveImportedSymbol(call.expression, call, sourceFile, context);
  if (!symbol || !safeUserFacingErrorNormalizers.has(symbol.importedName)) {
    return false;
  }

  if (symbol.importedName === 'getUserFacingErrorMessage') {
    return (
      symbol.moduleSpecifier === '@openmrs/esm-error-handling' || symbol.moduleSpecifier === '@openmrs/esm-framework'
    );
  }
  if (symbol.importedName === 'getUserFacingQueueErrorMessage') {
    return /(?:^|\/)queue-entry-error\.utils(?:\.[cm]?[jt]s)?$/.test(symbol.moduleSpecifier);
  }
  return /(?:^|\/)useUserFacingErrorMessage(?:\.[cm]?[jt]s)?$/.test(symbol.moduleSpecifier);
}

function isDerivedFromSafeNormalizer(expression, useNode, sourceFile, context, seen = new Set()) {
  const node = unwrapExpression(expression);
  if (ts.isCallExpression(node)) {
    if (isPermittedSafeNormalizerCall(node, sourceFile, context)) {
      return node.arguments.slice(1).every((argument) => !findTechnicalExposure(argument, sourceFile, context, seen));
    }
    if (ts.isPropertyAccessExpression(node.expression)) {
      return isDerivedFromSafeNormalizer(node.expression.expression, useNode, sourceFile, context, seen);
    }
    return false;
  }

  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    return isDerivedFromSafeNormalizer(node.expression, useNode, sourceFile, context, seen);
  }

  if (!ts.isIdentifier(node) || seen.has(node.text)) {
    return false;
  }

  const declaration = findNearestVariableDeclaration(context.variableDeclarations.get(node.text), useNode, sourceFile);
  if (!declaration?.initializer) {
    return false;
  }
  const nextSeen = new Set(seen).add(node.text);
  return isDerivedFromSafeNormalizer(declaration.initializer, declaration, sourceFile, context, nextSeen);
}

function getEnclosingFunction(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) {
      return current;
    }
    current = current.parent;
  }
  return current;
}

function isAncestor(candidate, node) {
  let current = node;
  while (current) {
    if (current === candidate) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function getCalleeName(expression) {
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    return node.text;
  }
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }
  return '';
}

function getNotificationSink(expression, useNode, sourceFile, context) {
  const symbol = resolveImportedSymbol(expression, useNode, sourceFile, context);
  if (
    symbol &&
    notificationSinks.has(symbol.importedName) &&
    permittedNotificationModules.has(symbol.moduleSpecifier)
  ) {
    return symbol.importedName;
  }

  const directName = getCalleeName(expression);
  return notificationSinks.has(directName) ? directName : '';
}

function isTechnicalErrorSink(expression) {
  const path = getStaticAccessPath(expression);
  const method = path.at(-1) ?? '';
  if (technicalErrorSinks.has(method)) {
    return true;
  }

  const owner = path.at(-2) ?? '';
  return loggingMethods.has(method) && (owner === 'console' || /logger$/i.test(owner));
}

function getStaticAccessPath(expression) {
  const path = [];
  let current = unwrapExpression(expression);
  while (ts.isPropertyAccessExpression(current)) {
    path.unshift(current.name.text);
    current = unwrapExpression(current.expression);
  }
  if (ts.isIdentifier(current)) {
    path.unshift(current.text);
  }
  return path;
}

function getObjectPropertyName(property) {
  if (!property.name) {
    return '';
  }
  if (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) {
    return property.name.text;
  }
  return '';
}

function isRenderedJsxChild(node) {
  return ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent);
}

function hasIgnoreDirective(source, zeroBasedLine) {
  const lines = source.split(/\r?\n/);
  const candidates = [lines[zeroBasedLine], lines[zeroBasedLine - 1]].filter(Boolean);
  return candidates.some((line) => /error-exposure-guard-ignore\s*--\s*\S+/.test(line));
}

function scriptKindFor(file) {
  if (/\.tsx$/i.test(file)) {
    return ts.ScriptKind.TSX;
  }
  if (/\.jsx$/i.test(file)) {
    return ts.ScriptKind.JSX;
  }
  if (/\.[cm]?js$/i.test(file)) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function deduplicateFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.category}:${finding.slot}:${finding.line}:${finding.column}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function findRegressions(baseFindings, headFindings) {
  const regressions = [];
  const categories = new Set(
    [...baseFindings, ...headFindings].map((finding) => `${finding.category}:${finding.slot}`),
  );

  for (const category of categories) {
    const base = baseFindings.filter((finding) => `${finding.category}:${finding.slot}` === category);
    const head = headFindings.filter((finding) => `${finding.category}:${finding.slot}` === category);
    const remainingExactMatches = countBy(base, (finding) => finding.exactKey);
    const unmatchedHead = head.filter((finding) => {
      const count = remainingExactMatches.get(finding.exactKey) ?? 0;
      if (count > 0) {
        remainingExactMatches.set(finding.exactKey, count - 1);
        return false;
      }
      return true;
    });
    regressions.push(...unmatchedHead);
  }

  return regressions.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
}

function findRegressionsByChange(findingsByChange) {
  return findingsByChange
    .flatMap(({ baseFindings, headFindings }) => findRegressions(baseFindings, headFindings))
    .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
}

function countBy(items, keySelector) {
  const counts = new Map();
  for (const item of items) {
    const key = keySelector(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function normalizeExpression(value) {
  return compactText(value)
    .replace(/\?\./g, '.')
    .replace(/\b(?:error\w*|err|e)\b/gi, '$ERROR');
}

function compactText(value) {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[error-exposure] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

module.exports = {
  analyzeSource,
  findRegressions,
  findRegressionsByChange,
  isProductionSource,
  parseNameStatus,
};
