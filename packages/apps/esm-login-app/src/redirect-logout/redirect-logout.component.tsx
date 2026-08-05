import { setUserLanguage, showSnackbar, useConfig, useConnectivity, useSession } from '@openmrs/esm-framework';
import { clearHistory } from '@openmrs/esm-framework/src/internal';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigSchema } from '../config-schema';
import { hardNavigate } from '../navigation';

import { clearSensitiveBrowserState } from './clear-sensitive-browser-state';
import { performLogout } from './logout.resource';

const openmrsSpaBasePlaceholder = '$' + '{openmrsSpaBase}';

function redirectAfterLogout(config: ConfigSchema) {
  hardNavigate(config.provider.type === 'oauth2' ? config.provider.logoutUrl : `${openmrsSpaBasePlaceholder}/login`);
}

const RedirectLogout: React.FC = () => {
  const { t } = useTranslation();
  const config = useConfig<ConfigSchema>();
  const isLoginEnabled = useConnectivity();
  const session = useSession();

  useEffect(() => {
    if (!session.authenticated || !isLoginEnabled) {
      clearHistory();
      clearSensitiveBrowserState();
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

          clearHistory();
          clearSensitiveBrowserState();
          redirectAfterLogout(config);
        })
        .catch((error) => {
          console.error('Logout failed:', error);
          // The session is still authenticated at this point: the user must know
          // the logout did NOT happen, especially on shared workstations.
          showSnackbar({
            kind: 'error',
            isLowContrast: false,
            title: t('logoutFailed', 'No se pudo cerrar la sesión'),
            subtitle: t(
              'logoutFailedSubtitle',
              'Su sesión sigue activa. Vuelva a intentarlo o cierre el navegador para proteger su cuenta.',
            ),
          });
        });
    }
  }, [config, isLoginEnabled, session, t]);

  return null;
};

export default RedirectLogout;
