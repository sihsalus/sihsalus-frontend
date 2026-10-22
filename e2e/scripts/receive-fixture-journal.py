#!/usr/bin/env python3
"""Forced SSH command: retain bounded, immutable private E2E checkpoints only."""

import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import uuid

MAX_INPUT = 131_072
MAX_STORE_BYTES = 64 * 1024 * 1024
MAX_RECORDS = 10_000


def retain(root, payload):
    root = Path(root).absolute()
    metadata = root.lstat()
    if (root.resolve() != root or not stat.S_ISDIR(metadata.st_mode)
            or metadata.st_mode & 0o077 or metadata.st_uid != os.geteuid()):
        raise ValueError()
    envelope = json.loads(payload)
    if set(envelope) != {
        'version', 'repository', 'runId', 'runAttempt', 'commitSha',
        'journalId', 'sequence', 'state',
    }:
        raise ValueError()
    if (envelope['version'] != 1 or envelope['repository'] != 'sihsalus/sihsalus-frontend'
            or not re.fullmatch(r'[1-9][0-9]{0,19}', envelope['runId'])
            or not re.fullmatch(r'[1-9][0-9]{0,9}', envelope['runAttempt'])
            or not re.fullmatch(r'[0-9a-f]{40}', envelope['commitSha'])
            or str(uuid.UUID(envelope['journalId'])) != envelope['journalId']
            or type(envelope['sequence']) is not int
            or not 1 <= envelope['sequence'] <= MAX_RECORDS):
        raise ValueError()
    state = envelope['state']
    binding = json.loads(state['binding'])
    if (state['schemaVersion'] != 2 or binding['target'] != 'DEV'
            or binding['apiBaseUrl'] != 'https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs'):
        raise ValueError()
    digest = hashlib.sha256(payload).hexdigest()
    name = (f"{envelope['runId']}-{envelope['runAttempt']}-"
            f"{envelope['journalId']}-{envelope['sequence']:05d}-{digest}.json")
    # The OS releases this store lock after a killed receiver. Clinical journal
    # writer locks are separate and are never removed by this command.
    lock = os.open(root / '.checkpoint.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX)
        total = count = 0
        existing = False
        for entry in root.iterdir():
            info = entry.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
                raise ValueError()
            if entry.name == name:
                # No overwrites. An exact replay can recover a lost acknowledgment.
                if entry.read_bytes() != payload:
                    raise ValueError()
                existing = True
            total += info.st_size
            count += 1
        if not existing:
            if total + len(payload) > MAX_STORE_BYTES or count >= MAX_RECORDS:
                raise ValueError()
            descriptor, temporary = tempfile.mkstemp(prefix='.pending-', dir=root)
            try:
                with os.fdopen(descriptor, 'wb') as output:
                    output.write(payload)
                    output.flush()
                    os.fsync(output.fileno())
                os.link(temporary, root / name, follow_symlinks=False)
            finally:
                os.unlink(temporary)
        directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        return digest
    finally:
        os.close(lock)


def main():
    os.umask(0o077)
    if len(sys.argv) != 2 or os.environ.get('SSH_ORIGINAL_COMMAND') != 'checkpoint':
        raise ValueError()
    payload = sys.stdin.buffer.read(MAX_INPUT + 1)
    if len(payload) > MAX_INPUT:
        raise ValueError()
    print(retain(sys.argv[1], payload), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('FIXTURE_CHECKPOINT_REJECTED', file=sys.stderr)
        sys.exit(1)
