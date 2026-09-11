import { useCallback, useEffect, useRef, useState } from 'react';
import { useImagingAccess } from './use-imaging-access';

/** One write at a time, bound to the patient/resource that started it. */
export function useImagingOperation(context: string) {
  const { canWrite, userUuid } = useImagingAccess();
  const operationContext = `${userUuid ?? ''}:${context}`;
  const writeAccess = useRef(canWrite);
  writeAccess.current = canWrite;
  const active = useRef<{ context: string; controller: AbortController } | null>(null);
  const mounted = useRef(true);
  const currentContext = useRef(operationContext);
  currentContext.current = operationContext;
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    mounted.current = true;
    setIsPending(false);
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
      active.current = null;
    };
  }, [operationContext]);

  useEffect(() => {
    if (!canWrite) active.current?.controller.abort();
  }, [canWrite]);

  const start = useCallback(() => {
    if (!writeAccess.current || !mounted.current || active.current || currentContext.current !== operationContext)
      return null;
    const controller = new AbortController();
    active.current = { context: operationContext, controller };
    setIsPending(true);
    return controller;
  }, [operationContext]);

  const isCurrent = useCallback(
    (controller: AbortController) =>
      writeAccess.current &&
      mounted.current &&
      active.current?.controller === controller &&
      active.current.context === currentContext.current &&
      !controller.signal.aborted,
    [],
  );

  const finish = useCallback((controller: AbortController) => {
    if (active.current?.controller === controller) {
      active.current = null;
      setIsPending(false);
    }
  }, []);

  return { start, isCurrent, finish, isPending, canWrite };
}
