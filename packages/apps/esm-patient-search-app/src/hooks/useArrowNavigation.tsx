import { useCallback, useEffect, useRef, useState } from 'react';

interface ArrowNavigationOptions {
  initialFocusedResult?: number;
  isEventFromFocusedResult: (event: React.KeyboardEvent<HTMLElement>, index: number) => boolean;
  resetKey?: unknown;
}

const useArrowNavigation = (
  totalResults: number,
  enterCallback: (evt: React.KeyboardEvent<HTMLElement>, index: number) => void,
  resetFocusCallback: () => void,
  {
    initialFocusedResult = -1,
    isEventFromFocusedResult,
    resetKey,
  }: ArrowNavigationOptions,
) => {
  const [focusedResult, setFocusedResult] = useState(initialFocusedResult);
  const previousResetKey = useRef(resetKey);

  const resetFocusedResult = useCallback(() => {
    setFocusedResult(initialFocusedResult);
  }, [initialFocusedResult]);

  useEffect(() => {
    if (!Object.is(previousResetKey.current, resetKey)) {
      previousResetKey.current = resetKey;
      resetFocusedResult();
    }
  }, [resetFocusedResult, resetKey]);

  useEffect(() => {
    setFocusedResult((currentResult) =>
      currentResult >= totalResults ? initialFocusedResult : currentResult,
    );
  }, [initialFocusedResult, totalResults]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newFocusedResult = Math.max(-1, focusedResult - 1);
        setFocusedResult(newFocusedResult);
        if (newFocusedResult === -1) {
          resetFocusCallback();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedResult((prev) => Math.min(totalResults - 1, prev + 1));
      } else if (
        e.key === 'Enter' &&
        focusedResult > -1 &&
        isEventFromFocusedResult(e, focusedResult)
      ) {
        enterCallback(e, focusedResult);
      } else if (e.key === 'Escape' && focusedResult !== -1) {
        resetFocusCallback();
        resetFocusedResult();
      }
    },
    [
      enterCallback,
      focusedResult,
      isEventFromFocusedResult,
      resetFocusCallback,
      resetFocusedResult,
      totalResults,
    ],
  );

  return { focusedResult, handleKeyPress, resetFocusedResult };
};

export default useArrowNavigation;
