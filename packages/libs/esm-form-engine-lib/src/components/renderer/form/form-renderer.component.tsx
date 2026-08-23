import React, { useEffect, useMemo, useReducer } from 'react';
import { useForm } from 'react-hook-form';
import { useEvaluateFormFieldExpressions } from '../../../hooks/useEvaluateFormFieldExpressions';
import { useFormStateHelpers } from '../../../hooks/useFormStateHelpers';
import { useFormFactory } from '../../../provider/form-factory-provider';
import { type FormContextProps, FormProvider, type FormValues } from '../../../provider/form-provider';
import { type FormProcessorContextProps } from '../../../types';
import { isPageContentVisible } from '../../../utils/form-helper';
import FormProcessorFactory from '../../processor-factory/form-processor-factory.component';
import { pageObserver } from '../../sidebar/page-observer';
import PageRenderer from '../page/page.renderer.component';
import { formStateReducer, initialState } from './state';

export type FormRendererProps = {
  processorContext: FormProcessorContextProps;
  initialValues: Record<string, unknown>;
  isSubForm: boolean;
  setIsLoadingFormDependencies: (isLoading: boolean) => void;
};

export const FormRenderer = ({
  processorContext,
  initialValues,
  isSubForm,
  setIsLoadingFormDependencies,
}: FormRendererProps): React.JSX.Element => {
  const { evaluatedFields, evaluatedFormJson, evaluatedPagesVisibility } = useEvaluateFormFieldExpressions(
    initialValues,
    processorContext,
  );
  const { registerForm, setIsFormDirty, workspaceLayout, isFormExpanded } = useFormFactory();
  const methods = useForm<FormValues>({
    defaultValues: initialValues,
    mode: 'onChange',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
  });

  const {
    formState: { isDirty },
  } = methods;

  const [{ formFields, invalidFields, formJson, deletedFields }, dispatch] = useReducer(formStateReducer, {
    ...initialState,
    formFields: evaluatedFields,
    formJson: evaluatedFormJson,
  });

  const {
    addFormField,
    updateFormField,
    getFormField,
    removeFormField,
    setInvalidFields,
    addInvalidField,
    removeInvalidField,
    setForm,
    setDeletedFields,
  } = useFormStateHelpers(dispatch, formFields);

  useEffect(() => {
    const scrollablePages = formJson.pages.filter((page) => !page.isSubform).map((page) => page);
    pageObserver.updateScrollablePages(scrollablePages);
  }, [formJson.pages]);

  useEffect(() => {
    pageObserver.setEvaluatedPagesVisibility(evaluatedPagesVisibility);
  }, [evaluatedPagesVisibility]);

  useEffect(() => {
    pageObserver.updatePagesWithErrors(invalidFields.map((field) => field.meta.pageId));
  }, [invalidFields]);

  const context: FormContextProps = useMemo(() => {
    return {
      ...processorContext,
      workspaceLayout,
      methods,
      formFields,
      formJson,
      invalidFields,
      deletedFields,
      addFormField,
      updateFormField,
      getFormField,
      removeFormField,
      setInvalidFields,
      addInvalidField,
      removeInvalidField,
      setForm,
      setDeletedFields,
    };
  }, [
    addFormField,
    addInvalidField,
    deletedFields,
    formFields,
    formJson,
    getFormField,
    invalidFields,
    methods,
    processorContext,
    removeFormField,
    removeInvalidField,
    setDeletedFields,
    setForm,
    setInvalidFields,
    updateFormField,
    workspaceLayout,
  ]);

  useEffect(() => {
    registerForm(formJson.name, isSubForm, context);
  }, [context, formJson.name, isSubForm, registerForm]);

  useEffect(() => {
    setIsFormDirty(isDirty);
  }, [isDirty, setIsFormDirty]);

  return (
    <FormProvider {...context}>
      {formJson.pages.map((page) => {
        if (!page.isSubform && !isPageContentVisible(page)) {
          return null;
        }
        if (page.isSubform && page.subform?.form) {
          return (
            <FormProcessorFactory
              key={page.subform.form.uuid}
              formJson={page.subform.form}
              isSubForm={true}
              setIsLoadingFormDependencies={setIsLoadingFormDependencies}
            />
          );
        }
        return <PageRenderer key={page.label} page={page} isFormExpanded={isFormExpanded} />;
      })}
    </FormProvider>
  );
};
