import '@carbon/styles/css/styles.css';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import { useCallback } from 'react';

import OdontogramCanvas from './odontogram/components/odontogram';
import { adultConfig } from './odontogram/config/adult-config';
import type { OdontogramData } from './odontogram/types/odontogram';
import useOdontogramDataStore from './store/odontogram-data-store';

export default function OdontologiaRoot() {
  const data = useOdontogramDataStore((state) => state.data);
  const setData = useOdontogramDataStore((state) => state.setData);

  const handleChange = useCallback(
    (nextData: OdontogramData) => {
      setData(nextData);
    },
    [setData],
  );

  return (
    <AppErrorBoundary appName="esm-odontologia-app">
      <div style={{ padding: '1rem 0' }}>
        <OdontogramCanvas config={adultConfig} data={data} onChange={handleChange} />
      </div>
    </AppErrorBoundary>
  );
}
