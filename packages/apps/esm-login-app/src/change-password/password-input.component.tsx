import { PasswordInput as CarbonPasswordInput, type PasswordInputProps } from '@carbon/react';
import React, { useCallback } from 'react';

const PasswordInput: React.FC<PasswordInputProps> = (props) => {
  const removeVisibilityToggleFromTabOrder = useCallback((node: unknown) => {
    if (!(node instanceof HTMLInputElement)) {
      return;
    }

    const visibilityToggle = node.parentElement?.querySelector<HTMLButtonElement>('button[type="button"]');

    if (visibilityToggle) {
      visibilityToggle.tabIndex = -1;
    }
  }, []);

  return <CarbonPasswordInput {...props} ref={removeVisibilityToggleFromTabOrder} />;
};

export default PasswordInput;
