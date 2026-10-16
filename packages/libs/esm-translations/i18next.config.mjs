export default {
  locales: ['en'],
  extract: {
    input: ['src/translations.ts'],
    output: 'translations/{{language}}.json',
    defaultNS: false,
    removeUnusedKeys: false,
    sort: true,
    indentation: 2,
  },
  plugins: [
    {
      name: 'core-translation-defaults',
      // The runtime keeps typed defaults in objects, rather than t() calls.
      // Reuse the CLI's parser so escapes and multiline strings stay intact.
      onVisitNode(node, { addKey }) {
        if (node.type === 'KeyValueProperty' && node.value.type === 'StringLiteral') {
          const key = node.key.type === 'Identifier' || node.key.type === 'StringLiteral' ? node.key.value : undefined;
          if (key) addKey({ key, defaultValue: node.value.value });
        }
      },
    },
  ],
};
