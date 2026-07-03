import { setUserLanguage, useConfig, useConnectivity, useSession } from '@openmrs/esm-framework';
import { clearHistory } from '@openmrs/esm-framework/src/internal';
import { useEffect } from 'react';

import { type ConfigSchema } from '../config-schema';
import { hardNavigate } from '../navigation';

import { performLogout } from './logout.resource';

const openmrsSpaBasePlaceholder = '$' + '{openmrsSpaBase}';

function redirectAfterLogout(config: ConfigSchema) {
  hardNavigate(config.provider.type === 'oauth2' ? config.provider.logoutUrl : `${openmrsSpaBasePlaceholder}/login`);
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
