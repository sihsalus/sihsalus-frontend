export default {
  locales: ['en', 'es'],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    ignore: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}', 'src/**/__mocks__/**'],
    output: 'translations/{{language}}.json',
    // The shell assigns each app's runtime namespace when loading these flat catalogs.
    defaultNS: false,
    nsSeparator: false,
    useTranslationNames: [],
    removeUnusedKeys: false,
    defaultValue: '',
    sort: true,
    indentation: 2,
  },
};
