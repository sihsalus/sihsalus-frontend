import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';

import { waitForDevServerReady } from './devserver';

function fakeChild() {
  return new EventEmitter() as ChildProcess;
}

describe('OpenMRS 10 local module startup', () => {
  it('waits for a successful first compilation', async () => {
    const child = fakeChild();
    const ready = waitForDevServerReady(child, 'module/rspack.config.js');

    child.emit('message', { type: 'compilation-complete' });

    await expect(ready).resolves.toBeUndefined();
  });

  it('rejects a failed compilation or an early exit', async () => {
    const failed = fakeChild();
    const failedReady = waitForDevServerReady(failed, 'module/rspack.config.js');
    failed.emit('message', { type: 'compilation-failed' });
    await expect(failedReady).rejects.toThrow('compilation failed');

    const exited = fakeChild();
    const exitedReady = waitForDevServerReady(exited, 'module/rspack.config.js');
    exited.emit('exit', 1);
    await expect(exitedReady).rejects.toThrow('exited before it was ready');
  });
});
