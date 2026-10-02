import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConcepts } from '../../hooks/useConcepts';
import { useFormFields } from '../../hooks/useFormFields';
import { useFormFieldsMeta } from '../../hooks/useFormFieldsMeta';
import { useFormFieldValidators } from '../../hooks/useFormFieldValidators';
import { useFormFieldValueAdapters } from '../../hooks/useFormFieldValueAdapters';
import useInitialValues from '../../hooks/useInitialValues';
import useProcessorDependencies from '../../hooks/useProcessorDependencies';
import { registerFormFieldAdaptersForCleanUp } from '../../lifecycle';
import { EncounterFormProcessor } from '../../processors/encounter/encounter-form-processor';
import { type FormProcessor, type FormProcessorConstructor } from '../../processors/form-processor';
import { PreviewFormProcessor } from '../../processors/preview-form-processor';
import { useFormFactory } from '../../provider/form-factory-provider';
import { type FormProcessorContextProps, type FormSchema } from '../../types';
import { reportError } from '../../utils/error-utils';
import Loader from '../loaders/loader.component';
import { CustomHooksRenderer } from '../renderer/custom-hooks-renderer.component';
import { FormRenderer } from '../renderer/form/form-renderer.component';

interface FormProcessorFactoryProps {
  formJson: FormSchema;
  isSubForm?: boolean;
  setIsLoadingFormDependencies: (isLoading: boolean) => void;
  onDependencyError: (error: unknown) => void;
}

const FormProcessorFactory = ({
  formJson,
  isSubForm = false,
  setIsLoadingFormDependencies,
  onDependencyError,
}: FormProcessorFactoryProps): React.JSX.Element => {
  const {
    isPreview,
    patient,
    sessionMode,
    formProcessors,
    layoutType,
    location,
    provider,
    sessionDate,
    visit,
    handleEncounterCreate,
    onBeforeEncounterSave,
  } = useFormFactory();

  const processor = useMemo<FormProcessor>(() => {
    const ProcessorClass: FormProcessorConstructor | undefined = formProcessors[formJson.processor];
    let processorInstance: FormProcessor;
    if (isPreview) {
      processorInstance = new PreviewFormProcessor(formJson);
    } else if (ProcessorClass) {
      processorInstance = new ProcessorClass(formJson);
    } else {
      console.error(`Form processor ${formJson.processor} not found, defaulting to EncounterFormProcessor`);
      processorInstance = new EncounterFormProcessor(formJson);
    }
    processorInstance.prepareFormSchema(formJson);
    return processorInstance;
  }, [formJson, formProcessors, isPreview]);

  const [processorContext, setProcessorContext] = useState<FormProcessorContextProps>({
    isPreview,
    patient,
    formJson,
    sessionMode,
    layoutType,
    location,
    currentProvider: provider,
    processor,
    sessionDate,
    visit,
    handleEncounterCreate,
    onBeforeEncounterSave,
    formFields: [],
    formFieldAdapters: {},
    formFieldValidators: {},
  });
  const { t } = useTranslation();
  const { formFields: rawFormFields, conceptReferences } = useFormFields(formJson);
  const { concepts: formFieldsConcepts, isLoading: isLoadingConcepts } = useConcepts(Array.from(conceptReferences));
  const formFieldsWithMeta = useFormFieldsMeta(rawFormFields, formFieldsConcepts);
  const formFieldAdapters = useFormFieldValueAdapters(rawFormFields, isPreview);
  const formFieldValidators = useFormFieldValidators(rawFormFields);
  const { isLoading: isLoadingCustomDeps } = useProcessorDependencies(processor, processorContext, setProcessorContext);
  const { useCustomHooks } = processor.getCustomHooks();
  const [isLoadingCustomHooks, setIsLoadingCustomHooks] = useState(!!useCustomHooks);
  const [isLoadingProcessorDependencies, setIsLoadingProcessorDependencies] = useState(true);
  const {
    isLoadingInitialValues,
    initialValues,
    error: initialValuesError,
  } = useInitialValues(
    processor,
    isLoadingCustomDeps ||
      isLoadingCustomHooks ||
      isLoadingConcepts ||
      processorContext.formFields !== formFieldsWithMeta,
    processorContext,
  );

  useEffect(() => {
    const isLoading = isLoadingCustomDeps || isLoadingCustomHooks || isLoadingConcepts || isLoadingInitialValues;
    setIsLoadingFormDependencies(isLoading);
    setIsLoadingProcessorDependencies(isLoading);
  }, [
    isLoadingCustomDeps,
    isLoadingCustomHooks,
    isLoadingConcepts,
    isLoadingInitialValues,
    setIsLoadingFormDependencies,
  ]);

  useEffect(() => {
    setProcessorContext((prev) => ({
      ...prev,
      ...(formFieldAdapters && { formFieldAdapters }),
      ...(formFieldValidators && { formFieldValidators }),
      formFields: formFieldsWithMeta,
    }));
  }, [formFieldAdapters, formFieldValidators, formFieldsWithMeta]);

  useEffect(() => {
    setProcessorContext((prev) => ({
      ...prev,
      handleEncounterCreate,
      onBeforeEncounterSave,
    }));
  }, [handleEncounterCreate, onBeforeEncounterSave]);

  useEffect(() => {
    reportError(initialValuesError, t('errorLoadingInitialValues', 'Error loading initial values'));
  }, [initialValuesError, t]);

  useEffect(() => {
    if (formFieldAdapters && !isPreview) {
      registerFormFieldAdaptersForCleanUp(formFieldAdapters);
    }
  }, [formFieldAdapters, isPreview]);

  return (
    <>
      {useCustomHooks && (
        <CustomHooksRenderer
          context={processorContext}
          setContext={setProcessorContext}
          useCustomHooks={useCustomHooks}
          setIsLoadingCustomHooks={setIsLoadingCustomHooks}
          onError={onDependencyError}
        />
      )}
      {isLoadingProcessorDependencies && (!isSubForm || isPreview) ? (
        <Loader />
      ) : (
        <FormRenderer
          processorContext={processorContext}
          initialValues={initialValues}
          isSubForm={isSubForm}
          setIsLoadingFormDependencies={setIsLoadingFormDependencies}
          onDependencyError={onDependencyError}
        />
      )}
    </>
  );
};

export default FormProcessorFactory;
