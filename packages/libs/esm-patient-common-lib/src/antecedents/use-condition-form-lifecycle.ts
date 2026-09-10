import { type SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import type { Condition } from './conditions.types';
import { isConditionForPatient } from './conditions-model';

export type ConditionFormSubmissionResult = boolean | 'uncertain';

interface ConditionFormSubmission {
  submit(): Promise<ConditionFormSubmissionResult>;
}

interface ConditionFormLifecycleOptions<Values> {
  patientUuid: string;
  isEditing: boolean;
  matchingCondition?: Condition;
  defaultValues: Values;
  reset(values: Values): void;
  onStart(): void;
  onError(): void;
}

/** Shared lifecycle for a form instance keyed by patient and condition identity. */
export function useConditionFormLifecycle<Values>({
  patientUuid,
  isEditing,
  matchingCondition,
  defaultValues,
  reset,
  onStart,
  onError,
}: ConditionFormLifecycleOptions<Values>) {
  const [isSubmittingForm, setSubmittingState] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isUncertain, setIsUncertain] = useState(false);
  const [originalCondition, setOriginalCondition] = useState<Condition>();
  const mounted = useRef(true);
  const submitting = useRef(false);
  const widgetRef = useRef<ConditionFormSubmission | null>(null);
  const initializedCondition = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isEditing || !matchingCondition || !isConditionForPatient(matchingCondition.source, patientUuid)) {
      return;
    }
    const identity = `${patientUuid}:${matchingCondition.id}`;
    if (initializedCondition.current !== identity) {
      reset(defaultValues);
      setOriginalCondition(matchingCondition);
      initializedCondition.current = identity;
    }
  }, [isEditing, matchingCondition, patientUuid, reset, defaultValues]);

  const setIsSubmittingForm = useCallback((value: SetStateAction<boolean>) => {
    if (mounted.current) {
      setSubmittingState(value);
    }
  }, []);

  const submitCondition = useCallback(async () => {
    const widget = widgetRef.current;
    if (
      !mounted.current ||
      submitting.current ||
      !widget ||
      !patientUuid ||
      (isEditing &&
        (!originalCondition || !matchingCondition || !isConditionForPatient(matchingCondition.source, patientUuid)))
    ) {
      return;
    }
    submitting.current = true;
    setIsSubmittingForm(true);
    let result: ConditionFormSubmissionResult = false;
    try {
      onStart();
      result = await widget.submit();
    } catch {
      if (mounted.current) {
        onError();
      }
    } finally {
      // Confirmed and uncertain writes stay locked until the owning form closes.
      if (result === false) {
        submitting.current = false;
      } else if (mounted.current) {
        if (result === true) setIsSaved(true);
        else setIsUncertain(true);
      }
      setIsSubmittingForm(false);
    }
  }, [patientUuid, isEditing, matchingCondition, originalCondition, onStart, onError, setIsSubmittingForm]);

  return {
    widgetRef,
    // An external SWR render can precede React committing the pending state.
    isSubmittingForm: isSubmittingForm || (submitting.current && !isSaved && !isUncertain),
    isSaved,
    isUncertain,
    originalCondition,
    setIsSubmittingForm,
    submitCondition,
  };
}
