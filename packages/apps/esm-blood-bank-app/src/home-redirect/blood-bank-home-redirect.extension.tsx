import { navigate } from '@openmrs/esm-framework';
import { useEffect } from 'react';

import { basePath } from '../constants';

export default function BloodBankHomeRedirect() {
  useEffect(() => {
    navigate({ to: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}` });
  }, []);

  return null;
}
