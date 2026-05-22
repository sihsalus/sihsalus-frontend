import path from 'node:path';
import { defineWorkspaceVitestConfig } from '../../tooling/configs/vitest-config';

export default defineWorkspaceVitestConfig({
  plugins: [
    {
      name: 'mock-scss-modules',
      enforce: 'pre',
      load(id) {
        if (!id.endsWith('.module.scss')) {
          return null;
        }

        return `
          const styles = new Proxy({}, {
            get: (_target, property) => typeof property === 'string' ? property : '',
          });
          export default styles;
        `;
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: /^@openmrs\/esm-react-utils(\/mock)?$/,
        replacement: path.resolve(__dirname, '../esm-react-utils/mock.tsx'),
      },
    ],
  },
  test: {
    fileParallelism: false,
    setupFiles: ['./setup-tests.ts'],
  },
});
