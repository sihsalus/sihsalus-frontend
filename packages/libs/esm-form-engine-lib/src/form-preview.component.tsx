import { useLayoutType } from '@openmrs/esm-framework';
import { useCallback, useMemo, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import MarkdownWrapper from './components/inputs/markdown/markdown-wrapper.component';
import Loader from './components/loaders/loader.component';
import FormProcessorFactory from './components/processor-factory/form-processor-factory.component';
import styles from './form-engine.scss';
import { formEngineAppName } from './globals';
import { useFormJson } from './hooks/useFormJson';
import { FormFactoryProviderContext } from './provider/form-factory-provider';
import { type FormSchema } from './types';

const noop = () => {};
const previewProcessors = {};

/** Schema-only entry point: it never mounts the clinical submission provider. */
export function FormPreview({ formJson }: { formJson: FormSchema }) {
  // A schema edit must replace fields even when its persisted UUID is unchanged.
  // useFormJson clones this JSON before transformers or renderers modify it.
  const revision = useMemo(() => JSON.stringify(formJson), [formJson]);
  return <PreviewSession key={`${window.i18next.language}:${revision}`} formJson={formJson} />;
}

function PreviewSession({ formJson }: { formJson: FormSchema }) {
  const [translationInstance] = useState(() => window.i18next.cloneInstance({ forkResourceStore: true }));
  const layoutType = useLayoutType();
  const [sessionDate] = useState(() => new Date());
  const [dependencyError, setDependencyError] = useState(false);
  const {
    formJson: schema,
    isLoading,
    formError,
  } = useFormJson(undefined, formJson, undefined, undefined, undefined, translationInstance);
  const onDependencyError = useCallback(() => setDependencyError(true), []);

  if (formError || dependencyError) throw new Error('Form preview could not be loaded');
  if (isLoading || !schema) return <Loader />;

  return (
    <I18nextProvider i18n={translationInstance} defaultNS={formEngineAppName}>
      <form className={`cds--form ${styles.form}`} noValidate onSubmit={(event) => event.preventDefault()}>
        <FormFactoryProviderContext.Provider
          value={{
            isPreview: true,
            patient: null,
            visit: null,
            location: null,
            provider: null,
            sessionMode: 'enter',
            sessionDate,
            formJson: schema,
            formProcessors: previewProcessors,
            layoutType,
            workspaceLayout: 'minimized',
            isFormExpanded: true,
            registerForm: noop,
            setIsFormDirty: noop,
          }}
        >
          <div className={styles.formContainer}>
            <div className={styles.formBody}>
              {typeof schema.markdown === 'string' && <MarkdownWrapper markdown={schema.markdown} />}
              <FormProcessorFactory
                formJson={schema}
                setIsLoadingFormDependencies={noop}
                onDependencyError={onDependencyError}
              />
            </div>
          </div>
        </FormFactoryProviderContext.Provider>
      </form>
    </I18nextProvider>
  );
}
