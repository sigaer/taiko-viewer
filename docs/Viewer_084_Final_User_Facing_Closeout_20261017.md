# Viewer 0.84 — 封面、Developer Token、My Taiko 最终用户功能收尾工作令

**执行性质：实际修复及上线，不再生成新的 RC / Freeze / Owner 待签循环。**
**基线：** 已上线 Viewer 0.84.0，main / production `c32195385dbdfed3aa13a56ad7e481fd7020b5c1`。使用 taiko-bot、taiko-viewer 的真实在用分支和受保护运行环境；涉及其他仓库，只改有关消费者。**不要将本文视为已经执行。**

## 0. 验收结果必须是用户可见的

1. 用户在 Bot 使用既有 `cover{songId} + 图片` 后，Viewer 歌曲列表、详情等实际封面入口显示这张图，不再错误显示 1384 或破图；上传中的部分失败有明确反馈与可重试机制。
2. 原设计的**已通过平台开发者申请审批且仍有效的 Developer Token 可跨用户读取任意指定 Taiko Source 的成绩**得到恢复和真实请求验证。平台的开发者资格审批就是这项成绩只读能力的准入点，不要求额外逐账号审批，不得因开发者与被读取用户不是同一账号而拒绝，也不强制每个目标用户创建 ResourceGrant。仅授予读成绩能力，不自动授予写成绩、同步、上游凭据、绑定修改或 history/成长权限。新版 ResourceGrant 可作为独立的逐用户授权模式继续保留，不得借此废除旧跨用户读取协议。
3. My Taiko 统一 ReadModel 面向所有正常登录的用户，撤掉仅 ID 1 可见的运营名单；未登录、未绑定与资料不足按既有授权及真实数据状态处理。
4. 实际部署后，只提交一次简洁结果：线上版本/SHA、3 项功能的明确实测状态、失败或回滚；不得以 `READY_FOR_REVIEW` 作终点。

## 1. 真实源码已知边界（先以当前 live source 核对；不能把静态推断当生产根因）

**Bot 两端**：`taiko_bot/runtime/community/{center,client}/cover.py` 以 400×400 PNG 写入 `${TAIKO_CENTER_ROOT 或 settings.root_dir}/assets/cover/{id}.png`，`ossutil cp -f` 上传 `oss://sigaer/cover/{id}.png`。目前这个指令**不生成** `cover/thumb/200/{id}.webp`、`cover/thumb/400/{id}.webp`。

**Viewer**：`taiko_viewer/components/SongCoverImage.vue` 的 `<picture><source type=image/webp ...><img src=...png>` 优先使用静态域缩略 WebP。404 时现有 `handleError` 会直接切 `fallbackSongId=1384`，即使 `{id}.png` 已存在，未建立“先 WebP → 再该曲 PNG → 最后占位图”的三段降级。`server/services/content/covers.ts` 的 `/api/content/covers/{id}` 还按 `getContentRuntimePaths().repoRoot/assets/cover/{id}.png` 检查本机；发布目录与 Bot 真实资产目录未必相同。当前真实故障可能有多种叠加原因，必须用确切曲 ID 验证。

**旧 Developer 源权限**：`server/services/account/source-access.ts` 的 `serviceGrant` 已支持经受控操作发出的 `source_read` + `sources='*'`，独立于被读取用户的 binding ownership；它通过 token/策略/撤销复核，对应原 `GET /api/developer/userdata/{userid}`。目前**普通** Developer Token 不等于此类 service grant，因此只创建一个普通 Key 不会自动取得该能力。`server/infrastructure/account/source-service-provision.ts` 和 `scripts/configure_source_service.ts` 已有运营侧、审计化、可撤销的赋权机制。`/api/v1/taiko/players/{playerId}/scores` 目前走另一套 ResourceGrant，且使用 opaque `plr_*`；不要把两种路径混称为一个权限。

**灰度开关**：`server/services/my-taiko/admission.ts` 只承认 `allowlist`，`server/services/my-taiko/overview.ts` 也硬编码 `allowlist`；`server/services/developer-api-v1/common.ts` 的 `enabled()` 和 `admission.ts` 将受限 clientIds 名单作为生效前提。只改生产配置不改两处逻辑，无法完成普遍开放。

## 2. P0 —— 封面链路先修，优先发布，不等待 API 工作

### 2.1 只定位一次真实上传案例

从最近 `bot-cover` 的**脱敏**审计选一个用户已报告上传成功的 songId，按以下顺序逐点核验，最多两例；不查询无关业务数据、不读取密钥：

- Bot 最终回复是否包含 OSS 成功；Bot 实际根 `${root}/assets/cover/{id}.png` 是否存在，400×400、PNG 可解码、SHA 稳定。
- OSS 对象 `cover/{id}.png` 是否存在，静态域 `https://static.sakura-bot.cn/cover/{id}.png` 的 HTTP 状态及 Content-Type；缩略对象两个 `.webp` 的 HEAD/GET 状态。
- Viewer 的 `/api/content/covers/{id}` 是否因 release 目录下没有本地同名 PNG 而 404；确认 `repoRoot` 实际解析到哪里，不把旧模板路径当事实。
- DevTools 中由 `SongCoverImage` 请求的 URL、status 和最终显示的图是该曲、1384 还是占位；区分 CDN 缓存、OSS 上传、缩略图缺失、路径错配。

### 2.2 最小修复（不新增通用媒体系统）

1. **Viewer 首先修降级链**：正常优先 WebP；WebP 请求失败时撤掉 `<picture>` 的 `<source>` 并切换到**同一 songId 的 PNG**；只有该曲 PNG 也失败才进入默认图/占位。切歌/组件复用时正确重置这两个独立失败状态，避免浏览器选择器继续命中失败的 `<source>`。保留懒加载。
2. **Bot 上传补齐缩略**：基于同一 400×400 PNG 生成 200/400 WebP，上传到 Viewer 既有 `cover/thumb/{size}/{id}.webp` 键名；禁止破坏原 PNG。统一媒体类型和缓存策略；使 OSS 成功提示明确区分“原图成功、缩略缺失”。失败要可针对同 ID 重新同步，不强迫先删除已有正确封面。补齐必要的缓存失效或短期版本化处理，不因边缘旧 404 长期显示默认图。
3. **Viewer 本地源路径**：若 `/api/content/covers/{id}` 确实引用了 release 源树而不是共享 Bot 资产根，为其配置受控的、只读的实际 cover 目录。不得扫描任意磁盘、把用户输入拼成开放文件路径或复制整套资产到每次 release。
4. 既有原图存在但缩略缺失的上传，使用**有限、可中断的缺失增量补齐**；不全库无差别重建，不替换用户原图，不记录 OSS 凭据。若根因只在 CDN/配置，不为通过本项盲改 Bot。

**最少验收**：新上传封面 + 历史缺缩略封面，OSS/PNG/WebP HTTP 及 Viewer 实际浏览器显示一致；原始 PNG 缺失时正确默认回退；中心端/客户端 `cover` 格式不变。只有本功能相关定向测试，修好即通过正常发布流程修线上。

## 3. P1 —— Developer Token 恢复原先的跨用户成绩读取语义

### 3.1 产品规则（已决定，不再问用户一次）

- 平台已批准、未撤销的 Developer Token 按原有产品承诺具有**全站玩家成绩只读权限**，可以按合法 taikoId/Source ID 读取**其他任意用户的成绩**，无需对方逐个创建 ResourceGrant，也不需要再次向 Owner 申请同一项产品决策。这里的“任意用户”是**读取目标不受开发者自己的绑定约束**，绝不意味着允许匿名、未审批/失效 Token、写分或读取上游凭据。
- 经审批的 Developer Token 与未审批、失效或已撤销的凭据必须区别。优先复用现有 `taiko_source_service_grants` 的 `source_read`、`sources='*'`、审计/撤销表达全局成绩只读；也可以采用等价的明确 `scores:read:any` 权限。**平台开发者审批通过即授予此限定只读能力**，不要求其另外申请 per-user grant 或第二张运营审批卡。不要简单删掉 `ownerGrant` 或 `proveGrant`，也不要把 `service` 的 write / bind / credential 权限顺带放开。
- 检查现有**已审批且 active** 的 Developer Token（含 pilot）是否缺这项权限；对符合这一既定资格的 Token 做幂等、带审计记录的精确补齐。新 Token 发放流程在原开发者申请审批通过时直接赋予**全站成绩只读权限**，不再手工逐 token 添白名单。未审批、撤销、失效、非 Developer 的凭据不得被升级；既有 grant 含其他服务 scopes 时不可盲目覆盖或额外放大。
- **保留原入口** `GET /api/developer/userdata/{userid}` 的兼容响应与跨用户成绩读取。 v1 opaque `playerId` + ResourceGrant 继续供细粒度第三方使用；如提供 v1 全局读入口，则必须明确独立的已批准全局能力，复用同一 Publication ReadView、标准字段白名单，不伪造 `plr_*`、不创建第二个数据 Writer。首轮以恢复原入口为必要验收，不强制为此扩展整个 v1 契约。
- 对跨用户读取只返回既有必要成绩/Profile 字段；确认原 raw DTO 无凭据或不应公开的秘密。保持限流、审计、禁用、Key 撤销和返回前复核。不得写回 Source。

### 3.2 停止 P-C 的单客户端名单

- 取消 `developerApiClientAllowlistPath` 对常规已批准 client 的**额外试点限制**，但保留 `developerApiV1` 可即时关闭的总开关；实际 client/app/token active、approval、expiry、ResourceGrant/全局独立权限由 SQL 检查，不用运营名单代替鉴权。
- 不重新设置“只有应用 5 才能用”的规则；已经发出的 pilot Key 保持原有效期与可撤销性，不改写已有 Grant 或把未经批准的客户端升权。
- `GET /api/account/developer/grants` 的可选应用列表同步去掉名单过滤，用户能给任何真实 approved active client 自主授权；分页、revocation、错误返回保持。

**最少验收**：approved 且含 global `source_read` 的 A Token 读取与其无关的用户 B 的成绩 200；A 凭据失效 401；只有普通 `scores:read` ResourceGrant 的另一应用不能越权到 B（403）；全局 Token 无绑定写/同步/私有凭据权限；v1 已授权和撤销后旧 ETag 仍正确；原接口返回 shape 不退化。所有负面场景只用受控合成账号或用户明确许可账号，不导出真实用户成绩正文。

## 4. P1 —— My Taiko 去单账号灰度

- `captureMyTaikoAdmission` / `readMyTaikoOverview` / `/account/auth/me` / `/my` 一致支持受控运行模式 `all`（全部**已登录**的账号）及 `legacy`（紧急关闭）；如保留 `allowlist`，它仅是可选兼容模式，不再是全局上线前置条件。
- Session/self owner/source 的双端复核、Publication 同代、Catalog revision、`private,no-store`、退出登录后清旧载荷等必须保留；客户端不能传 `userId/bindingId` 覆盖权限。
- 首次未完成 Publication 接管的真实旧账号，不得伪造成功或渲染另一用户成绩。根据实际兼容状态选择既有安全 legacy 体验或有明确错误提示；无可证明的旧数据一致性时不自动拼接不同代际。至少选择账号类型不同的合成或已授权实际账号验证正常用户、无绑定、读失败及切换。
- 不扩大至重写 Home/Goal/Growth 算法或全站统一；仅解决 `/my`。

## 5. 一次发布与关闭条件

建议一个 0.84.x 用户体验修复版本，封面紧急修复可在其他事项完成前单独优先上线。只改相关 Viewer / taiko-bot 代码或 OSS 资源；不要引入新 RC/冻结/Annual 性能测试。使用标准 PR/CI/构建/部署方法，保护其他仓库既有未提交改动和线上有效数据。

**发布前**：现有恢复点、完整旧构件回退程序保持有效；本轮新 DDL 若非必要绝不增加。按已经确定的开发者资格政策完成权限配置，并保存操作审计、撤销记录；不再生成重复的 Owner 申请卡，不记录私密 Key/成绩正文。公开的开发者说明须明确这种跨用户成绩可见范围。**发布后**只核对以下 3 条用户闭环：

1. `cover{id}+图片 → Bot确认 → OSS原图及必要缩略可读 → Viewer确实显示该图`；
2. `已批准的 Developer Token → 按 Source ID 读取不同用户成绩 → 撤销即拒绝`，同时 v1 ResourceGrant 独立生效；
3. `正常登录的不同账号 → /my 新读取可用，退出/切换/错误不泄漏旧正文`。

如果某一项失败，**仅回滚受影响的封面改动、My Taiko 功能开关或 Developer 全局只读授权**；不要删除 Source/Goal/measurement/history，不回退合法 Publication 代际，也不要为了绕过单一问题把整个站点改回 0.81。

**最终报告限制在一屏**：生产实际版本/commit、封面修复实例/HTTP/浏览器、Developer 跨用户读取与撤销测试、My Taiko 全员状态，以及真正剩余的用户可见故障（没有就写 NONE）。不要输出历史已签清单、SHA 海洋、下一轮工作令或 `READY_FOR_REVIEW`，也不要声称没有实际部署的修改已经生效。
