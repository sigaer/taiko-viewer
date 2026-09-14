# Annual Performance P1 Release Report

发布日期：2026-09-14（本地记录）

## 发布状态

- Generator canonical commit：`fdaf28ec6eaf21beed5e69dad897ee364c41ef82`
- `origin/main`：与 canonical `HEAD` 完全一致（`fdaf28e`）
- Canonical push：PASS
- Runtime 同步：PASS（canonical → `/home/sigaer/taiko`）
- Viewer：未修改、未部署、未重启
- Algorithm Version：保持 `annual-observation-v4.4.0`
- 生产 annual cache：未删除、未 force invalidate

P1 代码已按批准内容发布到 generator canonical 和 runtime。线上 forced cold build 的管理员 session 已过期，因此没有绕过认证或直接修改生产 DB；该项线上观测留作人工补充，不影响代码发布本身。

## 1. Runtime 发布前保护

发布前 runtime backup：`/home/sigaer/annual-p1-runtime-backup-20260914/`

| 文件 | 发布前 backup SHA-256 |
|---|---|
| `snapshots.py` | `de1351c88694801964c79891db0503a00994f7733607730203a0e9a02dd20b94` |
| `events.py` | `ba200b1e3889957bb96d907b03a3537d312cc2ff1bcc430744b22997d597b8a9` |
| `model.py` | `573af24731e94ea2cc0fc25b00e6a1e116601c2d7d6410bce7b46bec53d5b6b0` |

同步后 canonical/runtime SHA-256 完全一致：

| 文件 | canonical = runtime SHA-256 |
|---|---|
| `snapshots.py` | `058e8edec9e9d8b8384b275a87ab8c5b506c284375859f7b6b2af94d5f0a28d4` |
| `events.py` | `f2fdf1f42237f9af24e71c4cc85527ef0ac31416c96d56965da7e9281246c4c4` |
| `model.py` | `d242ea21ab5f7e6cded296c5643af759d48f442a54b16535c6781a37aabccc3d` |

Rollback point：`d554940`（P1 前已知良好 canonical commit），或上述 runtime backup。回滚不需要删除 cache。

## 2. Runtime smoke

固定 `generated_at=2026-09-14T09:30:00`，在同步后的 `/home/sigaer/taiko` 运行真实 generator：

| 账号 | wall | summaryId | FinalTitle | events | period/rating/keyword |
|---|---:|---|---|---:|:---:|
| 20159783（少量） | 1.67s | `annual_394bbf03187e823810686969` | `final_archive_regular` | 0 | unchanged |
| 2258735 | 8.67s | `annual_caa05947f07318034f042360` | `final_exploration_endurance` | 3,124 | unchanged |
| 33587101（高 playCount） | 3.95s | `annual_b14b458b1492f8853946db12` | `final_endurance_growth` | 5,446 | unchanged |

这三份 runtime 输出与 P1 前 canonical baseline 逐对象比较均为 equal；summaryId、titleKey、evidenceKey、events count、period、rating、keyword 全部不变。

## 3. Online cache-hit regression

使用授权账号的既有 `stv_session` 只做正常账户 API 操作：

- `GET /api/account/annual-summaries/annual_2026?locale=zh`：HTTP 200，已有 summary `annual_560238857531162e99aa800f`
- `POST /api/account/annual-summaries/annual_2026/build`：HTTP 200，立即返回 completed job
- 请求 wall：183 ms（另一次 169 ms）
- job `85a66bd3-1e2e-40cf-ab98-0bf003726502`：created/started/completed 均 `2026-09-14T03:16:48Z`，queue=0 ms，wall=0 ms，summaryId 保持不变
- 未删除或重建现有 summary/cache

这确认 Algorithm Version 未变化时，已有有效摘要仍走近即时 cache-hit 路径。

## 4. Online cold/forced measurement

生产 DB 中可核验的旧线上 cold job：

- 2258735：21 s（2026-09-14 00:18:36Z → 00:18:57Z）
- 99408699（250–350+ 之外的高历史样本，934 raw）：22 s（历史记录）
- 63666714（291 raw）：13 s（历史记录）
- 33587101：无新的线上 job row，runtime smoke 为 3.95 s

本次发布后未执行线上 forced cold：现有管理员 cookie 均返回 401，账户 build API 不接受 `force` 参数；为遵守“不得绕过认证/不得直接生产 mutation”，没有伪造 job、删除 summary 或手工写 DB。因此无法在本报告中声称“线上 forced cold 已完成”；线上可比的 post-release cold job 需要人工提供有效的 admin session 后再补测。

本次同步后的同一 production generator 路径在本机真实 userdata 上测得 2258735 cold 8.67 s（已有 normalized snapshot cache）/ P1 benchmark fresh-cache median 4.21 s，较旧线上 18–21 s 明显改善；该结果与线上 job 机制相同的 Python generator，但不替代缺失的 post-release online forced 证据。

## 5. Correctness and tests

- 五账号 P1 前后 semantic deep diff：PASS
- `summaryId`：全部 unchanged
- `FinalTitle`、breakthrough、period、rating、keyword、21 page data：全部 unchanged
- `npm run test:annual`：PASS
- `npm run test:annual:period`：PASS（11 tests）
- `npm run test:version`：PASS
- Python `test_annual*.py`：PASS（2 tests）
- `test_version_summary.py`：25 passed；`test_source_switch_and_deleted_readded_chart_never_create_cross_epoch_delta` 在 baseline `d554940` 同样失败，记录为 pre-existing / separate follow-up，未修复

## 6. Git / unrelated changes

- Canonical `/home/sigaer/git/Sakura_bot`：P1 push 后无意外 dirty
- Forum `/home/sigaer/taiko/taiko-forum`：仅保留原有 `taiko_viewer/assets/data/title_song_relations.json` 用户改动；Viewer 报告提交已完成
- Runtime `/home/sigaer/taiko`：该目录不是独立 Git worktree；同步仅覆盖批准的三个 P1 源文件
- `poster.zip` 等既有无关文件未触碰

## 7. 临时文件

本轮 profiling 脚本和 benchmark 输出已删除；正式报告保留在仓库。runtime rollback backup 按第 1 节保留。

## 8. Release Gate

P1 canonical push、canonical→runtime 同步、hash 一致、版本不变、cache-hit、runtime smoke、forced rebuild 语义等均已通过。唯一未闭合项是“发布后线上 forced cold job”——原因是当前没有有效管理员 session，且不允许绕过认证或直接改生产 DB。

因此本记录将代码发布标记为 **P1 runtime release complete**，但不把缺失的线上 forced cold 证据伪称为 PASS；待人工提供授权 admin session 后，只需补做线上 forced measurement，不需再次改代码或部署。
