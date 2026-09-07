import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PrivateFixtureJournal } from './e2e-fixture-journal';

const directories: string[] = [];
function temporaryDirectory() {
  const directory = mkdtempSync(path.join(realpathSync(tmpdir()), 'sihsalus-fixture-unit-'));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('private fixture journal (local temporary files only)', () => {
  it('writes private state atomically and retains it after releasing its lock', () => {
    const directory = temporaryDirectory();
    const journal = new PrivateFixtureJournal(directory);
    expect(journal.read()).toBeUndefined();
    journal.save({ synthetic: true, pending: 1 });
    journal.save({ synthetic: true, pending: 2 });
    expect(journal.read()).toEqual({ synthetic: true, pending: 2 });
    expect(statSync(path.join(directory, 'state.json')).mode & 0o077).toBe(0);
    journal.close();
    journal.close();
    expect(existsSync(path.join(directory, 'state.json'))).toBe(true);
    expect(existsSync(path.join(directory, 'writer.lock'))).toBe(false);
    const resumed = new PrivateFixtureJournal(directory);
    expect(resumed.read()).toEqual({ synthetic: true, pending: 2 });
    resumed.close();
  });

  it('rejects a second writer without overwriting existing recovery state', () => {
    const directory = temporaryDirectory();
    const journal = new PrivateFixtureJournal(directory);
    journal.save({ pending: true });
    expect(() => new PrivateFixtureJournal(directory)).toThrow(/locked/);
    expect(journal.read()).toEqual({ pending: true });
    journal.close();
  });

  it('rejects nonprivate directories without silently changing their permissions', () => {
    const directory = temporaryDirectory();
    chmodSync(directory, 0o755);
    expect(() => new PrivateFixtureJournal(directory)).toThrow(/private, canonical directory/);
    expect(statSync(directory).mode & 0o077).not.toBe(0);
  });

  it('rejects a symlinked directory', () => {
    const directory = temporaryDirectory();
    const link = path.join(temporaryDirectory(), 'link');
    symlinkSync(directory, link);
    expect(() => new PrivateFixtureJournal(link)).toThrow(/private, canonical directory/);
  });

  it('rejects unsafe state permissions and keeps malformed state for investigation', () => {
    const directory = temporaryDirectory();
    const journal = new PrivateFixtureJournal(directory);
    journal.save({ pending: true });
    const file = path.join(directory, 'state.json');
    chmodSync(file, 0o644);
    expect(() => journal.read()).toThrow(/private regular file/);
    chmodSync(file, 0o600);
    writeFileSync(file, 'invalid-json');
    expect(() => journal.read()).toThrow(/retain it for recovery/);
    expect(readFileSync(file, 'utf8')).toBe('invalid-json');
    journal.close();
  });

  it('does not read a symlinked state file', () => {
    const directory = temporaryDirectory();
    const target = path.join(temporaryDirectory(), 'untouched.json');
    writeFileSync(target, '{}', { mode: 0o600 });
    symlinkSync(target, path.join(directory, 'state.json'));
    const journal = new PrivateFixtureJournal(directory);
    expect(() => journal.read()).toThrow(/private regular file/);
    expect(readFileSync(target, 'utf8')).toBe('{}');
    journal.close();
  });

  it('rejects access after close', () => {
    const journal = new PrivateFixtureJournal(temporaryDirectory());
    journal.close();
    expect(() => journal.read()).toThrow(/closed/);
    expect(() => journal.save({})).toThrow(/closed/);
  });
});
