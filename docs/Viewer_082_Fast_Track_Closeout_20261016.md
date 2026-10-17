# Viewer 0.82.1 Fast-Track Closeout — 2026-10-16

**Status:** EXECUTION ORDER / O1 targets defined; overall `0.82 BLOCKED`.  
**Primary objective:** close the smallest defensible 0.82 release gate without repeating accepted migration work; allow Viewer 1.0 downstream implementation to proceed **in isolation**, without prematurely claiming `0.83 Contract Freeze`.

## 0. Fixed baseline and non-negotiable boundaries

- Work from the current **local**, clean `feat/viewer-1-readiness-20261015` candidate, not the stale remote main or old divergent Viewer ownership branch. Verify the actual local HEAD, log and diff before doing anything. Latest user-reported Viewer commits: `166897d`, `6e7f35b`; Viewer candidate version stays **0.82.1**. Do not guess their ancestry.
- Taiko 0.14.2 candidate source: `a632913dfbdbec1d465f8eaccc0bb80c35e25745`. Reported wheel SHA-256: `0963350629b261fb5002bf6ef96c6019c22ca5c9515b73279f3c578d8e6725c8`. Verify the *actual* artifact hash before use. Keep center `sakura-taiko-core 0.1.1` and client `0.1.2`; keep `python-memory-runtime 1.1.0` as an independently installed support distribution. Use fresh 94-package role locks, installed non-editable modules, selected absolute interpreters, `-I`, and existing resource isolation.
- Existing candidate evidence: center/client lifecycle `46 + 46` PASS; installed credential `11` PASS; new history fact `28` PASS (three false-play reproductions = zero); four worker SQL `119` PASS; 12 frozen PNG exact parity; Annual version `v4.5.4`, saved v4.5.2/v4.5.3 data untouched. **Do not rerun all of these from scratch without a changed closure**. Reuse only with pinned artifact identity and evidence hashes, and run targeted affected tests after each change.
- No push, PR, main merge, production deploy, restart, live API/SQL mutation, real user data/credential read, production ACL/config inspection, or production-backed load test without a separate explicit authorization. No modifying active/dirty worktrees. Use isolated synthetic data and fresh private SQL fixtures. Never downgrade authorization, silently rewrite historic reports/measurements, regenerate Growth compatibility checkpoints to force parity, create a Sakura/PYTHONPATH fallback, weaken tests to xfail, or raise Annual cgroup/concurrency limits to pass tests.

## 1. Critical path: three bounded gates (in parallel where safe)

### A — Oracle arbitration (priority 0, immediate)

Handle the three distinct residual compatibility findings, with original failing logs preserved:

| Finding | Required decision procedure | Closing evidence |
|---|---|---|
| Old source layout assertion | Confirm it asserts a retired path rather than business semantics. Replace obsolete path checking with installed-package origin, `-I` and missing-Sakura-fallback assertions. | Old assertion rationale + updated meaningful assertion + PASS |
| Legacy Passport oracle creates low-trust attendance | Compare frozen old oracle and new fixed fact semantics using unchanged input; show that source-switch/deletion/reappearance never proves a play. Preserve legitimate PB/NG/rank/clear changes. Owner must explicitly approve a **semantic oracle revision**. | Side-by-side facts, complete counterexample cases, owner decision, affected suites PASS |
| Retained strict identity FAIL from combined source suite | Attribute to content identity / version-domain changes vs unintended compatibility break. Inspect pinned manifest and checkpoint; verify old Growth revision only for exactly the approved equivalent artifact. | Distinct comparison report and PASS after legitimate fix, or explicit BLOCKED; no silent compatibility identity reset |

Do not turn a *known failing test* into success by exclusion. Any unresolved case remains `BLOCKED` and must be named in the final gate report.

### B — O1 performance evidence (priority 0, start immediately)

Measure end-to-end request or task lifecycle **wall time** on the current installed 0.14.2 + Viewer 0.82.1 combination, not unit-function time or aggregate validation-suite duration.

| Operation | P95 | P99 | Notes |
|---|---:|---:|---|
| B30 image, complete uncached generation | 8 s | 15 s | Hard cap 30 s; cached route measured separately if supported |
| Growth Overview / 90-day History | 3 s | 6 s | Real service graph with isolated DB and synthetic history |
| Growth Passport | 5 s | 10 s | Extremal 2000-file workload separately monitored, single-call bound 15 s |
| Annual cache-hit report read | 0.8 s | 2 s | Preserve existing readiness criteria |
| Annual cold job, *including queue* | 30 s | 90 s | Individual hard completion 180 s; separate generator runtime from total elapsed |
| Private current read | 0.8 s | 2 s | Include authentication/grant validation and serialization |
| Private merged / history read | 2.5 s | 6 s | Hard cap 10 s |

Operational constraints: supported-load success >=99.5%; record timeouts, 429, dropped slots and unfinished requests **separately**, never omit them from outcome reporting; cgroup OOM and OOM-kill count = 0. Record P50/P95/P99, N, failure distribution, queue wait, resource pressure (PSI, RSS/PSS if available, IO, swap) and exact manifest per scenario. Normal B30/Growth/private operations: prefer >=200 completed samples per scenario under 1, 3 and 5 concurrency, or explicitly label insufficient sample `EVIDENCE_PENDING`. Annual warm stages preserve 1/s → 3/s → 5/s prerequisites, 30 distinct cold identities, generator concurrency=2 and renderer=1. Stay within the existing per-QA 15-minute cgroup wrapper by splitting scenarios, not by broadening limits. Before high load, prove isolation and stop automatically on resource pressure. Do not run stress tests against production.

If a target is missed, retain the full failure and diagnose old-baseline vs newly introduced regression. Do not alter committed budgets without explicit owner approval.

### C — Recovery / network admission (priority 0, divided by permission)

**Offline now:** demonstrate recoverability across consistent SQL + current/history publication + historical daily measurement/archive + Goal + developer grant/token revocation state + historical Annual identity. Use synthetic data, controlled faults and independent restored instances. Capture exact recoverable checkpoint timestamps, monotonically increasing publication identities, hash parity, and elapsed `incident → core service ready` time. Targets: **RPO <=15 min, RTO <=120 min**. Show revoked or expired grants do not regain access after restore; otherwise require fail-closed invalidation. Confirm encrypted durable off-host backup of the 12 quarantined resources and documented rights/provenance clearance *without redistributing the private resources into public Taiko*. If no authorized off-host destination exists, retain the backup line as `BLOCKED` rather than invent one.

**Permission-gated only:** prepare a read-only production ingress/ACL and deployed-runtime audit protocol (bind address, reverse-proxy route allowlist/deny rules, systemd ExecStart / interpreter, actual wheel fingerprints, firewall/service identity), but **do not execute on the live environment** until explicitly authorized. Never put secrets in a report. If admission verification is missing, 0.82 release remains BLOCKED; this should not stop offline work.

## 2. Non-blocking parallel track: preparation for Viewer 1.0

Do **not** declare 0.83 Freeze or make API compatibility promises yet. In a separate isolated branch/worktree, prepare non-production, feature-flagged scaffolding:

- Developer API v1 draft: distinguish developer client identity/quota from resource-specific `ResourceGrant`, owner, audience, scopes, consent and revocation/expiry; design private score/history read with explicit grants, pagination, stable error objects and content/data/model revisions. No broad raw userdata disclosure and no implicit authorization from the current 24-char developer token.
- Single data contract roadmap: authoritative score publication and source semantics; user/Web/QQ/taiko binding namespace; current vs history observation vs canonical fact vs persisted measurement; chart/region/single-double and v1/v2 model revisions. Reuse existing `sakura-taiko-contract` schema and read profiles. Avoid another parallel source of truth.
- Viewer product backlog: plan newer Home IA/guest/personal state, Sidebar/mobile TabBar, recommendation→practice goal→sync feedback→Weekly/Session recap, then community and developer platform. Design/API mocks can proceed without freezing or touching runtime/SQL production.

These drafts are tracked as **READY_FOR_FREEZE_REVIEW**, never as `0.83 PASS` while the 0.82 production gate is open.

## 3. Fast execution windows (targets, not time-based waivers)

| Window | Highest-value deliverable | Stop condition |
|---|---|---|
| First 0–8 hours of available engineering time | Oracle disposition with evidence; O1 harness smoke; recovery test-plan and input manifest | Any semantic regression or authorization boundary failure |
| Next 8–24 hours | O1 measured cohorts, stage-by-stage warm/cold load, reproducible synthetic restore exercise | OOM/PSI alarm, unisolated SQL/network, missing provenance |
| Next 24–48 hours | Aggregate gate matrix, finish repair/targeted regressions, document production-only signoffs still required; submit v1 API/contract draft for review | Do not merge/deploy or declare 0.83 Freeze absent required evidence |

These are priority timeboxes, **not guaranteed completion dates**. If the live ingress, durable backups or production restore point require external permissions, report a concise owner action and progress all other paths.

## 4. One-page outcome / acceptance gate

Produce `docs/platform-architecture-audit/082-final-gate-20261016.md` and structured `evidence/082-final-gate.json` (new timestamped names if repeated), with:

1. fixed local and wheel digests, installed roles, independent runtime-memory package, schema/revision, baseline vs candidate and origin checks;
2. each remaining oracle case with expected/actual/evidence/owner disposition;
3. per-operation O1 P50/P95/P99, N, load schedule, failure/429/timeout/dropped statistics, resource/cgroup and compare-to-baseline;
4. consistency/recovery RPO/RTO evidence, encrypted off-host backup status, successful authorization continuity and publication revision proof;
5. production-only ingress/ACL/runtime identity: `PENDING_AUTHORIZATION` until authorized read-only audit actually returns evidence;
6. precise gate `PASS / FAIL / BLOCKED / NOT_TESTED`, owner signature requirement, safe rollback point (do not guess deployed interpreter/commit);
7. the 1.0 non-blocking draft artifacts and their explicitly non-frozen status.

**Exit:** 0.82 PASS only when its code/oracle, security, full integration, restoration/performance and production-bound acceptance requirements are genuinely closed and signed. Otherwise preserve BLOCKED with an exact minimal punch-list; continue the non-blocking 1.0 preparation in isolation.

## 5. Copy-to-Codex execution directive

> 在已存在的 Viewer 0.82.1 隔离干净工作树、Taiko 0.14.2 精确 wheel 与两份 94 包角色锁基础上，执行本文件第 1–4 节。不要重新复制源码或从头重做已签收的 46×2 / 119 / 12 PNG 套件。优先裁决三个旧 oracle 失败，然后并行启动 O1 性能与隔离恢复实测，准备但不执行生产只读 ACL 审核；同时在独立工作树产出未冻结的 Developer API v1 / ResourceGrant 数据契约草案。所有修改必须通过已有 run_qa.sh/run_build.sh，使用 synthetic fixtures，不得连接生产、推送、合入或部署，保持 0.82.1 与 0.82 BLOCKED 直到 owner 书面签收。最后输出可复核的 Gate 矩阵、确切剩余阻断及下一条最短路径。遇到无法离线获得的生产权限/异地存储依赖，不要等待而空转，标记 PENDING_AUTHORIZATION 并继续其他工作。
