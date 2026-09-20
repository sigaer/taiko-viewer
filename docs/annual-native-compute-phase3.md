# Annual Native Compute Feasibility — Phase 3

Final decision: **NATIVE KERNEL — PARTIALLY JUSTIFIED**

Date: 2026-09-20 (Asia/Shanghai)

Python remains the Annual reference engine and sole production output owner. No native
binary, native code path, fallback or shadow execution was added to Viewer or the
production runtime. The Annual algorithm remains `annual-observation-v4.5.1`.

## Scope and test environment

The PoC was a local Rust 1.90 release-mode CLI under a private disk-backed `/var/tmp`
directory. It had no network listener, authentication, user-session state, admission
logic or persistent daemon. Compilation time was excluded from every benchmark.

All runs used the Phase 1/2 frozen corpus, bounded QA cgroups and private outputs. OS
page cache and swap were not cleared. “First process” below means the first measured
process after fixture generation, not a forced cold-cache claim.

Fixtures were not committed. Signature fixtures retained schema shape and approximate
encoded size while replacing user values deterministically. The replay plans remained
private mode-0600 artifacts and only hashes/counts are reported.

## Signature kernel

### Semantics implemented

The Rust candidate reproduces Python's current signature input contract:

```text
json.dumps(value,
  ensure_ascii=False,
  sort_keys=True,
  separators=(",", ":"),
  default=str).encode("utf-8")
```

Objects are recursively emitted with Unicode key ordering, compact separators and UTF-8
strings. `serde_json` was built with `arbitrary_precision`; integers are never coerced
through a float. Inputs are Python-normalized JSON lexemes, so floating-point spelling is
preserved by the native reader. Regression vectors cover positive and negative integers
beyond 64 bits, negative zero, exponent forms, Unicode, U+2028, control characters,
null, booleans, nested arrays and objects.

### Equivalence

- Representative states from all 24 equivalence accounts: 845/845 per-object canonical
  byte lengths and SHA-256 hashes matched exactly.
- `91899919`: 192,565 objects, 65,345,304 canonical bytes; stream digest matched.
- Fresh largest-input: 768,623 objects, 263,770,765 canonical bytes; stream digest
  matched.
- Repeated processes produced identical count, byte length and digest results.

There was no tolerant comparison. The per-object representative vector files were
byte-for-byte identical between Python and Rust.

### Signature performance

Three independent, alternating release runs were used. Internal elapsed time starts
after process/runtime initialization and includes JSONL read, JSON parse, canonical
serialization and stream hashing. Values are three-run medians unless marked first.

| Fixture | Engine | First-process s | Median s | User CPU s | Peak RSS MiB | Peak PSS MiB |
|---|---|---:|---:|---:|---:|---:|
| `91899919` | Python | 3.187 | 3.187 | 3.212 | 16.3 | 8.4 |
| `91899919` | Rust | 1.393 | 1.428 | 1.411 | 10.5 | 4.3 |
| largest | Python | 12.807 | 12.807 | 12.822 | 16.2 | 8.3 |
| largest | Rust | 5.868 | 6.076 | 6.029 | 10.8 | 4.4 |

Median wall speedup is 2.23x for `91899919` and 2.11x for largest. User-CPU speedup is
2.28x and 2.13x respectively. The signature-only decision gate therefore passes both
100% equivalence and the minimum 2x CPU requirement, though the margin is not large.

These are isolated batch-kernel results. They do not include the cost for Python to
serialize in-memory objects across a subprocess boundary. A production signature-only
offload would either pay that transfer cost or parse snapshot payloads twice, so the
microbenchmark cannot be treated as an Annual end-to-end speedup.

## Replay kernel

Because the signature gate passed, a second Rust CLI consumed a frozen SnapshotPlan and
payload stream. It implemented:

- full and delta state application;
- profile, achievement and dojo replacement;
- chart-key validation, update, deletion and re-addition;
- per-branch/chart canonical signatures;
- changed-key calculation;
- unchanged-snapshot suppression;
- source/source-account/topology identity transitions;
- deterministic rebuilt ordering and intermediate state hashes.

It did not implement planning, lineage inference, events, FinalTitle or summary logic.
Planning and lineage are versioned inputs to this PoC, as required by the proposed
kernel boundary.

### Replay equivalence

| Fixture | Plan entries | Rebuilt states | Result |
|---|---:|---:|---|
| `91899919` | 236 | 210 | exact artifact hash |
| fresh largest-input | 929 | 866 | exact artifact hash |
| synthetic edge fixture | 4 | 4 | exact artifact hash |

Each rebuilt artifact includes path/date ordering, source identity, source account,
merge topology, content hash, warnings, changed keys and a deterministic state hash over
profile, achievement, dojo and every sorted chart signature. The synthetic non-secret
fixture explicitly covers source switching, chart deletion/re-addition, branch changes,
Unicode and an integer larger than 64 bits.

### Replay performance

Python core replay time was measured from the first pass-2 payload load until
`load_snapshot_history` returned. Rust core time includes plan-stream parsing, payload
parsing, state reconstruction and canonical signatures. PoC-only validation artifact
generation is shown separately and excluded from the core speedup.

| Fixture | Python core s | Rust core s | Core speedup | Rust validation s | Python peak RSS/PSS MiB | Rust peak RSS/PSS MiB |
|---|---:|---:|---:|---:|---:|---:|
| `91899919` | 3.553 | 2.910 | 1.22x | 1.103 | 55.4 / 47.5 | 26.0 / 24.7 |
| largest | 14.696 | 13.367 | 1.10x | 2.422 | 49.0 / 41.1 | 27.1 / 25.6 |

Replay improvement is only about 18% and 9%. It is below both the 2x continuation signal
and, for largest, the phase's 30% “worth maintaining a second language” floor. The Rust
implementation does reduce PoC process memory, but memory is secondary and the current
Python production worker is already bounded to roughly 60–80 MiB after Phase 2.

## Events

Not implemented. Replay failed the strong-benefit gate, so migrating events would add
scope without evidence that the native boundary improves total Annual CPU enough.

## Maintenance complexity

A production native kernel would require all of the following:

- a pinned Rust toolchain, dependency audit and reproducible release artifact;
- dual-language canonical JSON regression tests, including arbitrary integers and
  Unicode/float edge cases;
- a stable SnapshotPlan/intermediate schema with compatibility handling;
- Python/Rust algorithm-version coordination and 24-account equivalence gates;
- explicit subprocess timeout, crash, output-size and resource isolation;
- sampled shadow comparison plus rollback ownership;
- debugging support for two implementations of replay state transitions.

The signature kernel alone saves CPU in isolation but creates a data-transfer boundary.
Moving replay across that boundary avoids duplicate signature transfer, yet the measured
replay benefit is weak. The maintenance cost is therefore not justified for a production
integration at present.

## Architecture if revisited

The least risky future shape remains a short-lived subprocess owned by the Python
lightweight CLI:

```text
Python SnapshotPlan/reference layer
  -> bounded native subprocess
  -> deterministic intermediate result
  -> Python events/summary/FinalTitle layer
```

The request should be idempotent and versioned:

```json
{
  "engineProtocolVersion": 1,
  "algorithmVersion": "annual-observation-v4.5.1",
  "inputFingerprint": "sha256:...",
  "generatedAt": "...",
  "inputManifest": []
}
```

The response should repeat the protocol, algorithm and input fingerprint and provide an
intermediate hash plus payload. Authentication, admission, queue state and user sessions
must remain outside the kernel. Native failures must be explicit. Any future fallback to
Python is allowed only in QA/shadow mode and must not hide a divergence. Controlled
sampled shadow comparison is preferred over running both engines for every production
request.

## Recommendation

The native signature primitive is technically viable and clears its isolated 2x gate.
The integrated replay boundary does not show enough CPU improvement to justify a second
production implementation language. Keep CPython as the only production and reference
engine, retain the PoC only as feasibility evidence, and do not proceed to events,
FinalTitle, summary integration or deployment.

No concurrency, queue, cgroup, Viewer, runtime or algorithm setting changed in this
phase.
