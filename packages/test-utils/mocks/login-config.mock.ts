import { type ConfigSchema } from '../../apps/esm-login-app/src/config-schema';

export const mockConfig: ConfigSchema = {
  announcements: [],
  background: {
    image: '',
    color: '',
  },
  provider: {
    type: 'basic',
    loginUrl: '',
    logoutUrl: '',
  },
  chooseLocation: {
    enabled: true,
    numberToShow: 3,
    useLoginLocationTag: true,
    locationsPerRequest: 50,
  },
  logo: {
    src: '',
    alt: '',
  },
  links: {
    loginSuccess: '${openmrsSpaBase}/home',
  },
  languageSwitcher: {
    locales: [
      { locale: 'es', label: 'Español' },
      { locale: 'en', label: 'English' },
    ],
  },
  footer: {
    additionalLogos: [],
  },
  showPasswordOnSeparateScreen: true,
};
