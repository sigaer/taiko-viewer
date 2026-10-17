# Oracle arbitration — owner decision required

Baseline: Viewer `6e7f35b`, installed Taiko 0.14.2 wheel `0963350629b261fb5002bf6ef96c6019c22ca5c9515b73279f3c578d8e6725c8`. No accepted suite was rerun wholesale.

1. **Retired source-layout assertion: PASS.** `shared.ts` re-exports the canonical Publication writer. Its old slice is empty, so the regexp cannot measure writer provenance. The replacement executes real persisted current/history, proves installed module origin, and preserves input metadata without trusting caller-supplied writer identity. Two targeted bridge negative tests prove missing package rejection and isolated cwd/PYTHONPATH. 3 PASS; old 117/2 log retained.
2. **Passport semantic oracle: BLOCKED_PENDING_OWNER_DECISION.** Unchanged boundary input reproduces old DTO hash `14c7c098b8b22dc927a8bf198490ede62392c98a964fde37bf5ffcb0f1857ecb` and candidate hash `005c4f7f65484cc7e315ff376928d20f7087f08f1d89f1a4b180275c7d7b55a2`. The only DTO change is removal of milestone `milestone:1:1:2:4:2026-10-08:instant` (FC/PB inferred as a play across excluded/low-trust observation) and its references in all period views. The existing completed Goal milestone, frozen measurement value 7, coverage, current, segments, focus, and all other DTO content remain unchanged. The [exact proposed test patch](proposals/passport-semantic-oracle.patch) permits only this explicit removal and then retains strict full-DTO hash comparison. Frozen old source and original input stay unchanged. It is prepared, **not applied**.

[Side-by-side evidence](evidence/fast-passport-oracle-20261016.json) includes the complete old/new DTOs, every differing path, original input hashes, and eight paired counterexamples: same-source full reappearance, source-switch reappearance, explicit removal, direct switch, manual observation, delta omission, legitimate PB/NG/rank/FC, and next comparable improvement. New valid improvements remain. All eight candidate assertions pass. Initial diagnostic fixture omitted equal judgment totals and same-day rank/FC comparability and correctly failed; its log is retained, fixture corrected without product changes.

3. **Annual strict identity: BLOCKED, attribution complete.** The previous preservation test bounds the difference to summaryId, poster.summaryId, algorithmVersion and inputFingerprint, preserving old synthetic snapshot/report/cache bytes. No exact-equivalence claim is made after v4.5.4. New installed [identity evidence](evidence/fast-growth-identity-20261016.json) proves only old 0.14.1 exactly matches the approved checkpoint artifact. 0.14.2 selects the v2 content domain, with its independently reconstructed digest equal to the actual revision. Both artifacts contain the identical checkpoint bytes; there was no checkpoint regeneration. The original Annual identity FAIL remains unresolved until a legitimate version-aware oracle is accepted and targeted tests pass.

The Fast Track work order section 1A explicitly requires owner approval of the Passport semantic oracle revision; code fixes and approval to build 0.14.2 do not themselves grant this oracle waiver. No 0.82/0.83 gate is changed by this proposal.

## Independent review correction — proposal not yet ready to apply

The first eight direct-projection examples are insufficient to certify the full
loader policy. In the unchanged boundary input, chart 6's counter regression at
snapshot i=5 sets the loader's **global** `needsAuthoritativeBaseline`; chart 2's
FC/PB at i=7 is consequently `discontinuity-baseline`. The manual record at i=8 is
later and is not the initial cause. Sixty-four diff paths include array shifts,
not sixty-four independent fact changes. A full-loader, multiple-chart diagnostic
is being added to quantify legitimate improvements hidden until a full baseline.
The proposed patch is NOT applied, even while owner feedback is pending. A final
owner decision must explicitly address that conservative tradeoff, or require a
more precise comparability rule; a narrow fixture approval cannot waive it.

## Owner response — 2026-10-16

Owner explicitly approved: “批准该具体修订并运行受影响回归”. The exact
fixed-input patch is now applied; affected regression is pending execution.
This approves the listed milestone/reference transformation only. The separate
cross-chart global-baseline policy finding is **not waived** by that response.

## Affected tests and actual loader result

Approved fixed-fixture Oracle regression: **13 PASS / 0 FAIL**, including the
unchanged other Passport fixtures. Full DTO equality after the exact approved
transformation is independently verified by the diagnostic.

The [real-loader multiple-chart diagnostic](evidence/fast-oracle-multichart-20261016.json)
confirms a separate **FAIL**: after chart A counter regression or manual edit,
chart B's four otherwise comparable PB/NG/rank/FC facts are suppressed until a
complete authoritative baseline. Control and post-baseline next-change cases
verify exact values, IDs, time and provenance. Diagnostic execution PASS is not
a semantic preservation PASS. The user-approved fixed-fixture change does not
waive this finding. Keep History facts BLOCKED pending a narrower fix or an
explicitly reviewed policy decision covering this loss.

## Owner-approved per-chart repair closes Passport discrepancy

Owner chose “按谱面定向修复，保留合法改善”. Implementation `91c1d71` keeps batch L0 metadata while isolating manual/regressed chart comparability. Unaffected PB/NG/rank/FC facts retain complete values, times and provenance. Source/account/topology switches and unknown/import/repair remain globally conservative. Edited high scores cannot poison the restored chart baseline. New generated fact provenance is `observation-chart-continuity-v3`; old persisted measurements/reports are not rewritten.

The unchanged fixed Passport fixture now has **zero DTO differences against the frozen oracle**. The earlier approved milestone-removal exception is superseded and removed: full strict DTO comparison is restored. The affected suite is **13 PASS / 0 FAIL / 0 SKIP**. The integrated first invocation omitted the installed interpreter and failed with bridge unavailable; its log is preserved separately from the successful explicit installed-Python retry. Detailed hashes: `evidence/passport-chart-policy-closeout-20261016.json`. The earlier FAIL evidence remains historical evidence, not silently rewritten.
