# Private journal retention for native browser CI

DEV access was explicitly authorized and configured on **2026-10-22**, using the
receiver from `01273b64a3889a506217552a2fb411ab96686579`. Native browser results
and cleanup evidence by SHA are recorded in [#1252](https://github.com/sihsalus/sihsalus-frontend/pull/1252)
and [#1119](https://github.com/sihsalus/sihsalus-frontend/issues/1119).
This is DEV-only and reuses `PrivateFixtureJournal` and `SyntheticFixtures`.
Laboratory and O3 Forms CI remain outside this activation.

## Write ordering and failure

After each local atomic/fsynced journal save, CI sends the same state through
SSH to `u.hsc.dev@200.16.7.137`. The receiver appends an immutable private
checkpoint, fsyncs the file and directory, and returns its SHA-256 digest.
`save()` returns only after the sender verifies that digest. Consequently the
foundation's intent must be retained on DEV before an identifier, patient or
visit POST can proceed. Patient ownership checkpoints also support discovering
the encounters/orders created subsequently by the native specs.

Missing CI settings, host-key mismatch, timeout, transport failure, full storage
or incorrect acknowledgment fails the test. There is no automatic SSH retry,
clinical POST replay, journal upload artifact or automatic retention expiry.
Failure after a remote write can leave a durable checkpoint even when its
acknowledgment was lost; recovery treats it as retained intent. Local state is
also kept. Recovery still requires checking that the original writer exited.

The receiver uses Python 3 and the existing SSH service. It accepts only the
literal `checkpoint` command and a bounded DEV envelope; request data cannot
select a filesystem path or an executable. Files are mode 0600 in a canonical
mode-0700 directory. Updates append revisions identified by GitHub run/attempt,
a random journal ID, sequence and digest. A store lock serializes quota checks;
the OS releases that lock on process exit. It is separate from the foundation's
writer lock, which must never be cleared automatically. Storage stops at 64 MiB
or 10,000 files; an operator resolves capacity without deleting unresolved state.
This preserves state across runner loss; it is not a backup against loss of DEV.

## Approved DEV access policy

- Destination/account: existing `u.hsc.dev@200.16.7.137`, DEV only.
- Receiver: `/home/u.hsc.dev/.local/lib/sihsalus/e2e/receive-fixture-journal.py`,
  from the reviewed PR head, owner `u.hsc.dev`, mode 0500; private parent directory.
- Store: `/home/u.hsc.dev/.local/state/sihsalus/e2e-journals`, owner `u.hsc.dev`,
  mode 0700. The receiver does not expose read/list/delete operations to CI.
- New CI key: ED25519 fingerprint
  `SHA256:Ohp+v3aXLI00+71Qo7erP23NGqk7OExqUYmi2hdcut8`.
  It is authorized with the forced command below and held in the private GitHub
  secret. Key rotation or broader access requires a separate reviewed decision.
- Add this key to the existing account only with the following native OpenSSH
  restriction; preserve every existing authorized-key entry:

```text
restrict,command="/usr/bin/python3 /home/u.hsc.dev/.local/lib/sihsalus/e2e/receive-fixture-journal.py /home/u.hsc.dev/.local/state/sihsalus/e2e-journals" ssh-ed25519 <reviewed-public-key> sihsalus-frontend-e2e-dev-journals
```

OpenSSH's [`restrict` and forced command](https://man.openbsd.org/sshd.8#AUTHORIZED_KEYS_FILE_FORMAT)
disable forwarding, PTY and user RC and constrain shell/subsystem requests to
the receiver. The receiver rejects requests whose original command is not
`checkpoint`. Its process runs as the existing account: the security reviewer
must assess that trust and the receiver code before granting the key. No sudo,
Docker access, deployment operation or application-role grant is requested for
CI. A separate OS account remains an alternative if the environment owner
requires stronger process isolation; that needs administrator provisioning.

For installation/recovery after approval, the operator installs the reviewed receiver, verifies DEV's MAC
`00:0c:29:86:a3:3b`, creates the private store, preserves a recoverable copy of
`authorized_keys`, ensures `.ssh` is mode 0700 and `authorized_keys` is mode
0600 under the existing account, and appends exactly the restricted public-key entry. No SSH
service restart is required for an authorized-key update. Test the new key with
a synthetic empty journal and verify that shell, file reading, subsystem and
forwarding requests are denied. Recheck existing operator SSH access.

Then configure in `sihsalus/sihsalus-frontend`:

| Setting                                                                                                 | Source                                                                       |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Secret `E2E_JOURNAL_PRIVATE_KEY`                                                                        | Prepared CI key, supplied directly through the secret API; never chat or Git |
| Variable `E2E_JOURNAL_KNOWN_HOSTS`                                                                      | DEV's host key verified through the existing trusted operator connection     |
| `E2E_FIXTURE_IDENTIFIER_SOURCE_UUID`, `E2E_FIXTURE_IDENTIFIER_TYPE_UUID`, `E2E_FIXTURE_VISIT_TYPE_UUID` | Reviewed active DEV metadata; existing foundation contract                   |
| `E2E_FIXTURE_REQUIRED_PRIVILEGES`                                                                       | Reviewed complete JSON privilege list; no permission grants or defaults      |

The workflow supplies the exact build SHA and target opt-in and materializes
the key/known-hosts files privately. The client ignores local SSH configuration,
requires host verification and only uses this key. Only trusted repository PRs
reviewed for remote synthetic testing should receive the `e2e` label. Do not
expose the credential to fork workflows or reuse an operator/deployment key.
Record the final reviewed SHA and the separate access-policy approval.

## Interrupted-run recovery

1. Verify that the GitHub run/attempt and all original test workers have stopped.
   Use authorized operator SSH, not the CI key, to inspect the private store.
2. Select the exact run/attempt and journal ID. Verify each filename's digest
   against its exact bytes and inspect sequences. Divergent states for the same
   sequence require review; do not guess. Select the latest valid checkpoint.
3. Retain that envelope and reconstruct a new private local journal using
   `PrivateFixtureJournal.save(envelope.state)`. Do not copy the envelope itself
   as the foundation's state. Parse `state.binding` to restore the original
   target/location/source/type/visit/SHA/privilege configuration. Obtain current
   authorized credentials separately; checkpoints contain none.
4. Reuse the existing [foundation recovery procedure](NATIVE_SYNTHETIC_FIXTURES.md#cleanup-and-interrupted-runs):
   construct `SyntheticFixtures` with an authorized context, call `cleanup()`
   only, then independently close the journal and dispose the context. Verify
   ownership and every dependency. A denial or ambiguous record retains state.
5. Preserve evidence and checkpoints after verified cleanup. No rotation removes
   unresolved attempts. Review capacity separately with the environment owner.

The operator verified the restricted key against DEV, including denial of
shell/file/subsystem/forwarding requests. A writer was killed immediately after
its synthetic patient POST succeeded, before the foundation received the UUID.
A separate process reconstructed recovery solely from the remote checkpoint
and verified cleanup. The original local writer lock was retained, not cleared.
An empty checkpoint also survived loss of its acknowledgment. These checks
exercise storage/partial creation; the full native suite must separately record
its exact SHA, cases and verified cleanup before claiming clinical gate success.

Rollback: remove the new GitHub secret and the exact new authorized-key entry
after checking active writers. Retain receiver/store/journals for recovery.
Missing retention configuration stops future CI writes. Source rollback alone
does not retire already-created synthetic resources.
