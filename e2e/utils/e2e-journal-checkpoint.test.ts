import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrivateFixtureJournal } from './e2e-fixture-journal';
import { createSshJournalCheckpoint } from './e2e-journal-checkpoint';

const ssh = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', async (original) => ({
  ...(await original<typeof import('node:child_process')>()),
  execFileSync: ssh,
}));
const roots: string[] = [];
const receiver = path.resolve(__dirname, '../scripts/receive-fixture-journal.py');
const binding = JSON.stringify({ target: 'DEV', apiBaseUrl: 'https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs' });
const state = { schemaVersion: 2, binding, run: '11111111-1111-4111-8111-111111111111', patients: [] };
function setup() {
  const root = mkdtempSync(path.join(realpathSync(tmpdir()), 'e2e-checkpoint-unit-'));
  roots.push(root);
  const key = path.join(root, 'key');
  const knownHosts = path.join(root, 'known_hosts');
  writeFileSync(key, 'unit-test-key', { mode: 0o600 });
  writeFileSync(knownHosts, 'unit-test-host', { mode: 0o600 });
  const environment: NodeJS.ProcessEnv = {
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'sihsalus/sihsalus-frontend',
    GITHUB_RUN_ID: '12345',
    GITHUB_RUN_ATTEMPT: '2',
    GITHUB_SHA: 'a'.repeat(40),
    E2E_GATE_TARGET: 'DEV',
    E2E_JOURNAL_KEY_FILE: key,
    E2E_JOURNAL_KNOWN_HOSTS_FILE: knownHosts,
  };
  return { root, key, knownHosts, environment };
}
function envelope(sequence = 1) {
  return {
    version: 1,
    repository: 'sihsalus/sihsalus-frontend',
    runId: '12345',
    runAttempt: '2',
    commitSha: 'a'.repeat(40),
    journalId: '22222222-2222-4222-8222-222222222222',
    sequence,
    state,
  };
}
function receive(root: string, value: unknown, command = 'checkpoint') {
  return spawnSync('python3', [receiver, root], {
    input: typeof value === 'string' ? value : JSON.stringify(value),
    encoding: 'utf8',
    env: { ...process.env, SSH_ORIGINAL_COMMAND: command },
  });
}
afterEach(() => {
  ssh.mockReset();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

describe('durable checkpoint sender', () => {
  it('waits for the stored-byte digest and pins DEV, identity and host verification', () => {
    const { environment, root } = setup();
    ssh.mockImplementation(
      (_binary, _args, options) => `${createHash('sha256').update(options.input).digest('hex')}\n`,
    );
    const retain = createSshJournalCheckpoint(environment);
    const journal = new PrivateFixtureJournal(path.join(root, 'journal'), retain);
    try {
      journal.save(state);
      journal.save({ ...state, patients: [{ identifierAttempted: true }] });
      const calls = ssh.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]?.[0]).toBe('ssh');
      expect(calls[0]?.[1]).toEqual(
        expect.arrayContaining([
          'StrictHostKeyChecking=yes',
          'BatchMode=yes',
          'ConnectionAttempts=1',
          'IdentityAgent=none',
          '--',
          'u.hsc.dev@200.16.7.137',
          'checkpoint',
        ]),
      );
      const first = JSON.parse(calls[0]?.[2].input);
      const second = JSON.parse(calls[1]?.[2].input);
      expect(first).toMatchObject({ version: 1, runId: '12345', runAttempt: '2', sequence: 1, state });
      expect(second).toMatchObject({ journalId: first.journalId, sequence: 2 });
      expect(calls[0]?.[2]).toMatchObject({ timeout: 25_000, stdio: ['pipe', 'pipe', 'pipe'] });
    } finally {
      journal.close();
    }
  });

  it.each(['transport', 'ack'])('fails closed on %s failure, preserving the local recovery state', (failure) => {
    const { environment, root } = setup();
    ssh.mockImplementation(() => {
      if (failure === 'transport') throw new Error('private transport diagnostic');
      return 'bad-ack';
    });
    const journal = new PrivateFixtureJournal(path.join(root, 'journal'), createSshJournalCheckpoint(environment));
    try {
      expect(() => journal.save(state)).toThrow('FIXTURE_CHECKPOINT_UNCONFIRMED_RETAIN_JOURNAL');
      expect(journal.read()).toEqual(state);
      expect(ssh).toHaveBeenCalledOnce();
    } finally {
      journal.close();
    }
    expect(existsSync(path.join(root, 'journal', 'state.json'))).toBe(true);
  });

  it.each([
    { GITHUB_REPOSITORY: 'other/repository' },
    { E2E_GATE_TARGET: 'QLTY' },
    { GITHUB_RUN_ID: '../bad' },
    { GITHUB_SHA: 'short' },
    { E2E_JOURNAL_KEY_FILE: undefined },
    { GITHUB_ACTIONS: undefined },
  ])('rejects unbound CI configuration before SSH: %j', (override) => {
    const { environment } = setup();
    expect(() => createSshJournalCheckpoint({ ...environment, ...override })).toThrow(
      'NATIVE_CI_RECOVERY_RETENTION_UNAVAILABLE',
    );
    expect(ssh).not.toHaveBeenCalled();
  });

  it('rejects a shared-readable key', () => {
    const { environment, key } = setup();
    chmodSync(key, 0o644);
    expect(() => createSshJournalCheckpoint(environment)).toThrow('NATIVE_CI_RECOVERY_RETENTION_UNAVAILABLE');
  });
});

describe('forced-command receiver with real private files and child processes', () => {
  it('acknowledges retained bytes, survives sender exit and preserves every immutable revision', () => {
    const { root } = setup();
    const store = path.join(root, 'store');
    // The receiver requires an operator-created, private, canonical store.
    mkdirSync(store, { mode: 0o700 });
    const payload = JSON.stringify(envelope());
    const first = receive(store, payload);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toBe(`${createHash('sha256').update(payload).digest('hex')}\n`);
    const files = readdirSync(store).filter((name) => name.endsWith('.json'));
    expect(files).toHaveLength(1);
    const firstFile = files[0];
    if (!firstFile) throw new Error('Expected retained checkpoint');
    expect(readFileSync(path.join(store, firstFile), 'utf8')).toBe(payload);
    expect(statSync(path.join(store, firstFile)).mode & 0o777).toBe(0o600);
    expect(receive(store, envelope(2)).status).toBe(0);
    expect(receive(store, payload).status).toBe(0);
    expect(readdirSync(store).filter((name) => name.endsWith('.json'))).toHaveLength(2);
  });

  it.each([
    { ...envelope(), runId: '../escape' },
    { ...envelope(), repository: 'other/repo' },
    { ...envelope(), state: { ...state, binding: JSON.stringify({ target: 'QLTY' }) } },
    { ...envelope(), command: 'read' },
    'x'.repeat(131_073),
  ])('rejects invalid or oversized input without a checkpoint', (input) => {
    const { root } = setup();
    const result = receive(root, input);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('FIXTURE_CHECKPOINT_REJECTED\n');
    expect(readdirSync(root).some((name) => name.endsWith('.json'))).toBe(false);
  });

  it('refuses shell commands and a nonprivate destination', () => {
    const { root } = setup();
    expect(receive(root, envelope(), 'cat /etc/passwd').status).toBe(1);
    chmodSync(root, 0o755);
    expect(receive(root, envelope()).status).toBe(1);
  });

  it('refuses an exhausted store without rotating retained checkpoints', () => {
    const { root } = setup();
    const retained = path.join(root, 'retained-private-data');
    writeFileSync(retained, '', { mode: 0o600 });
    truncateSync(retained, 64 * 1024 * 1024);
    expect(receive(root, envelope()).status).toBe(1);
    expect(statSync(retained).size).toBe(64 * 1024 * 1024);
    expect(readdirSync(root).filter((name) => name.endsWith('.json'))).toEqual([]);
  });

  it('refuses symlink destinations and lock files', () => {
    const { root, key } = setup();
    const link = path.join(root, 'linked-store');
    symlinkSync(root, link);
    expect(receive(link, envelope()).status).toBe(1);
    rmSync(link);
    symlinkSync(key, path.join(root, '.checkpoint.lock'));
    expect(receive(root, envelope()).status).toBe(1);
    expect(readFileSync(key, 'utf8')).toBe('unit-test-key');
  });

  it('retains intent after an acknowledged remote write loses its response and the local journal is lost', () => {
    const { root, environment } = setup();
    const store = path.join(root, 'store');
    mkdirSync(store, { mode: 0o700 });
    ssh.mockImplementation((_binary, _args, options) => {
      const result = receive(store, options.input);
      expect(result.status, result.stderr).toBe(0);
      throw new Error('simulated lost response');
    });
    const local = path.join(root, 'local-journal');
    const journal = new PrivateFixtureJournal(local, createSshJournalCheckpoint(environment));
    try {
      expect(() => journal.save(state)).toThrow('FIXTURE_CHECKPOINT_UNCONFIRMED_RETAIN_JOURNAL');
    } finally {
      journal.close();
    }
    rmSync(local, { recursive: true });
    const files = readdirSync(store).filter((name) => name.endsWith('.json'));
    expect(files).toHaveLength(1);
    const firstFile = files[0];
    if (!firstFile) throw new Error('Expected retained checkpoint');
    const saved = readFileSync(path.join(store, firstFile), 'utf8');
    expect(JSON.parse(saved).state).toEqual(state);
    expect(files[0]).toContain(createHash('sha256').update(saved).digest('hex'));
  });
});
