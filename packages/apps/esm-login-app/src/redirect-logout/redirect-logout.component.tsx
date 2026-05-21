import { navigate, setUserLanguage, useConfig, useConnectivity, useSession } from '@openmrs/esm-framework';
import { clearHistory } from '@openmrs/esm-framework/src/internal';
import { useEffect } from 'react';

import { type ConfigSchema } from '../config-schema';

import { performLogout } from './logout.resource';

function redirectAfterLogout(config: ConfigSchema) {
  navigate({
    to: config.provider.type === 'oauth2' ? config.provider.logoutUrl : '${openmrsSpaBase}/login',
  });
}

const RedirectLogout: React.FC = () => {
  const config = useConfig<ConfigSchema>();
  const isLoginEnabled = useConnectivity();
  const session = useSession();

  useEffect(() => {
    clearHistory();
    if (!session.authenticated || !isLoginEnabled) {
      redirectAfterLogout(config);
    } else {
      performLogout()
        .then(() => {
          const defaultLanguage = document.documentElement.dataset.defaultLang;

          setUserLanguage({
            locale: defaultLanguage,
            authenticated: false,
            sessionId: '',
          });

          redirectAfterLogout(config);
        })
        .catch((error) => {
          console.error('Logout failed:', error);
        });
    }
  }, [config, isLoginEnabled, session]);

  return null;
};

export default RedirectLogout;
