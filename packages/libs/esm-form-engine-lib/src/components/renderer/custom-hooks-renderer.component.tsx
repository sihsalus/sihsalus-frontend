import { useEffect } from "react";
import { type GetCustomHooksResponse } from "../../processors/form-processor";
import { type FormProcessorContextProps } from "../../types";

export const CustomHooksRenderer = ({
  context,
  setContext,
  useCustomHooks,
  setIsLoadingCustomHooks,
  onError,
}: {
  context: FormProcessorContextProps;
  setContext: React.Dispatch<React.SetStateAction<FormProcessorContextProps>>;
  useCustomHooks: GetCustomHooksResponse["useCustomHooks"];
  setIsLoadingCustomHooks: (isLoading: boolean) => void;
  onError: (error: unknown) => void;
}): null => {
  const { error, isLoading = false, updateContext } = useCustomHooks(context);

  useEffect(() => {
    if (!isLoading) {
      setIsLoadingCustomHooks(false);
      if (error) {
        onError(error);
        return;
      }
      updateContext?.(setContext);
    }
  }, [
    error,
    isLoading,
    onError,
    setContext,
    setIsLoadingCustomHooks,
    updateContext,
  ]);

  return null;
};
