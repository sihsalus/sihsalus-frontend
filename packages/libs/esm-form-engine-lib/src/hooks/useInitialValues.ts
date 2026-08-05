import { useEffect, useRef, useState } from 'react';
import { type FormProcessor } from '../processors/form-processor';
import { type FormProcessorContextProps } from '../types';

const useInitialValues = (
  formProcessor: FormProcessor,
  isLoadingContextDependencies: boolean,
  context: FormProcessorContextProps,
): {
  isLoadingInitialValues: boolean;
  initialValues: Record<string, unknown>;
  error: Error | null;
} => {
  const [isLoadingInitialValues, setIsLoadingInitialValues] = useState(true);
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<Error | null>(null);
  // Values must be fetched exactly once per mount; keying off the emptiness of
  // `initialValues` would refetch forever when the resolved values are `{}`.
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (
      formProcessor &&
      !isLoadingContextDependencies &&
      context.formFields?.length &&
      Object.keys(context.formFieldAdapters).length &&
      !hasLoadedRef.current
    ) {
      hasLoadedRef.current = true;
      formProcessor
        .getInitialValues(context)
        .then((values: Record<string, unknown>) => {
          setInitialValues(values);
        })
        .catch((error: unknown) => {
          console.error(error);
          setError(error instanceof Error ? error : new Error('Unknown error'));
        })
        .finally(() => {
          setIsLoadingInitialValues(false);
        });
    }
  }, [formProcessor, isLoadingContextDependencies, context]);

  return { isLoadingInitialValues, initialValues, error };
};

export default useInitialValues;
