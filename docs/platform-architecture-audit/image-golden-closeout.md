# R4 installed image parity — 2026-10-16

This is additional image evidence for the existing **94-distribution center environment**, Core `0.1.1`, without changing the wheel, dependency lock, renderer algorithm, frozen oracle or original fixtures. It supersedes the initial image-test status in the earlier worker inventory only for explicitly verified cases; it does not upgrade overall release Gates.

The bounded launcher executes the existing `tests/viewer/render_parity.py` and its original family fixtures under `-I`. The launcher verifies installed product package/module origins before and after execution. Original fixture guards prohibit network/SQL and production-file access. Only generated synthetic userdata, frozen public source and the previously approved `/var/tmp/taiko-phase2fe-20261014/assets` are used. No quarantined private resources, real credentials or production userdata are accessed.

Each image comparison renders the frozen implementation and installed Viewer Python adapter with identical synthetic inputs and pinned fonts/dependencies, then compares PNG SHA-256. The launcher repeats the comparison and records both hashes, input-source hashes and public-asset hashes. This proves scoped frozen-implementation parity; it is not comparison with every previously published production PNG. The prior real TypeScript B30/dimension/radar callsite tests remain separate evidence.

| Family | PNG cases |
|---|---|
| B30 | B30, dimension, radar |
| Progress | pass, comprehensive, star, named-list, dani |
| Personal | MyDon, word cloud |
| Trend | rating trend |
| Recommendation | recommendation image |

Initial run `evidence/r4-image-goldens-20261016.json` is retained as a setup failure: the baseline directory parameters omitted the nested `taiko` directory and two families selected the wrong frozen snapshot. The corrected paths are taken from the original recorded `qa-png/personal/progress/rec/trend.sh` commands. This correction changes only the new launcher, not oracle source or assertions. Final retry **PASS** is recorded separately in `evidence/r4-image-goldens-retry-20261016.json`: all five families, **12/12 PNG SHA matches**, including repeated comparison. Total duration 188.58 seconds; OOM events zero; memory peak UNAVAILABLE.

Each family has a 180-second deadline, 1 MiB log limit and a shared 1 GiB workspace limit, inside the unchanged QA wrapper memory/task/15-minute limits. Hashing streams file bytes; no binary assertions or image buffers enter failure output. `memory.peak` is recorded only if available, otherwise `UNAVAILABLE`.

Remaining limits: Annual Node/Chromium poster rendering, composed source-update panels and other Bot-only renderer families are not covered by these PNG cases. This does not replace real authenticated route/parameter tests for every image endpoint, upstream SDK acceptance, production asset/deployment/ACL verification, historical published-report continuity or complete release acceptance.
