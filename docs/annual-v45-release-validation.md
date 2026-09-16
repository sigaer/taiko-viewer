# Annual v4.5 Release Validation — Viewer 0.67.2

验证日期：2026-09-16（Asia/Shanghai）。本轮指定 Release Gate：**PASS**。建议继续保持 production **Viewer 0.67.2 / annual-observation-v4.5.0**。

| Phase | 结果 | 证据 |
|---|---|---|
| A Full Corpus | PASS | 全量双次生成、schema、候选、observed 来源、zh/ja 展示契约 |
| B Boundary Contract | PASS | 指定 14 类边界，生产 generator 与真实 cache 判定分支 |
| C Real Account E2E | PASS（默认动态设置） | 20 账号 × zh/ja，真实 API → Finale → Poster，40/40 |
| D Production Soak | PASS（本次观察窗口） | 真实 cold/cached、v4.4→v4.5 rebuild、重复复用和服务观察 |

额外发现一项**修复前已存在的 reduced-motion 开场导航问题**，未隐瞒为通过；见“异常与限制”。该问题不属于本次列出的 title/evidence/cache/生产错误回归 blocker。此结论不表示所有可访问性路径都通过，也不表示完成长期容量或泄漏认证。

## 发布与范围

- 发布 commit：`66280b2`，`0.67.2 修复年度称号展示与段位证据本地化契约`。标准 `scripts/deploy_forum_web.sh` exit 0，线上版本已核实。2026-09-16 19:32:54 服务启动，PID 2471460。
- A-1：移除旧 evidence-key 对主 title/body 的选择。只有 `strongDan=true` 且有效 standing presentation 使用 overlay，其余使用 ordinary 45-key。
- A-2：grade evidence 使用 canonical `danBefore → dan`；缺失、空、非法数值不强转为 0。合法 producer `danBefore=0` 仍按真实数值展示。
- A-4：无 breakthrough 时不解析 encouragement title/body，不添加无用 locale key。
- A-6：standing evidence 由 dan/mark 经 Viewer locale 词典生成。管理员预览使用当前 locale。generator 的中文 evidenceText 仅保留在原始数据中。
- generator、schema、Dan strength/gate、ordinary model、24-bucket title/body 与原 completion 词典全部未变，文件哈希及词典深比较通过；算法不 bump。未 redesign UI、未开启 Performance P2、未建立重型测试框架。
- `npm run test:annual` PASS（现有静态契约 + 8 项行为回归）；`npm run test:annual:period` PASS（5+6 项）；现有 admin annual regression PASS（5 个渲染场景及入口检查）。测试在部署前完成。
- unrelated `taiko_viewer/assets/data/title_song_relations.json` 未纳入发布 commit，最终 SHA-256 保持 `4cc9be6074d011ddf7eed43f4351e0a4131145838a32e811670682497cca48fa`。进场时不同内容另行私有备份，未丢弃。

## Phase A — Full Corpus Regression

使用 production/runtime 同源 `build_annual_result`，年度窗口 2025-10-09 06:00 → 2026-09-11 04:00；固定 generatedAt=2026-09-16 19:30，每账号完整 summary+events 生成两次并比较。语料按 `post-manifest.json` 截点，包括当前 userdata 和数字 ID 历史目录，含别名、未按真人去重。运行中新增数据不混入同一 manifest。

隔离输出/normalized cache 不写生产 summary DB；schema 使用生产 Ajv2020 schema。standing 对照同一窗口 current-version state，核对 argmax(strength, dan, mark)、gate、合法 key、evidence、provenance 和 ordinary model 未改写。chart breakthrough 核对真实 play_delta；dan breakthrough 核对 baseline/end profile 段位变化及观察顺序，不能把 standing 当成 observed breakthrough。

| 指标 | 数值 |
|---|---:|
| 总账号标识 | 1,635 |
| generation success | 1,612 |
| generation failure（数据不足） | 23 |
| strongDan | 128 |
| wrong completion-only title | 0 |
| wrong grade evidence | 0 |
| missing breakthrough locale lookup | 0 |
| ja standing evidence wrong locale | 0 |
| schema invalid（summary+events） | 0 |
| NaN / Infinity / schema 不允许的 null | 0 |
| algorithm version 不符 | 0 |
| deterministic diff | 0 |
| illegal standing candidate / evidence 来源不符 | 0 |
| ordinary semantic key 被覆盖 / 非冻结 key | 0 |
| non-strongDan 显示 standing | 0 |
| breakthrough observed 来源不符 | 0 |
| zh/ja 实际 resolver missing | 0 |

全部 strongDan 满足 dan≥七段、mark≥1、strength≥1.90、合法 bucket、`provenance=current_version`。541 个 no-breakthrough 账号 × 两种 locale，encouragement lookup 为 0。ordinary 45/45、standing 24/24 title/body 完整；空 bucket 另由 Phase B 枚举覆盖。schema 允许的未知日期、不可用 metric 和 non-strongDan standingPresentation:null 不算 unexpected null。

### 24 bucket 分布

| standing key | 账号数 |
|---|---:|
| `standing_12_gold_rainbow` | 1 |
| `standing_13_gold_rainbow` | 0 |
| `standing_14_gold` | 17 |
| `standing_14_gold_rainbow` | 0 |
| `standing_15_gold` | 12 |
| `standing_15_gold_rainbow` | 0 |
| `standing_15_red` | 39 |
| `standing_15_red_rainbow` | 0 |
| `standing_16_gold` | 4 |
| `standing_16_gold_rainbow` | 1 |
| `standing_16_red` | 24 |
| `standing_16_red_rainbow` | 0 |
| `standing_17_gold` | 5 |
| `standing_17_gold_rainbow` | 0 |
| `standing_17_red` | 12 |
| `standing_17_red_rainbow` | 0 |
| `standing_18_gold` | 2 |
| `standing_18_gold_rainbow` | 0 |
| `standing_18_red` | 10 |
| `standing_18_red_rainbow` | 0 |
| `standing_19_gold` | 0 |
| `standing_19_gold_rainbow` | 1 |
| `standing_19_red` | 0 |
| `standing_19_red_rainbow` | 0 |

### A-1 / A-2 原 UID 定向复验

原 31 个 A-1 UID 全部仍为 non-strongDan，均恢复 `final_growth` ordinary 主标题：zh「破晓登临」、ja「暁に登る」，body 同 ordinary 词典。下表 grade 行同时覆盖全部 10 个 A-2 UID；证据逐项与 producer 核对。

| UID | A-1 | A-2 修复后 zh evidence（适用时） |
|---|---|---|
| 11236777 | PASS | — |
| 15129540 | PASS | — |
| 16785484 | PASS | — |
| 18572514 | PASS | — |
| 196444 | PASS | 0 → 八段（年内 +13 段） |
| 20041443 | PASS | — |
| 21911849 | PASS | — |
| 25750658 | PASS | — |
| 26256253 | PASS | — |
| 27214979 | PASS | — |
| 3286263 | PASS | 0 → 九段（年内 +14 段） |
| 33367982 | PASS | 0 → 九段（年内 +14 段） |
| 35396987 | PASS | 0 → 九段（年内 +14 段） |
| 37003380 | PASS | 0 → 八段（年内 +13 段） |
| 39896983 | PASS | — |
| 50243859 | PASS | — |
| 58504606 | PASS | 初段 → 八段（年内 +7 段） |
| 59615639 | PASS | 0 → 八段（年内 +13 段） |
| 61767489 | PASS | — |
| 64495640 | PASS | — |
| 66264495 | PASS | — |
| 6939850 | PASS | 五级 → 八段（年内 +12 段） |
| 73920246 | PASS | — |
| 80089342 | PASS | — |
| 81449295 | PASS | — |
| 82230349 | PASS | 0 → 九段（年内 +14 段） |
| 92349437 | PASS | — |
| 95765668 | PASS | 初段 → 九段（年内 +8 段） |
| 95803682 | PASS | — |
| 99232636 | PASS | — |
| 99857710 | PASS | — |

### 全部生成异常 UID

以下均为明确的数据不足 ValueError，没有可构造的年度 summary；不计为成功，也不按本 Gate 单独视为 crash。较历史基线新增 UID 40259，失败数由 22 变为 23；成功数仍为 1,612。

| UID | 原因 |
|---|---|
| 10335290 | `ValueError: no snapshots available` |
| 16691997 | `ValueError: no snapshots in annual window` |
| 17133719 | `ValueError: no snapshots in annual window` |
| 21559198 | `ValueError: no snapshots in annual window` |
| 2169620 | `ValueError: no snapshots available` |
| 2272870 | `ValueError: no snapshots in annual window` |
| 25546745 | `ValueError: no snapshots in annual window` |
| 32841643 | `ValueError: no snapshots available` |
| 33694480 | `ValueError: no snapshots in annual window` |
| 40259 | `ValueError: no snapshots in annual window` |
| 43417411 | `ValueError: no snapshots in annual window` |
| 47436815 | `ValueError: no snapshots available` |
| 51120640 | `ValueError: no snapshots in annual window` |
| 52617433 | `ValueError: no snapshots available` |
| 54561530 | `ValueError: no snapshots in annual window` |
| 61645594 | `ValueError: no snapshots available` |
| 67917226 | `ValueError: no snapshots in annual window` |
| 75444272 | `ValueError: no snapshots in annual window` |
| 78008808 | `ValueError: no snapshots in annual window` |
| 7835737 | `ValueError: no snapshots in annual window` |
| 86385490 | `ValueError: no snapshots available` |
| 91041466 | `ValueError: no snapshots available` |
| 98569227 | `ValueError: no snapshots in annual window` |

## Phase B — Boundary Contract

最小 fixture 使用生产 generator，未修改生产模型。13 个独立段位 fixture 的完整 summary/events schema 与 Viewer normalize 全通过；组合、argmax 与缓存检查另行执行。

| # | 边界 | 结果 |
|---|---|---|
| 1 | 六段 mark6 → no strongDan | PASS |
| 2 | 七段 mark4 → no strongDan | PASS |
| 3 | 七段 mark5 → no strongDan | PASS |
| 4 | 七段 mark6 → strongDan | PASS |
| 5 | 八段 mark6 → strongDan | PASS |
| 6 | 九段 mark1/2/3 → no strongDan | PASS |
| 7 | 九段 mark4/5/6 → strongDan | PASS |
| 8 | 十段 mark1，strength=threshold=1.90 → strongDan | PASS |
| 9 | mark0 ignored | PASS |
| 10 | 多段位 argmax(V4 strength, dan, mark) | PASS |
| 11 | breakthrough yes + strongDan no | PASS |
| 12 | breakthrough no + strongDan yes | PASS |
| 13 | v4.4 summary → stale | PASS |
| 14 | v4.5 summary → reusable | PASS |

## Phase C — Real Account E2E

在 A/B 全部通过后执行。使用已授权真实在线 admin/owner 会话，不 mock API、不将 fixture 塞入页面。真实管理入口查询账号，按产品操作读取/生成 summary；浏览器等待真实可见 Finale 滚动完成，读取 Finale title/evidence 与 Poster title。全部 20 个账号均检查 zh+ja（40 次），包括要求的 40500773、49557999、66792598、47279977、84813650。

生产 API 的 finalTitle 与独立全量 generator 原始输出相同；breakthrough 的 canonical observed 字段一致，忽略 API 正常补充的 name/subtitle/coverUrl 展示元数据；Finale/Poster 都与 locale 词典 expected title 相同。截图与原始 API 响应留存私有证据目录。以下“突破”是 observed event type，none 表示没有突破。

| UID | locale | ordinary titleKey | standing key | 突破 | evidence | Finale title | Poster title |
|---|---|---|---|---|---|---|---|
| 2258735 | zh | final_exploration_endurance | — | ten_star_full_combo | 801 首曲目 · 953 张谱面 | 远行而不息 | 远行而不息 |
| 11236777 | zh | final_growth | — | dan | 八段 · 金合格金粹 | 破晓登临 | 破晓登临 |
| 15129540 | zh | final_growth | — | dan | 九段 · 赤合格金粹 | 破晓登临 | 破晓登临 |
| 196444 | zh | final_growth | — | dan | 0 → 八段（年内 +13 段） | 破晓登临 | 破晓登临 |
| 40500773 | zh | final_growth | standing_19_gold_rainbow | dondaful | 达人 · 金虹合格 | 天极回响 | 天极回响 |
| 49557999 | zh | final_speed_precision | standing_16_gold | extreme | 玄人 · 金合格 | 玄之静谧 | 玄之静谧 |
| 66792598 | zh | final_endurance_precision | standing_12_gold_rainbow | none | 七段 · 金虹合格 | 初虹 | 初虹 |
| 47279977 | zh | final_growth | standing_15_gold | dondaful | 十段 · 金合格 | 天衡破阵 | 天衡破阵 |
| 84813650 | zh | final_growth | standing_16_gold_rainbow | dondaful | 玄人 · 金虹合格 | 玄钢无瑕 | 玄钢无瑕 |
| 10826570 | zh | final_growth | standing_14_gold | dan | 九段 · 金合格 | 贯律之匠 | 贯律之匠 |
| 12559597 | zh | final_endurance_growth | standing_15_red | dan | 十段 · 赤合格 | 越境 | 越境 |
| 10071618 | zh | final_growth_devotion | standing_16_red | dondaful | 玄人 · 赤合格 | 踏玄 | 踏玄 |
| 17899708 | zh | final_archive_collector | standing_17_red | none | 名人 · 赤合格 | 留名 | 留名 |
| 3843770 | zh | final_growth | standing_17_gold | dan | 名人 · 金粹金合格 | 统律 | 统律 |
| 11435401 | zh | final_growth | standing_18_red | dan | 超人 · 赤合格 | 破人之壳 | 破人之壳 |
| 46235999 | zh | final_growth | standing_18_gold | dan | 超人 · 金粹金合格 | 超人之上 | 超人之上 |
| 008086101662 | zh | final_early | — | none | 游玩 0 次 | 初响启程 | 初响启程 |
| 10683983 | zh | final_archive_dan | — | clear | 已有段位成果 · 二级 金合格 | 藏锋于旧卷 | 藏锋于旧卷 |
| 10334982 | zh | final_nocturnal_exploration | — | full_combo | 五段 · 赤合格 → 金合格 | 深蓝漫游 | 深蓝漫游 |
| 10528939 | zh | final_speed_precision | — | none | 常用速度 2.0× | 疾行守衡 | 疾行守衡 |
| 2258735 | ja | final_exploration_endurance | — | ten_star_full_combo | 801 曲・953 譜面 | 旅は止まらない | 旅は止まらない |
| 11236777 | ja | final_growth | — | dan | 八段・金合格フルコンボ | 暁に登る | 暁に登る |
| 15129540 | ja | final_growth | — | dan | 九段・赤合格フルコンボ | 暁に登る | 暁に登る |
| 196444 | ja | final_growth | — | dan | 0 → 八段（年間 +13 段） | 暁に登る | 暁に登る |
| 40500773 | ja | final_growth | standing_19_gold_rainbow | dondaful | 達人 · 金合格全良 | 天極の響 | 天極の響 |
| 49557999 | ja | final_speed_precision | standing_16_gold | extreme | 玄人 · 金合格 | 玄の静謐 | 玄の静謐 |
| 66792598 | ja | final_endurance_precision | standing_12_gold_rainbow | none | 七段 · 金合格全良 | 初虹 | 初虹 |
| 47279977 | ja | final_growth | standing_15_gold | dondaful | 十段 · 金合格 | 天衡破陣 | 天衡破陣 |
| 84813650 | ja | final_growth | standing_16_gold_rainbow | dondaful | 玄人 · 金合格全良 | 玄鋼無瑕 | 玄鋼無瑕 |
| 10826570 | ja | final_growth | standing_14_gold | dan | 九段 · 金合格 | 貫律の匠 | 貫律の匠 |
| 12559597 | ja | final_endurance_growth | standing_15_red | dan | 十段 · 赤合格 | 境を越えて | 境を越えて |
| 10071618 | ja | final_growth_devotion | standing_16_red | dondaful | 玄人 · 赤合格 | 玄を踏む | 玄を踏む |
| 17899708 | ja | final_archive_collector | standing_17_red | none | 名人 · 赤合格 | 名を刻む | 名を刻む |
| 3843770 | ja | final_growth | standing_17_gold | dan | 名人 · 金合格フルコンボ | 律を統べる | 律を統べる |
| 11435401 | ja | final_growth | standing_18_red | dan | 超人 · 赤合格 | 人の殻を破る | 人の殻を破る |
| 46235999 | ja | final_growth | standing_18_gold | dan | 超人 · 金合格フルコンボ | 超人を越えて | 超人を越えて |
| 008086101662 | ja | final_early | — | none | 0 回プレイ | はじまりの一打 | はじまりの一打 |
| 10683983 | ja | final_archive_dan | — | clear | これまでの段位成果・二級 金合格 | 積年の段位 | 積年の段位 |
| 10334982 | ja | final_nocturnal_exploration | — | full_combo | 五段・赤合格 → 金合格 | 藍のさすらい | 藍のさすらい |
| 10528939 | ja | final_speed_precision | — | none | 常用速度 2.0× | 急がば崩さず | 急がば崩さず |

## Phase D — Production Soak

仅观察与执行授权的真实产品请求；本阶段未修改生产代码、未清空缓存模拟 cold、未伪造旧版本。

| 请求 | 账号 | 结果 | 端到端耗时 / 缓存读取 |
|---|---|---|---|
| cold | 12559597 | v4.5；repeat completed，同一 summary | 10.299s / 58.5, 52.0, 63.0 ms |
| stale | 49557999 | v4.5；repeat completed，同一 summary | 2.543s / 43.2, 44.3, 46.4 ms |

- cold：12559597 原来没有 summary，通过真实 build/job/GET 完成首次生成。
- stale：49557999 原有 `annual-observation-v4.4.0`；GET 返回预期 410，再经产品 build/job 成为 v4.5。旧 summary `annual_35a25203a011597698ef23ea` → 新 `annual_c234f52cb51151281257a065`。
- 两者再次 force=false 请求均直接返回 completed 并复用同一 summary。后续真实页面读取成功，没有重建循环。服务可能为缓存命中建立已完成 job 记录，不等于启动 generator。
- owner 2258735 的 account annual API：zh/ja 各 3 次，均 HTTP 200、同一 v4.5 summary；本机网络端到端 32.97–138.00 ms。冷生成耗时含排队/轮询，不能当作纯 generator 执行时间。

观察采样：2026-09-16T19:34:27.433978 至 2026-09-16T20:07:50.251755，201 个 10 秒样本；PID 集合 `['2471460']`，NRestarts `['0']`。内存 cgroup 起始 740.4 MiB，峰值 4191.5 MiB，结束 2088.5 MiB。cgroup 包含文件页及生成子进程；RSS/匿名内存另存 post-memory.jsonl。

生产 annual API 访问日志（截至本轮 E2E 结束）：366 次，365 次 HTTP 200、1 次预期 stale 410；0 个 5xx，0 个其他 unexpected annual API error。只读 DB 核对新增 7 个 job 全部 completed、error_code 为空；journal 无 CLI build failed、unhandled、fatal 或 OOM。

10 秒采样 CPU 占单核平均 31.38%，峰值 126.18%；E2E 请求停止后继续观察 130 秒，CPU 平均 0.376%，内存从 2847.1 MiB 回落至 2088.5 MiB。观察期间存在生成/页面请求峰值和回收，未见持续单调增长、重启、重建循环或明确严重性能回归。初始冷进程与已预热结束状态不能直接当作同负载性能对照。

## 异常与限制

1. **数据不足 23 UID**：已全部列于 Phase A；不是 schema invalid 或 runtime crash。
2. **既有 provenance 信息不足（12 UID，非本轮新增）**：10071618、18453160、38587600、40723229、49454969、57732215、6394126、65193638、66792598、70215519、82824603、83478854。standing 使用当前窗口 end-state 的 profile_fallback，当前生产 reader/contract 判定通过；上游 profile 未携带可独立审计的 dojo version 标签，不能额外声称验证了上游历史版本真伪。本轮没有重定义 generator semantic model。
3. **既有 reduced-motion 开场导航问题**：UID 2258735、zh、真实 production，`prefers-reduced-motion: reduce` 下点击“直达结果页”后按钮保持 disabled，仍停在 opening。重复复现；API 200、无 JS crash。原因是 useAnnualTimeline 在 reduced motion 下不创建 motionScope，但 OpeningSlide 仍通过该 scope 的可选 timer 完成导航；发布前 `45a2c68` 同样的代码已存在。本轮默认动态设置下 40 次完整链路通过；此问题单独留待导航/可访问性修复，不把 reduced-motion 路径写成 PASS。
4. E2E 初次未等 smooth scroll 完成，截图落在相邻 Poster；已修正一次性验证脚本，最终 40 次重新完整执行并检查实际 scrollTop 与 active page。该项是验证脚本时序问题，不是产品 title mismatch。
5. 没有旧版本同负载性能对照，本次观察不能证明长期无内存泄漏；仅用于本轮明确严重回归 Gate，不开展 P2。

## 证据与结论

私有证据根目录：`/var/tmp/annual-v45-fix-validation/`。主要文件：`post-manifest.json`、`post-records.jsonl`、`post-results/`、`post-schema.json`、`post-observed.json`、`postdeploy-contracts.json`、`phase-b/`、`e2e-results.json`、`e2e/`、`cache-cycle-results.json`、`cache-cycle-requests.json`、`owner-cached.json`、`post-soak.jsonl`、`post-memory.jsonl`、`post-journal.txt`、`frozen-final.json`、`deploy.log`。认证信息不进入报告或 Git。

修复前 0.67.1 的 FAIL/BLOCK 已由本轮 A-1/A-2/A-4/A-6 复验消除；历史全部异常 UID 可在本报告的发布 commit `66280b2` 版本及私有原始基线中追溯。当前没有本次指定 Gate 的 blocker，建议继续保持 production 0.67.2；另行跟踪上述既有 reduced-motion 导航问题。
