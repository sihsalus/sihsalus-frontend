import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Dockerfile build context', () => {
  it('copies shared illustrations before building app workspaces', () => {
    const dockerfile = readFileSync(path.resolve(process.cwd(), '../../..', 'Dockerfile'), 'utf8');
    const assetsCopyIndex = dockerfile.indexOf('COPY assets/ ./assets/');
    const appBuildIndex = dockerfile.indexOf("yarn turbo run build --filter='./packages/apps/*'");

    expect(assetsCopyIndex).toBeGreaterThanOrEqual(0);
    expect(appBuildIndex).toBeGreaterThanOrEqual(0);
    expect(assetsCopyIndex).toBeLessThan(appBuildIndex);
  });

  it('removes npm from runtime stages before publishing the init image', () => {
    const dockerfile = readFileSync(path.resolve(process.cwd(), '../../..', 'Dockerfile'), 'utf8');
    const npmRemovalCount = dockerfile.match(/rm -rf \/usr\/local\/lib\/node_modules\/npm/g)?.length ?? 0;

    expect(npmRemovalCount).toBeGreaterThanOrEqual(2);
  });
});
