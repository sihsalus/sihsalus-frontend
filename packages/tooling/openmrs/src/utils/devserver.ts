import { fork, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

export function waitForDevServerReady(ps: ChildProcess, source: string) {
  return new Promise<void>((resolve, reject) => {
    ps.on('message', (message: unknown) => {
      if (typeof message === 'object' && message !== null && 'type' in message) {
        if (message.type === 'compilation-complete') {
          resolve();
        } else if (message.type === 'compilation-failed') {
          reject(new Error(`Dev server compilation failed for ${source}`));
        }
      }
    });
    ps.on('error', reject);
    ps.on('exit', (code) => reject(new Error(`Dev server exited before it was ready (code ${code})`)));
  });
}

export function startDevServer(source: string, port: number, cwd = process.cwd()) {
  const runner = resolve(__dirname, 'debugger.js');
  const ps = fork(runner, [], { cwd });
  const ready = waitForDevServerReady(ps, source);

  ps.send({ source, port });

  return { process: ps, ready };
}
