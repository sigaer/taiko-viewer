# Per-run QA evidence and disk limits

`bash scripts/memory/run_qa.sh /absolute/program [args...]` retains the existing shared maintenance lock, development QA cgroup, two CPU cores, 2/3 GiB memory, 256 MiB swap, 2 GiB per-file limit and 15-minute task deadline. It creates a fresh private run below `/home/sigaer/taiko/qa-vault/runs/qa-<12hex>`; it never prunes earlier runs or shared artifacts.

Child environment is explicit: `QA_RUN_ID`, `QA_RUN_DIR`, `QA_RUN_TMPDIR`, `QA_EVIDENCE_DIR`, `QA_ARTIFACT_MANIFEST`, `TMPDIR`, compatible `TAIKO_QA_*` aliases, `PATH` and `NODE_OPTIONS`. Parent-supplied run-directory values cannot override it. Proxy credentials and other ambient variables are not inherited. Tasks requiring configuration must explicitly read approved private files. Do not put secrets in command arguments, output or evidence filenames.

Write expendable intermediates, synthetic SQL datadirs and temporary sockets below `QA_RUN_TMPDIR` (`$QA_RUN_DIR/scratch`). Write results to `QA_EVIDENCE_DIR` (`$QA_RUN_DIR/evidence`). Runtime wheels/environments belong to the separately managed vault `artifacts` directory and its manifest, not scratch. The artifact manifest path must be absolute within the vault and have no symlink component; it may be absent for basic QA that does not use installed artifacts. Tasks consuming it must independently validate the actual artifact hashes before use.

The supervisor emits a JSON line containing run/evidence/scratch paths before launching. It records filesystem available bytes, per-run/scratch/evidence logical and allocated bytes, symlink counts and phases before, during, after child exit and after cleanup. Sampling runs every two seconds; this is an operational stop guard, not an instantaneous filesystem quota or monitoring of arbitrary paths outside the run.

Default scratch ceiling is 2 GiB (the larger of logical and allocated usage); minimum filesystem headroom is 5 GiB. The existing Annual 22 GiB admission requirement remains separate and unchanged. Output is capped at 64 MiB; individual files remain capped at 2 GiB. Low headroom, oversized scratch/output/files, unsafe directory substitution, timeout or interruption stops only this run's systemd unit. An exception may use `TAIKO_QA_SCRATCH_LIMIT_BYTES` with a nonsecret `TAIKO_QA_BUDGET_REASON_ID` identifying its documented approval; `TAIKO_QA_MIN_FREE_BYTES` may only increase the minimum. Increasing disk scratch does not increase memory or Annual worker limits.

After proving unit/cgroup exit, regular evidence files are fsynced and hashed, output is atomically finalized, and `manifest.json` is written atomically with status and metrics. Failed tasks retain evidence. Cleanup removes only this invocation's scratch directory after identity checks; if child exit or directory identity cannot be proved, it retains scratch and marks failure. Scratch symlinks (such as venv `lib64`) are counted without traversal; their outside targets survive cleanup. Scratch hardlinks are counted by name logically and by unique device/inode for allocated bytes; cleanup only unlinks owned names, preserving external links. Evidence symlinks, hardlinked files and symlink root/parent substitutions are rejected. The supervisor does not collect environment values or command arguments; task stdout itself must remain secret-free.

Validation: `scripts/memory/tests/test_qa_vault.py` covers failure retention, overflow, low-water/per-file checks, outside-file survival, scratch symlinks, directory substitution, evidence archive hashing, hardlinks, unproven child exit and environment/budget construction. `qa_wrapper_smoke.py` verifies the real environment/cgroup and deliberately leaves a child process for systemd teardown; inspect the preserved record and confirm both PIDs and scratch are gone. Neither test connects to SQL/network or production.

### Explicit owner aborts

Before stopping an active owned QA unit, use the control helper (do not acquire a second QA lock):

```sh
/usr/bin/python3 scripts/memory/qa_vault.py --abort-run /home/sigaer/taiko/qa-vault/runs/qa-0123456789ab --abort-reason MEMORY_PSI_FULL
```

It accepts only an active unit derived from a private, non-symlink run under the fixed vault root. It atomically fsyncs a mode0600 `evidence/abort.json` containing the run identity and a fixed nonsecret reason code before stopping that exact unit. The supervisor validates the marker, archives it and emits `exitCode=125`, `wrapperExitCode=125`, `stopReason=OWNER_ABORT_<reason>`, retaining the raw `processExitCode` separately. The control helper itself may return0 because stopping succeeded; this is not the QA task result.

No historical manifest is rewritten. In the earlier cold resource stop `qa-5593936cff4c`, systemd stop returned0 before this marker mechanism existed; its explicit Annual failure/abort record takes precedence over the old wrapper exit code. New abort-specific tests and a real no-business abort smoke are recorded separately; the original16 filesystem tests and600 warm requests were not rerun for this change.
