import { randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export interface FixtureJournal {
  read(): unknown;
  save(value: unknown): void;
}

/** Private, atomic journal with an exclusive writer lock; never removes recovery state. */
export class PrivateFixtureJournal implements FixtureJournal {
  private readonly file: string;
  private readonly lock: string;
  private closed = false;

  constructor(directory: string) {
    const resolved = path.resolve(directory);
    if (!existsSync(resolved)) mkdirSync(resolved, { mode: 0o700 });
    const stat = lstatSync(resolved);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (stat.mode & 0o077) !== 0 ||
      realpathSync(resolved) !== resolved
    ) {
      throw new Error('Fixture journal requires a private, canonical directory.');
    }
    this.file = path.join(resolved, 'state.json');
    this.lock = path.join(resolved, 'writer.lock');
    let descriptor: number;
    try {
      descriptor = openSync(this.lock, 'wx', 0o600);
    } catch {
      throw new Error('Fixture journal is locked; coordinate recovery before proceeding.');
    }
    closeSync(descriptor);
  }

  read(): unknown {
    if (this.closed) throw new Error('Fixture journal is closed.');
    if (!existsSync(this.file)) return undefined;
    const stat = lstatSync(this.file);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
      throw new Error('Fixture journal state is not a private regular file.');
    }
    const descriptor = openSync(this.file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      return JSON.parse(readFileSync(descriptor, 'utf8'));
    } catch {
      throw new Error('Fixture journal state is unreadable; retain it for recovery.');
    } finally {
      closeSync(descriptor);
    }
  }

  save(value: unknown): void {
    if (this.closed) throw new Error('Fixture journal is closed.');
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    const descriptor = openSync(temporary, 'wx', 0o600);
    try {
      writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, this.file);
    const directoryDescriptor = openSync(path.dirname(this.file), 'r');
    try {
      fsyncSync(directoryDescriptor);
    } finally {
      closeSync(directoryDescriptor);
    }
  }

  /** Release only this process's lock. A completed or failed run's state is retained. */
  close(): void {
    if (this.closed) return;
    unlinkSync(this.lock);
    this.closed = true;
  }
}
