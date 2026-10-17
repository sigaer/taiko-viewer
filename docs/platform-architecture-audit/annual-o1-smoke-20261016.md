# Annual O1 smoke — not a performance pass

The added `annualO1SmokeSql.test.mjs` prepares real authenticated loopback Annual GET/POST/job routes, the actual SQL durable queue, installed worker launcher and isolated admission ledger. It retains generator limit 2, renderer limit 1 and existing memory/disk admission. Synthetic SQL/data/catalog and Beta telemetry sink are isolated from production. No active ledger or production configuration is accessed.

A single cold identity followed by three tiny warm scheduling stages at 1/s, 3/s and 5/s is **smoke only**. It cannot meet the required 30 distinct cold identities, full representative history strata, >=200 successful warm samples per scenario or baseline comparison. Wall time spans POST admission through observed terminal job, including queue and polling; generator runtime cannot substitute for this task measure.

## Retained outcomes

1. Initial harness import failed because the generic catalog fixture omitted `getSongCoverUrl`; no requests/workers were measured.
2. First repair still failed because the generic module hook took precedence. Both logs remain FAIL.
3. Corrected Annual-specific catalog hook reached the real API: anonymous GET returned 401; authenticated build POST returned 503. No cold job completed and no cached GET samples were fabricated.

Read-only diagnosis found the same disk filesystem below the unchanged Annual **22 GiB** new-build guard (`hardening.ts`). This explains the observed 503 by code-path inspection; the third run did not record the response's detailed error body, so that specific reason was not directly captured in the original HTTP evidence. The next invocation records pre-admission available bytes and sanitized HTTP error fields explicitly.

Only this task's nine stopped disposable MySQL datadirs were later reclaimed after verifying retained daemon-exit evidence, absent PID files and absent sockets. Logs, evidence, serialized checkpoint and recovered userdata/Annual files remain. See `evidence/fast-owned-sql-cleanup-20261016.json`. Available bytes increased to 22,750,633,984, still below the guard's 23,622,320,128 bytes; the test was not pointlessly rerun or the guard relaxed. A new SQL instance also needs its own disk headroom.

**Annual cold and cached performance: EVIDENCE_PENDING / BLOCKED_RESOURCE_ADMISSION.** Next step: safely regain sufficient authorized disposable storage headroom, rerun this smoke under the shared QA slot, then expand successful request/task measurement to the stated cohorts. Do not infer Annual SLO compliance from previous generator-only tests or from other operations' request timings.
