const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analyzeSource,
  findRegressions,
  findRegressionsByChange,
  isProductionSource,
  parseNameStatus,
} = require('./validate-error-exposure');

function analyze(source, file = 'packages/apps/esm-example-app/src/example.tsx') {
  return analyzeSource(source, file);
}

test('detects raw technical errors in snackbar and notification descriptors', () => {
  const findings = analyze(`
    showSnackbar({ kind: 'error', subtitle: error?.responseBody?.error?.message });
    showNotification({ kind: 'error', description: requestError.message });
  `);

  assert.deepEqual(
    findings.map(({ sink, slot }) => ({ sink, slot })),
    [
      { sink: 'showSnackbar', slot: 'subtitle' },
      { sink: 'showNotification', slot: 'description' },
    ],
  );
});

test('detects raw errors sent through the basal event dispatchers', () => {
  const findings = analyze(`
    dispatchToastShown({ kind: 'error', description: error.message });
    dispatchSnackbarShown({ kind: 'error', title: 'Error', subtitle: requestError.message });
    dispatchNotificationShown({ kind: 'error', description: exception.message });
    dispatchActionableNotificationShown({ kind: 'error', subtitle: err.message });
  `);

  assert.deepEqual(
    findings.map(({ sink }) => sink),
    ['dispatchToastShown', 'dispatchSnackbarShown', 'dispatchNotificationShown', 'dispatchActionableNotificationShown'],
  );
});

test('follows imported and local aliases of notification sinks', () => {
  const findings = analyze(`
    import { showSnackbar as notify } from '@openmrs/esm-framework';
    import * as globals from '@openmrs/esm-globals';
    const emitNotification = notify;

    notify({ subtitle: error.message });
    emitNotification({ description: requestError.message });
    globals.dispatchToastShown({ title: exception.name });
  `);

  assert.deepEqual(
    findings.map(({ sink, slot }) => ({ sink, slot })),
    [
      { sink: 'showSnackbar', slot: 'subtitle' },
      { sink: 'showSnackbar', slot: 'description' },
      { sink: 'dispatchToastShown', slot: 'title' },
    ],
  );
});

test('detects legacy notification arguments and simple aliases', () => {
  const findings = analyze(`
    const technicalMessage = err instanceof Error ? err.message : String(err);
    showNotification('error', technicalMessage);
  `);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].slot, 'argument');
});

test('detects common technical fields without flagging static copy', () => {
  const findings = analyze(`
    showSnackbar({ subtitle: failure.message });
    showNotification({ description: reason.message });
    showSnackbar({ title: error.name, subtitle: error.code });
    showNotification({ title: exception.status, description: exception.stack });
    const content = <p>{requestError.reason}</p>;

    showSnackbar({ title: 'Error', subtitle: t('requestFailed', 'No disponible') });
    const errorLabels = { name: 'Nombre', code: 'Código', status: 'Activo', reason: 'Motivo' };
    const staticContent = <p>{errorLabels.name} {errorLabels.code} {errorLabels.status} {errorLabels.reason}</p>;
    const copiedError = { name: error.name };
    const dynamicContent = <p>{copiedError.name}</p>;
  `);

  assert.deepEqual(
    findings.map(({ text }) => text),
    [
      'failure.message',
      'reason.message',
      'error.name',
      'error.code',
      'exception.status',
      'exception.stack',
      'requestError.reason',
      'copiedError.name',
    ],
  );
});

test('detects raw errors rendered as JSX children and visible properties', () => {
  const findings = analyze(`
    const Example = ({ error }) => (
      <>
        <div>{error.message}</div>
        <InlineNotification subtitle={error?.statusText} />
      </>
    );
  `);

  assert.deepEqual(
    findings.map(({ sink, slot }) => ({ sink, slot })),
    [
      { sink: 'JSX child', slot: 'children' },
      { sink: 'JSX attribute', slot: 'subtitle' },
    ],
  );
});

test('detects raw errors passed through JSX spreads', () => {
  const findings = analyze(`
    const notificationProps = { subtitle: error.message };
    const content = (
      <>
        <InlineNotification {...notificationProps} />
        <InlineNotification {...{ description: rejection.reason }} />
        <TextInput {...field} label="Name" />
      </>
    );
  `);

  assert.deepEqual(
    findings.map(({ sink, slot }) => ({ sink, slot })),
    [
      { sink: 'JSX spread', slot: 'props' },
      { sink: 'JSX spread', slot: 'props' },
    ],
  );
});

test('allows React Hook Form and field-state validation messages', () => {
  const findings = analyze(`
    import { Controller, useController, useForm } from 'react-hook-form';

    const DirectFields = () => {
      const { fieldState } = useController({ name: 'email' });
      const { formState } = useForm();
      return (
        <>
          <TextInput invalidText={fieldState.error?.message} />
          <TextInput invalidText={formState.errors.email?.message} />
        </>
      );
    };

    const ControllerField = () => (
      <Controller
        render={({ fieldState: { error } }) => <TextInput invalidText={error?.message} />}
      />
    );

    const ErrorList = () => {
      const { formState: { errors } } = useForm();
      return Object.entries(errors).map(([fieldName, error]) => (
          <InlineNotification key={fieldName} subtitle={error.message} />
        ));
    };
  `);

  assert.deepEqual(findings, []);
});

test('does not let form validation context hide an unrelated request error', () => {
  const findings = analyze(`
    import { Controller } from 'react-hook-form';

    const ControllerField = ({ requestError }) => (
      <Controller
        render={({ fieldState: { error } }) => (
          <InlineNotification subtitle={requestError.message} invalidText={error.message} />
        )}
      />
    );
  `);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].text, 'requestError.message');
});

test('does not treat backend errors as form validation based only on variable names', () => {
  const findings = analyze(`
    const errors = apiError.responseBody.error.globalErrors;
    const formErrors = requestError.responseBody.error;
    showSnackbar({ subtitle: errors[0].message });
    showNotification({ description: formErrors.message });
  `);

  assert.equal(findings.length, 2);
  assert.deepEqual(
    findings.map(({ text }) => text),
    ['errors[0].message', 'formErrors.message'],
  );
});

test('resolves aliases only inside the lexical function that declares them', () => {
  const findings = analyze(`
    function unsafeScope(error) {
      const message = error.message;
      return null;
    }

    function translatedScope(message) {
      showSnackbar({ subtitle: message });
    }
  `);

  assert.deepEqual(findings, []);
});

test('follows an unsafe alias into a nested callback', () => {
  const findings = analyze(`
    function Example({ error }) {
      const technicalMessage = error.message;
      return <Button onClick={() => showSnackbar({ subtitle: technicalMessage })} />;
    }
  `);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].sink, 'showSnackbar');
});

test('detects technical errors inside translation interpolation and formatters', () => {
  const findings = analyze(`
    showSnackbar({
      subtitle: t('requestFailed', 'Request failed: {{detail}}', { detail: error.message }),
    });
    const content = <p>{formatMessage('Request failed: %s', requestError.responseBody.error.message)}</p>;
  `);

  assert.equal(findings.length, 2);
  assert.deepEqual(
    findings.map(({ sink, slot }) => ({ sink, slot })),
    [
      { sink: 'showSnackbar', slot: 'subtitle' },
      { sink: 'JSX child', slot: 'children' },
    ],
  );
});

test('approved normalizers ignore only their technical input argument', () => {
  const safeFindings = analyze(`
    import { getCompatibleUserFacingErrorMessage as compatNormalizer } from '@openmrs/esm-utils';
    import { getUserFacingErrorMessage as normalizeError } from '@openmrs/esm-framework';
    import { getUserFacingQueueErrorMessage as normalizeQueueError } from './queue-entry-error.utils';
    import { useUserFacingErrorMessage as useQueueErrorMessage } from '../hooks/useUserFacingErrorMessage';

    const content = (
      <>
        <InlineNotification subtitle={normalizeError(error)} />
        <InlineNotification subtitle={compatNormalizer(error, 'No disponible', {}, normalizeError)} />
        <InlineNotification subtitle={useQueueErrorMessage(requestError, t('fallback', 'No disponible'))} />
        <InlineNotification subtitle={normalizeQueueError(queueError)} />
      </>
    );
  `);
  assert.deepEqual(safeFindings, []);

  const unsafeFindings = analyze(`
    import { getCompatibleUserFacingErrorMessage } from './untrusted-error-message.utils';
    import { getCompatibleUserFacingErrorMessage as trustedCompat } from '@openmrs/esm-utils';
    import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
    import { useUserFacingErrorMessage } from '../hooks/useUserFacingErrorMessage';

    showSnackbar({ subtitle: getUserFacingErrorMessage(error, error.message) });
    showSnackbar({ subtitle: getCompatibleUserFacingErrorMessage(error, 'No disponible') });
    showSnackbar({
      subtitle: getCompatibleUserFacingErrorMessage(error, 'No disponible', {}, (failure) => failure.message),
    });
    showSnackbar({ subtitle: trustedCompat(error, 'No disponible', {}, (failure) => failure.message) });
    showSnackbar({ subtitle: trustedCompat(error, 'No disponible', {}, getUserFacingErrorMessage, error.message) });
    showSnackbar({
      subtitle: useUserFacingErrorMessage(error, { fallback: error.responseBody.error.message }),
    });
  `);
  assert.equal(unsafeFindings.length, 6);
});

test('does not trust local functions that only reuse approved normalizer names', () => {
  const findings = analyze(`
    import { getUserFacingErrorMessage as importedNormalizer } from '@openmrs/esm-framework';

    const getUserFacingErrorMessage = (error) => error.message;
    const helpers = { useUserFacingErrorMessage: (error) => error.message };
    const ShadowedNormalizer = (importedNormalizer, failure) => (
      <InlineNotification subtitle={importedNormalizer(failure)} />
    );

    showSnackbar({ subtitle: getUserFacingErrorMessage(requestError) });
    showSnackbar({ subtitle: helpers.useUserFacingErrorMessage(exception) });
  `);

  assert.equal(findings.length, 3);
});

test('trusts a safe alias by provenance, not by a user-facing or normalized name', () => {
  const findings = analyze(`
    import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
    import { useUserFacingErrorMessage } from '../hooks/useUserFacingErrorMessage';

    const normalizedError = requestError;
    const userFacingError = getUserFacingErrorMessage(requestError);
    const safeError = useUserFacingErrorMessage(requestError);
    const unsafeUserFacingError = getUserFacingErrorMessage(requestError, requestError.message);

    showSnackbar({ subtitle: normalizedError.message });
    showSnackbar({ subtitle: userFacingError.message });
    showSnackbar({ subtitle: safeError.message });
    showSnackbar({ subtitle: unsafeUserFacingError.message });
  `);

  assert.equal(findings.length, 2);
  assert.equal(findings[0].text, 'normalizedError.message');
  assert.equal(findings[1].text, 'unsafeUserFacingError.message');
});

test('does not grant the generic getErrorMessage helper a normalizer exemption', () => {
  const findings = analyze(`
    showSnackbar({ subtitle: getErrorMessage(error) });
    showSnackbar({ subtitle: getErrorMessage(requestError).trim() });
  `);

  assert.equal(findings.length, 2);
  assert.equal(findings[0].text, 'getErrorMessage(error)');
});

test('does not inspect technical details sent only to logging sinks', () => {
  const findings = analyze(`
    import { getUserFacingErrorMessage } from '@openmrs/esm-framework';

    console.error(error.message);
    const diagnostics = <>{console.warn(error.message)}{logError(error)}{reportError(error)}</>;
    const userFacingError = getUserFacingErrorMessage(error);
    showSnackbar({ kind: 'error', subtitle: userFacingError });

    const errorMessage = getUserFacingErrorMessage(error, 'No disponible', {
      codeMessages: { NOT_FOUND: 'No encontrado' },
    });
    const content = hasError && <InlineNotification subtitle={errorMessage} />;
  `);

  assert.deepEqual(findings, []);
});

test('does not confuse a domain status label map with HTTP statusText', () => {
  const findings = analyze(`
    const content = <span>{statusText[request.status]}</span>;
    const notification = <InlineNotification subtitle={requestError.statusText} />;
  `);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].text, 'requestError.statusText');
});

test('supports a documented diagnostic exception with a reason', () => {
  const findings = analyze(`
    // error-exposure-guard-ignore -- implementer-only diagnostics panel
    const content = <pre>{error.message}</pre>;
  `);

  assert.deepEqual(findings, []);
});

test('matches inherited exposures by normalized expression regardless of location', () => {
  const base = analyze('showSnackbar({ subtitle: error.message });');
  const movedButEquivalent = analyze(`

    showSnackbar({ subtitle: err.message });
  `);
  assert.deepEqual(findRegressions(base, movedButEquivalent), []);

  const increased = analyze(`
    showSnackbar({ subtitle: err.message });
    showSnackbar({ subtitle: requestError.message });
  `);
  const regressions = findRegressions(base, increased);
  assert.equal(regressions.length, 1);
  assert.equal(regressions[0].line, 3);
});

test('rejects replacing an inherited exposure one-for-one in the same category and slot', () => {
  const base = analyze('showSnackbar({ subtitle: error.message });');
  const replaced = analyze('showSnackbar({ subtitle: failure.stack });');

  const regressions = findRegressions(base, replaced);
  assert.equal(regressions.length, 1);
  assert.equal(regressions[0].text, 'failure.stack');
});

test('does not let a removal in one file compensate an exposure added in another', () => {
  const removedFromA = {
    baseFindings: analyze('showSnackbar({ subtitle: error.message });', 'packages/apps/a/src/a.tsx'),
    headFindings: [],
  };
  const addedToB = {
    baseFindings: [],
    headFindings: analyze('showSnackbar({ subtitle: requestError.message });', 'packages/apps/b/src/b.tsx'),
  };

  const regressions = findRegressionsByChange([removedFromA, addedToB]);
  assert.equal(regressions.length, 1);
  assert.equal(regressions[0].file, 'packages/apps/b/src/b.tsx');
});

test('filters test sources while retaining production TypeScript and JavaScript', () => {
  assert.equal(isProductionSource('packages/apps/example/src/component.tsx'), true);
  assert.equal(isProductionSource('packages/libs/example/src/resource.js'), true);
  assert.equal(isProductionSource('packages/apps/example/src/component.test.tsx'), false);
  assert.equal(isProductionSource('packages/apps/example/src/tests/helper.ts'), false);
  assert.equal(isProductionSource('packages/apps/example/vitest.config.ts'), true);
});

test('parses added, modified, deleted, and renamed Git status records', () => {
  const records = parseNameStatus('A\0added.ts\0M\0changed.ts\0D\0deleted.ts\0R100\0old.ts\0new.ts\0');
  assert.deepEqual(records, [
    { basePath: '', headPath: 'added.ts' },
    { basePath: 'changed.ts', headPath: 'changed.ts' },
    { basePath: 'deleted.ts', headPath: '' },
    { basePath: 'old.ts', headPath: 'new.ts' },
  ]);
});
