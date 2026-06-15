import { navigate, showModal } from '@openmrs/esm-framework';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../constants';

function getUrlWithoutPrefix(url: string) {
  return url.split(window['getOpenmrsSpaBase']())?.[1];
}

interface BeforeSavePromptProps {
  when: boolean;
  redirect?: string;
}

const BeforeSavePrompt: React.FC<BeforeSavePromptProps> = ({ when, redirect }) => {
  const { t } = useTranslation(moduleName);
  const ref = useRef<boolean>(false);
  const [localTarget, setTarget] = useState<string | undefined>();
  const target = localTarget || redirect;
  const cancelUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      const message = t(
        'discardModalBody',
        "The changes you made to this patient's details have not been saved. Discard changes?",
      );
      e.preventDefault();
      e.returnValue = message;
      return message;
    },
    [t],
  );

  const cancelNavigation = useCallback((evt: CustomEvent) => {
    if (!evt.detail.navigationIsCanceled && !ref.current) {
      ref.current = true;
      evt.detail.cancelNavigation();
      const dispose = showModal(
        'cancel-patient-edit-modal',
        {
          onConfirm: () => {
            setTarget(evt.detail.newUrl);
            dispose();
          },
        },
        () => {
          ref.current = false;
        },
      );
    }
  }, []);

  useEffect(() => {
    if (when && typeof target === 'undefined') {
      globalThis.addEventListener('single-spa:before-routing-event', cancelNavigation);
      globalThis.addEventListener('beforeunload', cancelUnload);

      return () => {
        globalThis.removeEventListener('beforeunload', cancelUnload);
        globalThis.removeEventListener('single-spa:before-routing-event', cancelNavigation);
      };
    }
  }, [target, when, cancelUnload, cancelNavigation]);

  useEffect(() => {
    if (typeof target === 'string') {
      navigate({ to: `${globalThis.spaBase}/${getUrlWithoutPrefix(target)}` });
    }
  }, [target]);

  return null;
};

export default BeforeSavePrompt;
