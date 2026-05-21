import { Type, validator, validators } from '@openmrs/esm-framework';

export const configSchema = {
  provider: {
    type: {
      _type: Type.String,
      _default: 'basic',
      _description:
        "Selects the login mechanism to use. Choices are 'basic', 'oauth2' and 'custom'. " +
        "For 'custom' and 'oauth2', you'll also need to set the 'loginUrl'",
      _validators: [validators.oneOf(['basic', 'custom', 'oauth2'])],
    },
    loginUrl: {
      _type: Type.String,
      _default: '${openmrsSpaBase}/login',
      _description: 'The URL to use to login. This is only needed if you are using OAuth2.',
      _validators: [validators.isUrl],
    },
    logoutUrl: {
      _type: Type.String,
      _default: '${openmrsSpaBase}/logout',
      _description: 'The URL to use to login. This is only needed if you are using OAuth2.',
      _validators: [validators.isUrl],
    },
  },
  chooseLocation: {
    enabled: {
      _type: Type.Boolean,
      _default: true,
      _description:
        "Whether to show a 'Choose Location' screen after login. " +
        "If true, the user will be taken to the URL set in the 'links.loginSuccess' config property after choosing a location.",
    },
    numberToShow: {
      _type: Type.Number,
      _default: 8,
      _description: 'The number of locations displayed in the location picker.',
      _validators: [validator((v: unknown) => typeof v === 'number' && v > 0, 'Must be greater than zero')],
    },
    locationsPerRequest: {
      _type: Type.Number,
      _default: 50,
      _description: 'The number of results to fetch in each cycle of infinite scroll.',
      _validators: [validator((v: unknown) => typeof v === 'number' && v > 0, 'Must be greater than zero')],
    },
    useLoginLocationTag: {
      _type: Type.Boolean,
      _default: true,
      _description:
        "Whether to display only locations with the 'Login Location' tag. If false, all locations are shown.",
    },
  },
  links: {
    loginSuccess: {
      _type: Type.String,
      _default: '${openmrsSpaBase}/home',
      _description: 'The URL to redirect the user to after a successful login.',
      _validators: [validators.isUrl],
    },
  },
  languageSwitcher: {
    locales: {
      _type: Type.Array,
      _elements: {
        _type: Type.Object,
        locale: {
          _type: Type.String,
          _required: true,
          _description: 'The locale code to pass to i18next.',
        },
        label: {
          _type: Type.String,
          _required: true,
          _description: 'The display label for the locale in the login language menu.',
        },
      },
      _default: [
        { locale: 'es', label: 'Español' },
        { locale: 'en', label: 'English' },
        { locale: 'pt', label: 'Português' },
        { locale: 'fr', label: 'Français' },
      ],
      _description: 'Language options displayed on the login page before authentication.',
    },
  },
  logo: {
    src: {
      _type: Type.String,
      _default: '${openmrsSpaBase}/sihsalus-vertical.svg',
      _description:
        'The path or URL to the Sihsalus logo image. If set to an empty string, the Sihsalus wordmark text is used.',
      _validators: [validators.isUrl],
    },
    alt: {
      _type: Type.String,
      _default: '',
      _description: 'The alternative text for the logo image, displayed when the image cannot be loaded or on hover.',
    },
  },
  footer: {
    additionalLogos: {
      _type: Type.Array,
      _elements: {
        _type: Type.Object,
        src: {
          _type: Type.String,
          _required: true,
          _description: 'The source URL of the logo image',
          _validators: [validators.isUrl],
        },
        alt: {
          _type: Type.String,
          _required: true,
          _description: 'The alternative text for the logo image',
        },
      },
      _default: [],
      _description: 'An array of partner logos to be displayed in the login footer.',
    },
  },
  showPasswordOnSeparateScreen: {
    _type: Type.Boolean,
    _default: false,
    _description:
      'Whether to show the password field on a separate screen. If false, the password field will be shown on the same screen.',
  },
  background: {
    _type: Type.Object,
    _description:
      'Customizes the login page background. Either a background image URL or a CSS color may be set. If both are set, the image is used.',
    image: {
      _type: Type.String,
      _default: '',
      _description:
        'URL to a background image. Relative paths are interpolated via ${openmrsBase} / ${openmrsSpaBase}.',
      _validators: [validators.isUrl],
    },
    color: {
      _type: Type.String,
      _default: '',
      _description: 'CSS color value (e.g. "#0066cc" or "rgb(0,102,204)"). Used when no image is set.',
    },
  },
  announcements: {
    _type: Type.Array,
    _description:
      'Message banners displayed above the login form. Each entry renders as a Carbon InlineNotification. `title` and `text` may be either literal strings or translation keys.',
    _elements: {
      _type: Type.Object,
      title: {
        _type: Type.String,
        _default: '',
        _description: 'Optional title shown at the top of the banner. May be a translation key.',
      },
      text: {
        _type: Type.String,
        _required: true,
        _description: 'Banner body text. May be a translation key.',
      },
      kind: {
        _type: Type.String,
        _default: 'info',
        _description: 'The visual style of the banner. One of: info, warning, error, success.',
        _validators: [validators.oneOf(['info', 'warning', 'error', 'success'])],
      },
    },
    _default: [],
  },
};

export interface ConfigSchema {
  announcements: Array<{
    title: string;
    text: string;
    kind: 'info' | 'warning' | 'error' | 'success';
  }>;
  background: {
    image: string;
    color: string;
  };
  chooseLocation: {
    enabled: boolean;
    locationsPerRequest: number;
    numberToShow: number;
    useLoginLocationTag: boolean;
  };
  footer: {
    additionalLogos: Array<{
      alt: string;
      src: string;
    }>;
  };
  links: {
    loginSuccess: string;
  };
  languageSwitcher: {
    locales: Array<{
      label: string;
      locale: string;
    }>;
  };
  logo: {
    alt: string;
    src: string;
  };
  provider: {
    loginUrl: string;
    logoutUrl: string;
    type: 'basic' | 'custom' | 'oauth2';
  };
  showPasswordOnSeparateScreen: boolean;
}
