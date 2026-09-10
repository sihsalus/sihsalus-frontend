import { useCallback, useEffect, useRef, useState } from 'react';
import { isUnconfirmedConditionWriteError } from './conditions.resource';

interface ConditionDeletionOptions {
  onDelete: () => Promise<unknown>;
  refresh: () => Promise<unknown>;
  onClose: () => void;
  onSuccess: () => void;
  onDeleteError: (error: unknown) => void;
  onRefreshError: (error: unknown) => void;
  canDelete?: boolean;
}

/** Confirmed and uncertain deletions remain non-repeatable until the history is checked. */
export function useConditionDeletion({
  onDelete,
  refresh,
  onClose,
  onSuccess,
  onDeleteError,
  onRefreshError,
  canDelete = true,
}: ConditionDeletionOptions) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isUncertain, setIsUncertain] = useState(false);
  const deletingRef = useRef(false);
  const deletedRef = useRef(false);
  const uncertainRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleDelete = useCallback(async () => {
    if (!mountedRef.current || deletingRef.current || deletedRef.current || uncertainRef.current || !canDelete) {
      return;
    }
    deletingRef.current = true;
    setIsDeleting(true);

    try {
      await onDelete();
      deletedRef.current = true;
      if (mountedRef.current) {
        setIsDeleted(true);
      }
      // The original patient's cache still needs refreshing if the modal was replaced.
      await refresh();
      if (mountedRef.current) {
        onSuccess();
      }
    } catch (error: unknown) {
      if (mountedRef.current) {
        if (deletedRef.current) {
          onRefreshError(error);
        } else if (isUnconfirmedConditionWriteError(error)) {
          uncertainRef.current = true;
          setIsUncertain(true);
        } else {
          onDeleteError(error);
        }
      }
    } finally {
      deletingRef.current = false;
      if (mountedRef.current) {
        setIsDeleting(false);
        if (deletedRef.current) {
          onClose();
        }
      }
    }
  }, [canDelete, onClose, onDelete, onDeleteError, onRefreshError, onSuccess, refresh]);

  const handleClose = useCallback(() => {
    if (mountedRef.current && !deletingRef.current) {
      onClose();
    }
  }, [onClose]);

  return { isDeleting, isDeleted, isUncertain, handleDelete, handleClose };
}
