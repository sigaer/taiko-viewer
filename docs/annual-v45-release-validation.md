# Annual v4.5 Release Validation — Viewer 契约修复与复验

当前修复版本：Viewer **0.67.2**；算法保持 **annual-observation-v4.5.0**。

## 本轮状态（部署前）

- A-1：31 个受影响 UID 全部恢复 ordinary 主 title/body；只有 `strongDan=true` 且有效 standing payload 才使用 standing。
- A-2：10 个 UID 的 grade evidence 使用 `danBefore → dan`；缺失/非法数值不再伪装成 0。
- A-4：no-breakthrough 短路不存在的 encouragement title/body lookup。
- A-6：standing evidence 从 dan/mark 经 locale 词典组成；zh 保持 canonical 术语，ja 使用现有日文术语。管理员预览同时跟随当前 locale。
- 1,612 份原始成功 summary 的 zh/ja 定向回归：错误 0。原 ordinary 45-key、24 bucket title/body、Dan model、算法和 schema 均保持不变。
- `npm run test:annual` PASS（原 contract + 8 个新增行为回归）；annual period 11 项 PASS；admin annual report 5 个渲染场景及入口检查 PASS。
- unrelated 文件已有匹配指定 SHA 的历史副本，按要求保留 `4cc9be6074d011ddf7eed43f4351e0a4131145838a32e811670682497cca48fa`。进场时不同的内容另行备份在 `/var/tmp/annual-v45-unrelated-before-fix.json`，未丢弃。
- 待标准部署成功后正式重跑全量 A/B，随后进入真实 C/D；此处不预先声明最终 PASS。

验证证据：`/var/tmp/annual-v45-fix-validation/`。认证仅存于私有文件，不进入代码或报告。

---

## 历史验证基线（以下是修复前 0.67.1 的结论，不代表修复后状态）

# Annual v4.5 Release Validation

日期：2026-09-16（Asia/Shanghai）。**Release Gate：FAIL / BLOCK。**

实际 production：**Viewer 0.67.1**，`annual-observation-v4.5.0`；HEAD `45a2c68`。任务给出的 0.67.0 已被 schema 热修复替代，首页和运行构建均核实为 0.67.1。

| Phase | 结果 | 说明 |
|---|---|---|
| A Full Corpus | **FAIL** | 生成器基础检查通过；发现真实展示 title/evidence 契约错误 |
| B Boundary Contract | **PASS** | 指定 14 类边界完成，13 个独立段位 generator fixture 加组合/缓存检查 |
| C Real Account E2E | **NOT RUN** | A 未 PASS，遵守先决 Gate，不进入 C |
| D Production Soak | **INCOMPLETE** | 被动窗口未见新增故障；缺少真实 cold/cached API 与 stale rebuild 闭环证据 |

只修改本报告；未修改 UI、Dan strength/gate/copy、生产模型、版本或部署脚本，未部署/重启，未启用 P2。未建立测试框架。旧草稿备份在 `/tmp/annual-v45-validation-original.md`；其 A/C/D 全 PASS 结论不沿用。

## Phase A — Full Corpus Regression

### 方法和范围

- 语料：1,633 个当前 `*data.json` 账号，加 1 个只有历史 snapshot 的账号 `99991773500607`，总计 **1,634** 个 userdata 存储标识（含别名，未按真人去重）。初扫 1,632 个 current 文件，运行中新增 1 个；按保存的 manifest 截点记录。排除 `.manual_deleted` 回收目录和非账号辅助目录 `star-hks`。
- 直接调用 production CLI 使用的 `build_annual_result`；年度窗口 2025-10-09 06:00 → 2026-09-11 04:00，固定 `generatedAt=2026-09-16T09:00:00`。每个可生成账号执行两次，比较完整 summary+events，而非抽样或仅比较标题。
- 使用现有 Ajv2020、生产 `annual-summary-v4.schema.json` 验证 summary 和 events；JSON 序列化拒绝 NaN/Infinity。schema 允许的未知日期、不可用 metric、非 strongDan 的 `standingPresentation:null` 不算 unexpected null。
- 从同一年度窗口重新读 snapshot，核对 standing argmax、evidence dan/mark、ordinary model 未被 overlay 改写。chart breakthrough 对应真实 play_delta；dan breakthrough 核对 baseline/end 的实际 profile 段位增量（生产当前不为其输出独立 dan event ID），没有把 standing 当年度突破。
- 以实际 Viewer `normalizeAnnualSummary` 跑每个成功账号的 zh/ja。另在浏览器直接 import 线上发布模块复现 4 个异常账号；这是 A 的契约复现，不是 C 的 authenticated API/完整页面 E2E。
- 输出和 normalized cache 位于本机私有测试目录；不写生产 DB/cache。DB 观察使用 READ ONLY transaction，不复制生产数据到测试 DB。

### 全量结果

| 指标 | 数值 |
|---|---:|
| 总账号 | 1,634 |
| generation success | 1,612 |
| generation failure（数据不足） | 22 |
| schema invalid | 0 |
| NaN / Infinity / schema 不允许的 null | 0 |
| 算法版本不符 | 0 |
| 固定输入双次输出差异 | 0 |
| strongDan | 128 |
| ordinary key 不属于冻结 45-key | 0 |
| standing/ordinary/observed 来源核对错误 | 0 |
| 旧 completion-only 展示受影响账号 | 31 |
| 错误段位进步 evidence 账号（上项子集） | 10 |
| 调用缺失 breakthrough locale key 的账号 | 541 |
| strongDan source=profile（版本来源待确认） | 12 |

“生成成功”不等于“产品契约通过”：阻断问题发生在生成器 → Viewer 展示转换。全量算法均为 `annual-observation-v4.5.0`；所有 strongDan 均满足 dan≥七段、mark≥1、strength≥1.90、合法 bucket，且输出 `provenance=current_version`。non-strongDan 的 generator standingPresentation 均为空。


隔离测试中每账号两次生成合计耗时：p50 0.599s，p95 2.879s，最长 70.777s（`u0_qq_official_89BB726514FD613A3A173A575D296147`）。这是同机测试工作负载下的双次总耗时，不是单次/API 延迟，也没有旧版本对照，不能据此判性能回归。

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

中日文 ordinary 45/45、standing 24/24 的 title/body 条目完整；枚举所有 dan/mark 后 24 bucket 均可达。实际调用缺失项及 legacy 分支见下方，不能据字典完整宣称 locale 全通过。

### A-1：wrong title，BLOCK

`utils/annualSummary.ts` 的 `DAN_PRESENTATION_EVIDENCE` / `finalPresentationKey` 仍按旧 evidence key 选择 completion-only 展示，不检查新的 standing gate。即使 `strongDan=false`、`standingPresentation=null`、ordinary `titleKey=final_growth`，也会覆盖展示称号，违反 0 legacy completion-only fallback。ordinary semantic key 本身没有被改写。

线上 `/_nuxt/DhQfp_lL.js` 与运行目录文件 SHA-256 均为 `ae06866a8880d2c2e559b0ac2a56ac2ad189ce671b3cfa98f6a95cd2f2e6a285`。浏览器调用该线上模块，11236777 应按 ordinary 显示「破晓登临 / 暁に登る」，实际为「凌霄贯律 / 高みで途切れず」；15129540、16785484、196444 同样复现。

全部受影响 UID（每行原因相同：旧 evidence 分支替换 ordinary 展示）：

| UID | ordinary key | evidence key | 实际 zh title | 实际 ja title |
|---|---|---|---|---|
| 11236777 | `final_growth` | `dan_kanzui_gold` | 凌霄贯律 | 高みで途切れず |
| 15129540 | `final_growth` | `dan_kanzui_red` | 澄境执律 | 一打も外さず |
| 16785484 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 18572514 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 196444 | `final_growth` | `dan_major_progress` | 越境凌云 | 一気に駆け上がる |
| 20041443 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 21911849 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 25750658 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 26256253 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 27214979 | `final_growth` | `dan_kanzui_gold` | 凌霄贯律 | 高みで途切れず |
| 3286263 | `final_growth` | `dan_major_progress` | 越境凌云 | 一気に駆け上がる |
| 33367982 | `final_growth` | `dan_major_progress` | 越境凌云 | 一気に駆け上がる |
| 35396987 | `final_growth` | `dan_major_progress` | 越境凌云 | 一気に駆け上がる |
| 37003380 | `final_growth` | `dan_major_progress` | 越境凌云 | 一気に駆け上がる |
| 39896983 | `final_growth` | `dan_kanzui_red` | 澄境执律 | 一打も外さず |
| 50243859 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 58504606 | `final_growth` | `dan_major_progress` | 越境凌云 | 一気に駆け上がる |
| 59615639 | `final_growth` | `dan_major_progress` | 越境凌云 | 一気に駆け上がる |
| 61767489 | `final_growth` | `dan_kanzui_red` | 澄境执律 | 一打も外さず |
| 64495640 | `final_growth` | `dan_kanzui_red` | 澄境执律 | 一打も外さず |
| 66264495 | `final_growth` | `dan_kanzui_red` | 澄境执律 | 一打も外さず |
| 6939850 | `final_growth` | `dan_major_progress` | 越境凌云 | 一気に駆け上がる |
| 73920246 | `final_growth` | `dan_kanzui_red` | 澄境执律 | 一打も外さず |
| 80089342 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 81449295 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 82230349 | `final_growth` | `dan_major_progress` | 越境凌云 | 一気に駆け上がる |
| 92349437 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 95765668 | `final_growth` | `dan_major_progress` | 越境凌云 | 一気に駆け上がる |
| 95803682 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 99232636 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |
| 99857710 | `final_growth` | `dan_gold_pass` | 天衡破阵 | 難所を抜けて |

### A-2：wrong evidence，BLOCK

`finaltitle_model.py::_dan_evidence` 为 grade event 提供 `dan` 和 `danBefore`；Viewer `renderFinalEvidence` 却读取 `danAfter`。缺字段被转换为 0，形成错误的终点与增量。所有下列账号无 strongDan overlay，错误证据会实际进入 finalTitle 展示。

| UID | producer danBefore → dan | 实际 zh evidence | 实际 ja evidence |
|---|---|---|---|
| 196444 | 0 → 13 | 0 → 0（年内 +0 段） | 0 → 0（年間 +0 段） |
| 3286263 | 0 → 14 | 0 → 0（年内 +0 段） | 0 → 0（年間 +0 段） |
| 33367982 | 0 → 14 | 0 → 0（年内 +0 段） | 0 → 0（年間 +0 段） |
| 35396987 | 0 → 14 | 0 → 0（年内 +0 段） | 0 → 0（年間 +0 段） |
| 37003380 | 0 → 13 | 0 → 0（年内 +0 段） | 0 → 0（年間 +0 段） |
| 58504606 | 6 → 13 | 初段 → 0（年内 +0 段） | 初段 → 0（年間 +0 段） |
| 59615639 | 0 → 13 | 0 → 0（年内 +0 段） | 0 → 0（年間 +0 段） |
| 6939850 | 1 → 13 | 五级 → 0（年内 +0 段） | 五級 → 0（年間 +0 段） |
| 82230349 | 0 → 14 | 0 → 0（年内 +0 段） | 0 → 0（年間 +0 段） |
| 95765668 | 6 → 14 | 初段 → 0（年内 +0 段） | 初段 → 0（年間 +0 段） |

### A-3：generation failure，非 crash / 非独立 BLOCK

以下账号无 snapshot 或年度窗口无 snapshot；generator 返回明确 ValueError，没有可构造的年度 summary。这些失败不排除、不伪装成成功；按本任务 Gate 属数据不足长尾，不单独判 crash。

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

### A-4：隐藏的 locale 缺失，非独立 BLOCK

所有下列账号在 zh 和 ja 都调用不存在的 `annualSummary.breakthroughTitles.encouragement.title` / `.body`。均属于无 breakthrough 的对象；实际 finalTitle title/body/evidence 没有因此变成缺失 key。Finale 的无 breakthrough 分支不会显示这些字段；不把它当低风险 copy 以外的新阻断项。仍不满足全链路调用“0 missing”，记录全部 UID：

`0`、`008086101662`、`008516101763`、`027998319729`、`047664547711`、`052815832485`、`098838442960`、`10256600`、`10502571`、`10528939`、`10695802`、`10754309`、`10797236`、`10882126`、`11123940`、`1129648`、  
`11379148`、`11529274`、`11556920`、`11909965`、`119175835199`、`119957653136`、`12210115`、`12617507`、`12762948`、`127877205846`、`13100262`、`13119593`、`13244740`、`14086884`、`144299701889`、`14585993`、  
`14715417`、`14728600`、`14752563`、`14764643`、`14900495`、`15495160`、`15633335`、`15720313`、`15753745`、`15813622`、`15832492`、`159583845612`、`15984342`、`16138612`、`16266417`、`16314147`、  
`16511783`、`16589836`、`1660960`、`17592690`、`17770800`、`17899708`、`18138105`、`18315882`、`18380290`、`18439947`、`18644736`、`18660444`、`1866432`、`19366511`、`19498900`、`20159783`、  
`20223500`、`20263329`、`20312175`、`20338471`、`2107843`、`21090615`、`21144303`、`21280990`、`21283289`、`21383603`、`21605352`、`21750480`、`22439875`、`22525209`、`22671770`、`22803360`、  
`23001174`、`232962704537`、`23881646`、`23948817`、`24074889`、`24157961`、`2524353`、`25753738`、`25908791`、`26258791`、`26476412`、`26596950`、`26620218`、`269663166547`、`27071340`、`27138263`、  
`27532315`、`275439540516`、`2769220`、`27886240`、`27889278`、`28295655`、`28771`、`29089906`、`29358560`、`29394910`、`29694104`、`29844615`、`3008266`、`30144916`、`304315380728`、`3069971`、  
`30745230`、`30747177`、`31028414`、`31187927`、`31244155`、`31588863`、`31613273`、`31671529`、`31700770`、`31851670`、`31986408`、`32168583`、`32208887`、`32271696`、`32300302`、`32407460`、  
`32473380`、`32492931`、`32733337`、`32878165`、`32908317`、`32957289`、`33146477`、`33560887`、`33774737`、`33932384`、`3432200`、`343516393470`、`34484210`、`34697568`、`34723840`、`34728188`、  
`34910854`、`35009664`、`35227471`、`35333270`、`35478678`、`35541301`、`3566374`、`357045100454`、`35720742`、`35816694`、`36268926`、`36551433`、`37219403`、`3735170`、`37498859`、`37528366`、  
`37628895`、`37656964`、`37848299`、`383269172040`、`38587600`、`38688335`、`38737269`、`38746731`、`39139541`、`39180746`、`39288554`、`39488236`、`3970169`、`399419446365`、`40148228`、`401950766246`、  
`40204923`、`40248760`、`40561195`、`40723229`、`40777517`、`41047959`、`41177945`、`41178642`、`41245162`、`41295962`、`41661209`、`41772693`、`41993255`、`4205456`、`4209808`、`42373990`、  
`42378441`、`42789455`、`43055924`、`43093468`、`43095208`、`43344460`、`43552347`、`43665845`、`43766546`、`43875270`、`43889171`、`44365410`、`44571846`、`44612505`、`4479821`、`449376283179`、  
`45117820`、`453199266784`、`45348440`、`45404529`、`45608304`、`4593749`、`45974419`、`46666580`、`46778909`、`46787675`、`46914434`、`47296115`、`47376415`、`47384754`、`47574230`、`47619642`、  
`476555240142`、`47666538`、`47687918`、`47818304`、`47894460`、`48268947`、`48567433`、`48616738`、`48973516`、`49083222`、`491540716380`、`49263285`、`49454969`、`496710290102`、`49830860`、`49930160`、  
`50041602`、`50171760`、`50324513`、`50448310`、`50537959`、`50686926`、`50781290`、`507962763788`、`50848848`、`5101940`、`510844127501`、`51112234`、`51421374`、`51849971`、`52362524`、`52604170`、  
`53065583`、`53247607`、`53294112`、`53784283`、`53793950`、`53834953`、`54339705`、`54373653`、`54418787`、`5452634`、`54694368`、`551`、`5512557`、`55433542`、`55748858`、`56290457`、  
`56822455`、`5683752`、`5694600`、`57191932`、`57217376`、`57506265`、`57545197`、`57732215`、`57751248`、`58441487`、`58532158`、`58693356`、`59415467`、`59776248`、`598721061071`、`59982469`、  
`60008529`、`60050876`、`60075725`、`60488157`、`60491780`、`605731083702`、`60635686`、`60657103`、`60748993`、`60805840`、`608218151958`、`60846310`、`612763334581`、`61412760`、`61421908`、`61664375`、  
`61670210`、`61939580`、`61957872`、`62053274`、`62975550`、`62998770`、`6303540`、`63068374`、`63407352`、`63792207`、`64058525`、`64279363`、`64357930`、`64664355`、`64751979`、`64837441`、  
`64973997`、`65152625`、`65193638`、`65250262`、`65425639`、`65503846`、`66057211`、`66072152`、`66580725`、`66724298`、`66792598`、`66983638`、`67049488`、`67054319`、`672938878321`、`6787325`、  
`67921906`、`68440443`、`68571447`、`68651197`、`68688864`、`68876694`、`69154142`、`69210545`、`69458980`、`69493323`、`69612763`、`6961476`、`69676171`、`69969146`、`70014112`、`70181997`、  
`70455798`、`70477430`、`70490205`、`70569769`、`70781147`、`70782183`、`70844780`、`70961283`、`712231759150`、`71368499`、`71707267`、`71755101`、`720944418754`、`72424420`、`72553169`、`72572634`、  
`72869402`、`72885567`、`73055530`、`73138433`、`73352437`、`7346174`、`73698635`、`73744406`、`73751400`、`7431551`、`74470818`、`744769157649`、`7494436`、`75166330`、`75337198`、`75530681`、  
`75670153`、`75671714`、`75887744`、`75987642`、`76091607`、`76478606`、`7713590`、`77730871`、`77830340`、`77976214`、`78010159`、`78556997`、`78776938`、`78865337`、`78921774`、`79108833`、  
`79147179`、`79355820`、`79393267`、`79476506`、`79977`、`80103299`、`80173948`、`802280906625`、`80233473`、`80348403`、`80858599`、`80949145`、`81156583`、`81241814`、`81432762`、`82032560`、  
`8237153`、`827898787785`、`82824603`、`830893327327`、`83254110`、`83264656`、`832673014756`、`83362661`、`83437907`、`83472896`、`83478854`、`83498920`、`83785616`、`83902957`、`83981220`、`84136110`、  
`84203510`、`84304665`、`84483402`、`84570343`、`84577325`、`84615332`、`847279393658`、`84835414`、`84878147`、`849372498443`、`85059627`、`85107222`、`85491986`、`85764494`、`85876747`、`8589457`、  
`86371157`、`86493449`、`86757824`、`8723941`、`87453644`、`87522818`、`87544329`、`87627808`、`88101921`、`88166585`、`8854366`、`89067144`、`89111125`、`89440632`、`89444743`、`89509221`、  
`89657518`、`90315867`、`90858598`、`90909414`、`91208299`、`91357847`、`914946760504`、`924506401984`、`925154746221`、`92906590`、`93166851`、`93376393`、`93456242`、`93575328`、`93924300`、`94074448`、  
`94102526`、`94180892`、`94317881`、`94348410`、`9497550`、`95339452`、`9542579`、`95572771`、`95597870`、`95644244`、`95739461`、`960116772089`、`968727489844`、`9692323`、`97002594`、`97107740`、  
`9730186`、`98057352`、`981353106416112879`、`983288295298310506`、`983762844299753134`、`984209817955735683`、`984345335752027281`、`98487100`、`985051486401379903`、`985570614664091577`、`98580616`、`986449613596209963`、`98664253`、`986650`、`98679832`、`98824382`、  
`98889950`、`99129478`、`99347313`、`994470449621`、`99486410`、`99650257`、`99676938`、`99718675`、`99991773500545`、`99991773500607`、`u0_onebot_v11_1106865024`、`u0_onebot_v11_1411044099`、`u0_onebot_v11_1582019774`、`u0_onebot_v11_2185500493`、`u0_onebot_v11_2290802672`、`u0_onebot_v11_2433922890`、  
`u0_onebot_v11_3198014368`、`u0_onebot_v11_3335787852`、`u0_onebot_v11_473358022`、`u0_onebot_v11_47348538`、`u0_qq_official_13A111E3E442D740EC43DC6F5BF641B5`、`u0_qq_official_204E3C57BC20A36DF2079772ECA08A7A`、`u0_qq_official_20B7FFFE6A6F8B91155AB960985E1B45`、`u0_qq_official_715C7433A67953D5E5B4BFAED0FFBD26`、`u0_qq_official_7AAB3297888B4F9D9D0D853B7135E1F6`、`u0_qq_official_89BB726514FD613A3A173A575D296147`、`u0_qq_official_A3AA2C7E6486413EB55DF00E0A881A2E`、`u0_qq_official_BB9C9FA36B867A89C3A72AEB2BEF9B2E`、`u0_qq_official_C621ACB81410B44D4BE18EC13BB898BD`  

### A-5：profile fallback 的版本来源限制，待确认

以下 strongDan 使用 `source=profile`；对应窗口末端没有 dojo 明细，profile 段位对象没有独立版本标识。dan/mark 与末端 snapshot 一致，但 `provenance=current_version` 是 generator 固定标签，不能单靠它独立证明 current-version dojo standing。未据此断言 wrong candidate，也不调整既定 fallback 模型。UID：

`10071618`、`18453160`、`38587600`、`40723229`、`49454969`、`57732215`、`6394126`、`65193638`、`66792598`、`70215519`、`82824603`、`83478854`

### A-6：ja standing evidence 使用中文 canonical 文本，非独立 BLOCK

`resolveStandingPresentation` 原样取 producer `evidenceText`，没有按 ja 的 danCompletion 字典重组。例如“达人”“金虹合格”仍是中文 canonical 表述。数值 dan/mark 正确；作为 locale/copy 限制记录，不调整 copy、不单独 BLOCK。所有 standing 均直接取 canonical 文本；本次实际含有中日文用词差异的 UID：

`23842399`、`26943820`、`27176720`、`28020720`、`28255423`、`30427428`、`32094706`、`34727379`、`36880568`、`3843770`、`40500773`、`46235999`、`61598269`、`66792598`、`67687400`、`7049369`、`70699421`、`71753273`、`71755101`、`745955`、`75669125`、`77881743`、`84813650`、`85544443`、`86541143`、`93195406`、`94317881`

## Phase B — Boundary Contract

**PASS（所要求的模型/缓存边界）。** 使用现有 production 模型、真实 generator 与最小合成 snapshot；仅替换测试输入加载器，不修改生产文件或模型。13 个段位 fixture 的 summary/events schema 与 zh/ja standing 归一化均通过。

| 编号 | 输入/契约 | 结果 |
|---|---|---|
| 1 | 六段 mark6 | PASS — no strongDan |
| 2 | 七段 mark4 | PASS — no strongDan |
| 3 | 七段 mark5 | PASS — no strongDan |
| 4 | 七段 mark6 | PASS — strongDan |
| 5 | 八段 mark6 | PASS — strongDan |
| 6 | 九段 mark1/2/3 | PASS — 全部 no strongDan |
| 7 | 九段 mark4/5/6 | PASS — 全部 strongDan |
| 8 | 十段 mark1 | PASS — strongDan；strength=threshold=1.90 |
| 9 | mark0 | PASS — 忽略；达人 mark0 不抢占其他有效记录 |
| 10 | 多段位记录 | PASS — 按 (V4 strength, dan, mark) argmax；七段6 胜十段1、九段6 胜玄人1 |
| 11 | breakthrough yes + strongDan no | PASS — 真实合成 play_delta 的 full_combo 仍保留 |
| 12 | breakthrough no + strongDan yes | PASS — 十段1 仅产生 standing，不虚构 observed breakthrough |
| 13 | v4.4 summary | PASS — 生产 safeReadSummary 算法版本分支返回 stale/null |
| 14 | v4.5 summary | PASS — 同一读取分支可复用 |

缓存边界使用从生产源码提取的 `safeReadSummary` 函数与隔离 read stub，不连接 DB、不会删改缓存行；这是边界检查，不等价于在线升级/重建闭环。A-1/A-2 的真实跨层错误仍然 BLOCK 整体 Gate，B PASS 不覆盖它们。

## Phase C — Real Account E2E

**NOT RUN（A 未 PASS）。** 未启动要求的 15–20 账号 authenticated generator → summary API → Finale → Poster 链路。未把共用同一个 view model 的源码事实写成 E2E PASS。

五个指定账号已在 A 全量 generator 与 zh/ja 归一化中覆盖；以下只是 A 的数据记录，不是 C 的页面验收：

| UID | ordinary key | standing key | standing evidence（无则 ordinary） | observed breakthrough |
|---|---|---|---|---|
| 40500773 | `final_growth` | `standing_19_gold_rainbow` | 达人 · 金虹合格 | dondaful |
| 49557999 | `final_speed_precision` | `standing_16_gold` | 玄人 · 金合格 | extreme |
| 66792598 | `final_endurance_precision` | `standing_12_gold_rainbow` | 七段 · 金虹合格 | no |
| 47279977 | `final_growth` | `standing_15_gold` | 十段 · 金合格 | dondaful |
| 84813650 | `final_growth` | `standing_16_gold_rainbow` | 玄人 · 金虹合格 | dondaful |

运行时历史 owner cookie 的 zh/ja summary API 请求均返回 401；未取得新的授权管理员会话路径，未读取或冒用其他账号 session。即使补齐会话，也应先修复 A 的阻断项再进入 C。Finale/Poster 逐账号实际标题与一致性尚未验证。

## Phase D — Production Soak

**INCOMPLETE；已观察子项无新增故障。** 采样窗口 **2026-09-16T16:46:43.109857 → 2026-09-16T17:03:30.499587**，共 101 个样本。只做只读观察，没有强制 rebuild、压测、服务重启或代码修改。

- service MainPID 始终 `2077176`，NRestarts 始终 0；cgroup MemoryCurrent **985.3–1014.1 MiB**，首尾 985.3 → 1014.1 MiB；累计 CPU 增量 **7.373s**。有限窗口未见严重资源增长，不能据此排除长期泄漏。
- 当前进程从 08:12:58 启动后，日志检索无 annual CLI build failed / build job failed / cached summary unavailable；采样中 cache cleanup errors=0。
- 最近 24 小时 build jobs：2 completed、6 failed；6 个历史失败的日志为 schema 拒绝 strongDan/standingPresentation，0.67.1 提交正是该修复。当前版本存在一次 completed build（job `cdd40fe0-68a5-4b40-b8c7-8435bd02ec73`，DB started→updated 差 6s），但不足以证明所有历史缓存升级都成功。
- 只读检查 5 个已存 summary：v4.4.0 ×2、v4.1.4 ×2、v4.5.0 ×1。旧行仍在并不自动等于 rebuild loop；没有观察到可归因于当前版本的重复重建。没有执行真实 v4.4→v4.5 stale rebuild 闭环，所以该项仍未验收。
- 生产首页 HTTP 200。未获得授权的 cached summary API 延迟、cold rebuild API 延迟及有效负载基线，**不能判定完整性能 PASS 或无回归**；401 请求耗时不充当业务延迟。
- 辅助 generator CLI（UID 40500773，隔离 cold-cache）：cold 2.021s、warm 1.854s，exit 0，完整输出彼此一致并与直接 producer 调用一致。**这是本机 CLI 耗时，不是生产 API 耗时。**

## 最终 Gate 与是否保持 production

**FAIL / BLOCK：wrong title（A-1）与 wrong evidence（A-2）。** 未发现当前生成器 crash、schema invalid、错选 strength candidate 或已确认的当前 rebuild loop；没有完成的 C/D 项不冒充 PASS。数据不足、隐藏 locale 缺项、ja canonical 文案及 profile 来源疑点不额外扩大用户定义的 BLOCK 标准。

**不建议以“v4.5 已验收通过”的状态继续保持当前 production。** 建议优先修复这两项已证实的跨层契约问题，保留冻结 Dan 模型与已验收 UI，再重跑 A 的受影响集合/全量、B，最后执行 C 和有有效请求的 D。现有证据不支持盲目回滚到已知存在 schema 故障的 0.67.0；本次未执行任何发布或回滚。

## 可复核证据

本机私有目录 `/var/tmp/annual-v45-validation-20260916/`（`/tmp/annual-v45-validation` 为链接）：

- `corpus-manifest.json`、`records.jsonl`、`extra-record.json`：语料和逐账号生成/确定性结果。
- `results/`、`contracts.json`、`provenance-reviewed.json`、`dan-observations.jsonl`：生成结果、schema/locale、standing/ordinary 和 observed 来源。注意 provenance 原始日志中 dan 的 event-array 匹配提示，须与通过的 dan-observations snapshot 增量核对合并解读；该算法本来不输出单独 dan event。
- `boundaries.json`、`generator-boundaries.json`、`fixture-contract.json`、`more-boundaries.json`、`cache-boundary.json`、`locale-buckets.json`：边界结果。
- `production-normalize.json`、`production-normalizer.js`：线上模块的实际浏览器复现与资源。
- `soak.jsonl`、`store.json`、`journal.txt`、`cli-check.json`、`source-hashes.json`、`scripts/`：只读观察、CLI 与运行依据。

真实 userdata、缓存、日志与凭据不提交 Git。报告中的 UID 是异常定位所需；不含 token、password 或 session。
