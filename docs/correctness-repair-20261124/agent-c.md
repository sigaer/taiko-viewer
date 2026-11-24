# C — Chart Timeline

Native C provided integration rules and independently hand-calculated golden expectations. Lead executed reproduction, edits and tests because child tools were absent.

Audit reproduction before repair: mid-bar BPM fixture returned 1000 ms instead of 750; a one-second DELAY returned 1000 ms instead of 2000. Evidence `/var/tmp/taiko-correctness-20261124/evidence/c-baseline.log` (qa-93d23aab55e6). An earlier harness invocation used host /usr/bin/node without --test support; retried with actual production Node 24.22.1.

Fixes: retain delay command index; integrate intervals piecewise across BPM changes; include boundary delays once; preserve empty bar duration; defer mid-bar MEASURE to next bar; enforce same-bar maxMeasures. Existing long-note endpoint selection stays unchanged. Pinned source manifest retains upstream hashes and records local patches. No difficulty score/algorithm or agent system added.

Golden corpus: 29 tests including parent PASS, Node 24.22.1 via run_qa.sh, evidence c-fixed.log. Covers BPM boundary/repetition, positive/negative delay, measure, cross-bar/empty bars, source note sequence, comments, big notes, independent N/E/M paths and roll/balloon handling modes. One initially handwritten long-note expected value was corrected after recounting eight slots; production code was not altered to satisfy the incorrect oracle.

OFFSET tests prove relative-gap invariance only. No new authoritative absolute audio-alignment API is introduced; actual audio/fumen synchronization and dynamic branch/LEVELHOLD simulation remain unverified. Core roll parser is unchanged and its existing tests are included in lead validation. This does not claim all corpus timing semantics are proven.
