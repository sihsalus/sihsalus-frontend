import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';

function privateFile(file: string | undefined): string {
  if (!file || !path.isAbsolute(file)) throw new Error('NATIVE_CI_RECOVERY_RETENTION_UNAVAILABLE');
  const stat = lstatSync(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    stat.uid !== process.getuid?.() ||
    realpathSync(file) !== file
  ) {
    throw new Error('NATIVE_CI_RECOVERY_RETENTION_UNAVAILABLE');
  }
  return file;
}

/** Append a private checkpoint on DEV before returning control to clinical writes. */
export function createSshJournalCheckpoint(environment: NodeJS.ProcessEnv): (value: unknown) => void {
  try {
    if (
      environment.GITHUB_ACTIONS !== 'true' ||
      environment.GITHUB_REPOSITORY !== 'sihsalus/sihsalus-frontend' ||
      environment.E2E_GATE_TARGET !== 'DEV' ||
      !/^[1-9][0-9]{0,19}$/.test(environment.GITHUB_RUN_ID ?? '') ||
      !/^[1-9][0-9]{0,9}$/.test(environment.GITHUB_RUN_ATTEMPT ?? '') ||
      !/^[0-9a-f]{40}$/.test(environment.GITHUB_SHA ?? '')
    ) {
      throw new Error('NATIVE_CI_RECOVERY_RETENTION_UNAVAILABLE');
    }
    const key = privateFile(environment.E2E_JOURNAL_KEY_FILE);
    const knownHosts = privateFile(environment.E2E_JOURNAL_KNOWN_HOSTS_FILE);
    const journalId = randomUUID();
    let sequence = 0;
    return (state: unknown) => {
      const input = JSON.stringify({
        version: 1,
        repository: environment.GITHUB_REPOSITORY,
        runId: environment.GITHUB_RUN_ID,
        runAttempt: environment.GITHUB_RUN_ATTEMPT,
        commitSha: environment.GITHUB_SHA,
        journalId,
        sequence: ++sequence,
        state,
      });
      if (Buffer.byteLength(input) > 131_072) throw new Error('FIXTURE_CHECKPOINT_TOO_LARGE_RETAIN_JOURNAL');
      const digest = createHash('sha256').update(input).digest('hex');
      try {
        const acknowledgment = execFileSync(
          'ssh',
          [
            '-F',
            '/dev/null',
            '-T',
            '-i',
            key,
            '-o',
            'BatchMode=yes',
            '-o',
            'IdentitiesOnly=yes',
            '-o',
            'IdentityAgent=none',
            '-o',
            'StrictHostKeyChecking=yes',
            '-o',
            `UserKnownHostsFile=${knownHosts}`,
            '-o',
            'GlobalKnownHostsFile=/dev/null',
            '-o',
            'ClearAllForwardings=yes',
            '-o',
            'ConnectionAttempts=1',
            '-o',
            'ConnectTimeout=10',
            '-o',
            'ServerAliveInterval=5',
            '-o',
            'ServerAliveCountMax=2',
            '--',
            'u.hsc.dev@200.16.7.137',
            'checkpoint',
          ],
          { input, encoding: 'utf8', timeout: 25_000, maxBuffer: 4096, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        if (acknowledgment !== `${digest}\n`) throw new Error('CHECKPOINT_ACK_MISMATCH');
      } catch {
        throw new Error('FIXTURE_CHECKPOINT_UNCONFIRMED_RETAIN_JOURNAL');
      }
    };
  } catch {
    throw new Error('NATIVE_CI_RECOVERY_RETENTION_UNAVAILABLE');
  }
}
