# Stage 4 · 账号

依据：`rework-playbook.md`、Design V1.3 Final（冻结 `5f770a2`，原型 `preview/redesign-v1/`）。分支 `feature/viewer-rework-stage4`。

## 切片 E1：登录、注册、找回密码、个人档案、设置

2026-11-18，基于 `6371b6c`，未提交、未合并、未部署，版本仍为 `1.15.0`。没有改 `server/api/**`、没有新增接口、没有数据库访问；
`/api/account/*` 的请求与响应、OIDC 与反向 OIDC 的服务端流程、Flutter 应用不受影响。**隔离验收（Linux）尚未运行**；下面除注明「真实」外都是本机开发自检：
登录态、账号读写、绑定、QQ、头像、我的小咚全部来自拦截的请求，没有任何账号、会话、绑定或头像在任何服务器上被创建、修改或删除；没有输入任何真实凭据（密码每次运行随机生成）。
切片 E2（同步、开发者、工单）不在本切片，没有改动。

### 做了什么

- **页面**（地址不变）：`/account/login`、`/account/register`、`/account/forgot-password`、`/account/profile`、`/settings`。五页都设 `hidePageHeader: true`（页面自己的 `<h1>`）与 `reworkElementPlus: true`；
  登录三页与设置 `contentLayout: "reading"`（设置原为 standard），档案保持 `standard`（1000 px = 200 目录 + 40 + 760 主栏）。`/account`（10 行的入口，302 到档案）未改。
- **呈现组件** `components/rework/account/*`（自动注册为 `ReworkAccount*`）：`AuthFrame`（登录三页的单栏）、`OidcOptions`（由 `components/account/OidcOptions.vue` 搬来，脚本原样，见「改动的数据代码」）、
  `ProfileLayout`（档案的目录与版面）、`ProfileSection`、`ProfileIdentity`、`ProfileBindings`、`ProfileQq`、`ProfileSignIn`、`ProfileMyDon`、`Settings`。
  档案页由 2,210 行降到约 940 行：取数、全部处理函数、确认对话框、滚动与焦点目标都留在页面里（处理函数逐字保留，见下），组件只呈现并发出意图。
- **纯数据** `utils/rework/account.ts`：档案页原来声明的响应类型（`ProfilePayload`、`MyDonShowcase*`，原样搬来）、区块 id、来源标记与称号条件的 locale 键映射。
- **共享件的增量**：`rework.css` 加账号表单件 `.rw-btn--block`、`.rw-btn--danger`（危险色描边）、`.rw-btn.is-busy`（请求中：禁用 + 转圈，减少动效时不转）、`.rw-input--block`、
  `.rw-field__hint` / `.rw-field__error`、`.rw-alert`（`--ok`）、`.rw-pw`（密码与显示开关）、`.rw-code-row`、`.rw-or`、`.rw-tag`（`--ok` / `--warn` / `--info`）；`ReworkIcon` 加 check / link / logout / mail / warn。
- **文案**：新增 `rework.account.*`（241 个键，中日一一对应）。五个页面与 OIDC 组件的行内中日表（`locale === 'ja' ? {…} : {…}`）全部迁入，**文字逐字不变**（由脚本从原文件抽取写入，`reworkStage4` 逐字核对删除、解绑、最后一个绑定等警告）；
  带占位的句子（`{id}`、`{qq}`、`{index}`、`{seconds}`）以原样占位传入，页面里原有的 `.replace(...)` 不用改。删去的说明文字见「偏离」。

### 功能对照：`/account/login`

| 改前 | 改后 |
| --- | --- |
| `el-card` 内 h2「登录账号」+ 说明段 | 页面 `<h1>`「登录账号」，说明段删去（见偏离） |
| `el-input` 用户名或邮箱（`name=username`、`autocomplete=username`）、密码（`name=password`、`autocomplete=current-password`、显示密码） | 原生 `rw-input`，`name` 与 `autocomplete` 不变，加 `autocapitalize=off`、`spellcheck=false`、`enterkeyhint`；显示密码改为输入框内的开关按钮（`aria-pressed`、读屏名称） |
| 「记住账号」`el-checkbox`，取消勾选时清除记住的账号 | 原生复选框，同一处理；「找回密码」链接移到同一行右侧 |
| 登录按钮（`.submit-btn`，请求中 loading） | 同一类名，请求中 `disabled` + `aria-busy` + 转圈；文字在已登录待继续时为「继续」 |
| 完成错误 `<p role=alert>`（服务端 statusMessage / 会话变化 / 跳转失败）+ ElMessage | `.rw-alert role=alert` 放在表单之前，表单 `aria-describedby` 指向它；ElMessage 保留 |
| 会话读取失败：提示 + 重试（只重读会话，不重发密码） | 同（`.rw-alert` + 按钮） |
| 第三方登录（`AccountOidcOptions purpose=login`） | 同一组件（搬家），标题画成分隔线，按钮为次要样式，显示真实的提供方名称 |
| 注册账号（带 redirect）、找回密码 | 注册在页脚（带 redirect），找回密码在记住账号一行 |
| `redirect` 校验（以 `/` 开头、非 `//`、无反斜杠与换行，否则档案页）；`authReturnNavigationOptions`；`account-guest` 中间件 | 未改（脚本只改了文案来源与 `showPassword`） |

### 功能对照：`/account/register`、`/account/forgot-password`

| 改前 | 改后 |
| --- | --- |
| 用户名（64）、邮箱、邮箱验证码（6，`one-time-code`）+ 发送验证码（60 s 冷却「Ns 后重发」）、密码、确认密码（两个 `new-password`）；注册后各字段的禁用条件 | 全部保留（原生控件，`name` / `autocomplete` / `maxlength` / 禁用条件不变）；验证码框 `inputmode=numeric` |
| 发送验证码：没填邮箱不发；发送中、冷却中、已注册时禁用；成功 ElMessage + 冷却，失败 ElMessage | 同；**新增**：结果同时显示在验证码框下（成功 `role=status`，失败 `role=alert` 且 `aria-invalid` / `aria-describedby`） |
| 两次密码不一致：ElMessage，不发请求 | 同；**新增**：错误显示在确认框下（`role=alert`），焦点移到确认框；之后边改边消失。只在提交时出现（失焦时出现会让按钮在点击中途下移、点击落空，自检发现后改掉） |
| 「至少 6 位」占位 | 改为密码框下的提示（`aria-describedby`） |
| 注册成功后登录失败：只重试登录（「继续登录」），已注册提示 `role=status` | 同（`.rw-alert--ok`） |
| 找回：重置成功后跳登录页；跳转失败可重试；不再发验证码 | 同 |
| 找回页的提交按钮是 `@click`（表单内回车不提交） | `type=submit`：回车提交，走同一个 `submit()` 与同样的守卫 |
| 注册页的第三方登录、去登录链接；找回页的返回登录 | 同 |

### 功能对照：`/account/profile`（逐区块）

页面原来没有把区块写进地址（没有 hash、没有 query 区块参数），所以目录是页内锚点：点击滚动并把焦点交给区块标题，**不写地址**；`#account-bindings` 这样的深链由浏览器原生落位。
`?oidc_error=…`（服务端 OIDC 回跳的契约）原来只在 OIDC 区块里显示提示，现在页面打开后滚到「登录与关联」区块，提示在视野里。

| 区块 | 改前 | 改后 |
| --- | --- | --- |
| 状态 | 加载 `el-skeleton`；读取失败时显示一张空档案（默认数据，用户名为空） | 加载骨架；**401（会话在页面上失效）→ `ReworkGate` 登录（redirect 回档案，无注册）**并重读会话；其他失败 → `ReworkState` 失败 + 重试（同一读取） |
| 目录 | 无 | ≥ 1100 左侧吸顶列表（当前区块 `aria-current`），以下为身份之后的一行可横滑链接；资料 / 游戏账号 / 登录与关联 / 我的小咚 / 第三方应用权限（有权限时） |
| 身份 | `el-avatar` 80 + 「更换头像」折叠（上传 / 恢复默认）；用户名 h2、站内称号（`AccountTitleBadges`）、邮箱、邮箱认证与鼓众 ID 认证两枚状态；当前绑定 ID；「更多资料」折叠（当前称号、注册时间） | `DsPlayerAvatar` 72（无头像为 `/default-avatar.svg`）+ 更换头像 / 恢复默认两个按钮；用户名为页面 `<h1>`；当前游戏称号 `DsTitlePlate`（≥ 768 牌面形式，牌面只在称号与验证时记录的称号相同才用记录的牌面编号，否则文字；以下文字形式）、站内称号 `DsSiteTitle`；当前绑定 ID、注册时间直接显示；邮箱与认证状态移到对应区块 |
| 年度入口 | `AnnualBetaContinue` | 未改，放在身份区内 |
| 游戏账号 | 未绑定引导卡（立即绑定 → 滚到表单并聚焦输入）；绑定卡：标题与说明、需重新验证提示、输入 + 开始验证、待确认（ID、记录称号、到期、确认按钮，开始后自动滚入并聚焦确认）、空、列表（名称、CN/JP/手动标记、验证称号、当前使用 / 切换、手动：改名 / 认领码 / 解绑 / 永久删除，其他：删除绑定）、手动成绩账号折叠（新建、认领） | 全部保留，顺序：引导、需重新验证提示、列表、绑定表单（含待确认）、手动账号折叠。列表行：名称、来源标记、**新增**每个绑定自己的「需重新验证」（API 的 `requiresReverification`，原来只对当前绑定提示）、鼓众 ID、验证称号（`DsTitlePlate` 文字形式）；区块标题旁为鼓众 ID 认证状态。解绑、永久删除、删除绑定为危险色描边 |
| 登录与关联 | （无此区块）OIDC 关联卡与 QQ 卡在绑定卡旁 | 邮箱（认证状态）、第三方账号关联（同一组件 `purpose=link`：已关联、OurTaiko 确认状态 `role=status`、重新授权、恢复确认、错误）、QQ（已绑定 / 待验证 / 未绑定三态，验证码发送后自动滚入并聚焦验证码框，解绑为危险色描边）、**退出登录**（见偏离） |
| 我的小咚 | 称号展示配置（状态、构图三选一 `el-radio`、5 个 `el-select` 可搜索可清空、提示、保存 / 恢复默认）+ 我的小咚图（无绑定、加载失败两种空态） | 图在前、配置在后；构图改为分段按钮（`aria-pressed`），5 个 `el-select`（`:persistent="false"`）；选项文字与原来逐字相同（单元测试对 64 种组合比对中日输出）；候选读取失败多了「重试」（同一读取） |
| 第三方应用权限 | 有 v1 权限时一行标题、说明、管理授权链接 | 同，作为一个区块 |
| 头像裁剪 | `AccountAvatarCropperDialog`（始终挂载） | 同一组件，只在打开期间（到关闭动画结束、清理完选择）挂载 |

### 功能对照：`/settings`

| 改前 | 改后 |
| --- | --- |
| 主题 `el-switch`（浅 / 深，写同一个 `useViewerTheme` 状态，插件写 `taiko_theme` cookie） | 分段按钮「浅色 / 深色」，同一状态与持久化；没有「跟随系统」（原来没有） |
| — | **新增**语言：中文 / 日本語 两个链接，与外壳的语言切换是同一个 `switchLocalePath` 链接（同样的地址与 cookie 行为），当前语言 `aria-current` |
| 缓存：条目数、估算大小、清空（危险色 plain，无确认）、明细表 | 同（清空为危险色描边，仍无确认，见「看到但没有改」）；明细为键列表 |
| 快捷入口：社区、工单、同步、开发者权限，审批两项只给原来的审批账号；每项一行说明 | 同样的链接与条件；说明删去（见偏离） |

### 守卫与确认（逐项保留）

- [x] 登录、注册、找回：请求中按钮禁用（`submitting`），重复点击不发第二次（自检断言）；`useAuthFormScope` 的视图 / 账号票据、离开页面后迟到的结果不生效（`accountEntryState` 28/28）。
- [x] 验证码：没填邮箱不发；发送中、60 s 冷却中、已完成时禁用；冷却每秒递减（自检断言）。
- [x] 两次密码不一致时不发请求（顺序在任何请求之前）。
- [x] 登录 `redirect` 校验与 `authReturnNavigationOptions`（服务端 OIDC 交互地址整页跳转）不变；已登录访问登录页仍由 `account-guest` 送到档案（自检断言）。
- [x] OIDC：`busy` 时所有提供方按钮禁用；已关联且不可重试时不发请求；开始请求体 `{ purpose, redirect, locale, recover }` 与 `window.location.assign` 不变。
- [x] 删除绑定：先确认；最后一个绑定再确认一次（第二次确认之前不发请求），`force: isLastBinding`（自检两种都走过）。取消不发请求。
- [x] 手动账号：解绑先确认；永久删除先确认（error 类型对话框）且请求带 `confirmed: true`；改名用输入框对话框（空值不能提交）；认领码用提示对话框。
- [x] QQ：解绑先确认；验证码为空时确认按钮禁用；开始与确认中禁用。
- [x] 绑定：`bindingAction` 的上下文 / 代次取消机制、开始与确认中禁用、400/409 后以档案为准刷新——处理函数逐字未改。
- [x] 切换当前绑定、删除绑定、头像上传 / 恢复、展示保存：请求中禁用（与原 `loading` 等价）。
- [x] 危险操作的触发按钮都是危险色描边：删除绑定、解绑（手动）、永久删除、QQ 解绑、清空缓存。

### 与原型或规则的偏离与原因

- **登录三页**：没有原型的右侧示例谱面舞台与手机顶部谱面条（示例数据，不放替身）；没有原型的「登录 / 注册 / 找回」同页切换（三个地址保留）。原型的逐字段即时校验（长度、邮箱格式）没有做：现有页面只校验两次密码一致，长度等由服务端判断，加前端规则会改变可提交的内容。
  删去说明段（「登录后可查看个人档案…」等，AGENTS 文案规则）和与标签重复的占位（「输入用户名或邮箱」等）；保留有信息的占位（「输入 6 位验证码」「输入注册邮箱」）。
- **档案**：用户名作为页面 `<h1>`（SEO 标题仍为「个人档案」）。原型的「编辑资料」「修改密码」「添加账号」对话框、上次同步时间、段位徽章不做（生产没有改名 / 改密码接口；段位不显示）。
  原型单独的「危险区」没有做：危险操作留在各自的行里，以描边危险色区分（每个绑定有不同的操作与确认，集中到一处会让人选错对象）。
  身份区头像固定 72（`DsPlayerAvatar` 的尺寸是固定档位）；手机上称号用文字形式（牌面 220 px 放不下）。头像按钮文字统一为「更换头像」（原来桌面「上传头像」、手机「更换头像」）。
  **退出登录**：生产原来的入口在旧侧栏（`SidebarNav.vue` 的 `handleLogout`），Stage 1 换外壳后站内没有任何退出入口；这里按旧侧栏的同一请求与步骤恢复（`POST /api/account/auth/logout` → 清本地账号状态 → 登录页；失败静默，与旧侧栏相同）。如负责人认为应放在外壳，可整段移走。
- **设置**：没有原型的目录、列表密度、曲名语言等（生产没有这些设置）；新增语言行（见对照表）；快捷入口的说明文字删去。
- 色彩：品牌青绿只用于主按钮、链接、选中与焦点；状态标签用 `--ok-wash` / `--warn-wash` / `--tag-info-*`；危险操作用 `--danger` 描边。

### 契约缺口（生产没有，界面不放替身）

- 修改密码、修改用户名 / 邮箱、注销账号（生产没有接口）；邮箱未验证时的重新发送验证邮件。
- 绑定的上次同步时间、来源同步状态（档案接口不返回，同步页另有）；QQ 绑定的 Bot 迁移结果明细。
- 登录方式列表里的「邮箱 + 密码」只有验证状态，没有最近登录时间、登录设备与会话列表（原型也只有前两项）。
- 设置：列表密度、曲名语言偏好、通知偏好（生产没有）。

### 改动的数据代码（请重点复核）

- `pages/account/profile.vue`：脚本由脚本化变换从原文件生成（处理函数逐字保留）。改动只有：响应类型搬到 `utils/rework/account.ts`；`copy` 改为读 locale（同名键、同文字）；两段确认文字改用 `copy`；
  `formatShowcaseRequirement` / `formatShowcaseOptionLabel` 改用 locale（输出逐字相同，单元测试比对）；新增（呈现）四个函数 ref 设置器与 `setShowcaseSlot`、`profileError`（读 `nuxtApp.payload._errors["account-profile"]`，即 `useAsyncData` 返回的同一个 error ref；
  解构那一行保持原样，年度合约脚本检查它）、`sessionExpired` / `profileFailed`、401 时重读会话（`fetchCurrentUser(true)`，已有的读取：否则外壳缓存的旧用户会让登录页的 guest 中间件把人送回档案）、
  页面重新激活（keepalive）时如果停在登录提示或失败态就调用原有的 `refreshProfile()`（重新登录回到档案时否则会看到缓存的登录提示；成功的页面仍不重读，与原来一样）、目录列表、`?oidc_error` 滚动、退出登录（见偏离）。
  这几处由自检发现：首轮里重新登录后回到档案仍是登录提示，补了激活时重读。
- `components/rework/account/OidcOptions.vue`（由 `components/account/OidcOptions.vue` 搬来，原文件删除）：脚本原样，文案改读 locale；提供方按钮文字的语序（中文「登录 X」、日文「Xでログイン」）放进 locale 消息（`loginWith` / `linkWith`），输出相同。
- 登录三页：`copy` / `completionCopy` 改读 locale；注册与找回新增呈现用的 `codeNotice` / `codeError`（在 `sendCode` 成功 / 失败分支各加一行，ElMessage 保留）、`confirmTouched` / `confirmInput`（不一致分支里置位并聚焦）、`showPassword`，并在 `useAuthFormScope` 的重置里一并清空。请求、守卫、顺序未改。
- `pages/settings.vue`：主题由 `el-switch v-model` 改为同一 `theme` 状态的分段按钮；新增语言链接；其余脚本未改。

### 测试基线（裁定 1；不需要数据库与浏览器的测试，逐文件运行）

证据：主检出 `.claude/stage-artifacts/slice-e1/baseline-before/`、`baseline-after/`（每个文件的完整输出）。

| 文件 / 命令 | 改前 | 改后 | 说明 |
| --- | --- | --- | --- |
| `npm run test:oidc`（`oidcConfig`） | 3/3 | 3/3 | |
| `npm run test:oidc:provider`（`reverseOidcAccount`、`reverseOidcProvider`） | 5/5 | 5/5 | |
| `npm run test:admin-auth` | 0/1 | 0/1 | 改前即失败（管理员登录路由的源码断言），不涉及本切片 |
| `accountEntryState`（登录、注册、找回的状态机，执行页面脚本） | 22/28（旧工装）；28/28（新工装，旧页面） | 28/28 | 工装改动见下；6 条原因是工装剥掉了登录页的 `authReturnNavigationOptions` 导入 |
| `authReturnNavigation` | 3/3 | 3/3 | 读 `login.vue` 源码，两处 `navigateTo(redirectAfterLogin.value, authReturnNavigationOptions(…))` 仍在 |
| `rememberedAccountIdentifier` | 8/9 | 8/9 | 读三页源码的 autocomplete 断言全部通过；第 9 条改前即失败（`new Function` 中的 import，Node 22） |
| `accountAnonymousAuth`、`dsPlayerAvatar`、`dsTitlePlate`、`uiBatch2State`、`officialTitles`、`accountSongsUi` | 3/3、3/3、5/5、4/4、6/6、15/15 | 同 | |
| `forumI18n`（`test:forum`） | 4/6 | 4/6 | 成长文案重复提示两条，改前即失败 |
| 年度合约里的档案页检查（`verify_annual_contract.mjs` 第 214–223、579–588 行，单独抽出运行） | 8/8 | 8/8 | 整个脚本在本机第 12 行停（年度 schema 在仓库外），改前改后相同 |
| `oidcSqlHttp`、`oidcNuxtUi`、`accountTitlesSql` | 0/1、0/1、0/1 | 同 | 需要隔离测试库与 `TAIKO_ALLOW_TEST_DB_MUTATION=1`（及构建产物、Linux Chromium），本机由环境守卫拒绝，Linux 验收运行 |

### 改动的测试断言与测试工装（逐条）

1. `tests/fixtures/accountEntryHarness.mjs`（工装，不是断言）：`t()` 由原样返回键名改为读真实 locale（缺失时仍返回键名），并提供页面导入的 `authReturnNavigationOptions`（工装会剥掉页面的 import）。
   原因：本切片把登录三页的文案搬进 locale，`confirmed expired session…` 一条断言 `completionError` 匹配「会话已变化」，键名会让它失败。副作用：改前就失败的 6 条（登录页导入的 `authReturnNavigationOptions` 被剥掉后未定义）随之通过——**在未改动的旧页面上**用新工装运行也是 28/28（`baseline-before/accountEntryState-updated-harness.txt`），旧工装 22/28。
2. `scripts/verify_annual_contract.mjs`（`npm run test:annual` 的一部分）：档案页的五条源码检查（引导卡、`pending-box` 在 `manual-account-panel` 之前等）改为读「页面 + `components/rework/account/ProfileBindings.vue`」，因为绑定的标记搬进了组件；检查内容不变。
   `useAsyncData<ProfilePayload>` 与 `useAsyncData<MyDonShowcasePayload>` 两条仍只读页面，原样通过。这个脚本在本机第 12 行就停（年度 schema 在仓库外），所以另用一个只含这几条检查的临时脚本在改前 / 改后各跑一次：改前 8/8，改后（新读法）8/8。
3. 新增 `tests/reworkStage4.test.mjs` 8 条；新增工装数据 `tests/fixtures/profile-showcase-labels-original.txt`（改前的两个称号标签函数，逐字，用于比对）。

### 验证

| 层级 | 内容 | 结果 |
| --- | --- | --- |
| 业务测试基线（真实） | 见上表，账号相关 19 个文件 / 命令改前改后逐文件运行 | 通过 / 失败数逐文件相同（失败的都是改前即失败或环境守卫）；`accountEntryState` 因工装修正 22→28（旧页面上新工装同为 28） |
| 静态 / 单元（真实） | `npm run test:ds`、`npm run check:ds`、`npm run test:version`、`reworkStage1`…`reworkStage4` | 90/90；通过（tokens 2352 值、EP 两作用域、对比度 368/368、token 对照表已重新生成——旧样式删除后 `--viewer-*` 引用数下降、scoped CSS 设计系统目录 0、ds usage 149 文件 0、ds copy 145 文件、小图标 46）；1/1；14/14、19/19、11/11、8/8 |
| 静态（真实） | `account-fixtures.ts` 用 tsc strict 按真实类型检查（`AccountAuthUser`、`ProfilePayload`、`ProfileBinding`、`MyDonShowcasePayload`） | 该文件 0 错误（只有 `~/` 别名在 Nuxt tsconfig 之外无法解析，同前几个切片） |
| 本机真实 SSR（`nuxt dev`，无数据库，合成 OIDC 提供方配置） | 中日各一组：登录、注册、找回、设置 200，HTML 带 `rework-ep` 与页面 `<h1>`，表单的 `name` / `autocomplete`（`username`、`current-password`、`email`、`one-time-code`、`new-password`）在服务端 HTML 里，找回页没有 `autocomplete="username"`；登录与注册的第三方登录列表由服务端渲染（真实提供方名称）；`/account/profile` 302 到 `/account/login?redirect=<本页>`、`/account` 302；浏览器水合 0 警告 0 错误、唯一 `<h1>`、无横向溢出 | 2/2 |
| 本机真实（无账号数据） | 设置：主题切换写 `taiko_theme` cookie、刷新后服务端按 cookie 渲染深色、外壳主题按钮与页面状态一致；缓存明细与清空；语言链接到 `/ja/settings` | 1/1 |
| 拦截数据的自检（intercepted） | 登录：401 / 429 提示在表单前（`role=alert`、`aria-describedby`），失败后密码与可编辑状态保留，显示密码开关，请求中禁用且不发第二次，成功跳 `redirect`；外部 `redirect`（`//…`）落到档案；已登录打开登录页回档案；会话读取失败只重读会话（0 次密码请求）；注册链接带 redirect | 4/4（含键盘） |
| 拦截数据的自检（intercepted） | OIDC（中日）：按钮为「登录 Synthetic OIDC」/「Synthetic OIDCでログイン」、高 ≥ 44；开始失败提示且按钮恢复；开始请求体 `{purpose:"login", redirect:"/my", locale, recover:false}`、路径 `/api/account/oidc/mock/start`；**出站地址 `https://idp.example.invalid/authorize?state=selfcheck` 被记录并中止，没有跟随**；`?oidc_error=` 三种提示文字 | 2/2 |
| 拦截数据的自检（intercepted） | 注册：没邮箱不发验证码；429 拒绝在验证码框下；成功提示、60 s 冷却递减、冷却中不发；两次密码不一致：错误在确认框下、焦点到确认框、0 次注册请求；注册成功登录失败：只重试登录，注册 1 次，请求体逐项；找回：验证码 `purpose:"reset"`、400 拒绝保留输入、成功跳登录 | 3/3 |
| 键盘（intercepted） | 登录：Tab 到用户名 → 密码 → 显示密码 → 记住账号（空格勾选）→ 回到密码回车提交并跳转；注册：全程键盘，发送验证码后冷却中的按钮被跳过，回车提交 | 2/2 |
| 拦截数据的自检（intercepted） | 档案（1440）：身份（`<h1>` = 用户名、站内称号、头像、当前 ID）；目录 5 项、左侧、点击聚焦区块标题、**地址无 hash**、`aria-current` 跟随；绑定 3 行的来源标记、当前、手动行两枚危险按钮；切换（请求中禁用、成功、409 失败提示）；删除绑定（确认、Esc 取消不发请求、**焦点回到「删除绑定」**、确认后 `{bindingId:2, force:false}`）；手动账号改名 / 认领码 / 解绑 / 永久删除（取消不发、确认后 `confirmed:true`）/ 新建 / 认领（各请求体）；开始验证（去空格）、待确认、400 提示、确认成功；登录与关联：邮箱、已关联 OIDC 的远端状态 `role=status` 与唯一按钮、QQ 待验证（空码禁用、回车确认、解绑确认）；我的小咚：图、构图、选项文字逐字、保存 `{layoutMode:"full", titleNames:["红","自定义称号"]}`、恢复 `{layoutMode:"nickname", titleNames:[]}`；头像：选择文件 → 裁剪对话框（焦点在对话框内）→ multipart 上传 → 对话框节点卸载、恢复默认 DELETE；第三方应用链接；触控目标；退出登录；关联的重新授权（键盘回车）请求体 `{purpose:"link", redirect:"/account/profile", locale:"zh", recover:false}` 与出站地址 | 1/1 |
| 拦截数据的自检（intercepted） | 档案状态（390 深色）：未绑定引导 → 聚焦输入、我的小咚空态；手机目录在身份之后；最后一个绑定两次确认（第二次之前 0 请求）、`force:true`；QQ 未绑定 → 验证码框滚入并聚焦；需重新验证提示；档案读取 500 → 失败 + 重试 → 恢复；候选读取 500 → 重试；**会话过期**：服务端会话已无（auth/me 游客、档案 401）而外壳仍是旧用户 → 登录提示（无注册、redirect=/account/profile）→ 登录 → 回到档案并显示内容；`?oidc_error=identity_conflict` 落在登录与关联区块并显示提示 | 1/1 |
| 拦截数据的自检（intercepted） | 矩阵：登录、注册、找回、设置（真实）+ 档案（拦截）× 360/390/820/1440 × 浅/深（中文）+ 日文 390 浅、1440 深 = 10 组 50 页：`rework-ep`、主题、唯一 `<h1>`、无横向溢出、`.rw-btn` / 分段 / 目录链接高 ≥ 44、≥ 1100 目录在左、以下为身份之后的整行 | 10/10 |
| EP 开关 | /about 无 `rework-ep` → 四个真实页面与档案有（`--el-color-primary` = 品牌色）→ 打开称号下拉 → 回 /about 去掉、`<body>` 子节点不多于基线 + 2 → 返回档案恢复 | 1/1 |
| 合计 | `account-selfcheck.mjs` 最终一次（全部修改之后） | **25/25**，0 控制台错误、0 水合警告、0 Vue 警告；`portFreeAfter: true`、`browserStoppedAfter: true`；最长任务 146 ms（开发模式） |
| 回归（共享文件：`rework.css`、`Icon`、locale） | 改后（最终代码）：曲库 HTTP 57/57、SSR 失败通过、24/24；切片 A 44/44 + SSR 失败；切片 B 25/25；切片 C 54/54；切片 D 27/27。**改前没有重跑**：动手前我没有先跑，第一次想到时共享文件已改；改前的参照是切片 D 记录里在 `6371b6c` 上的同一组数字（完全相同） | 端口与浏览器进程结束后都已释放 |
| 未验证 | 真实数据库与登录、真实 OIDC 往返、真实邮件验证码、生产 Nitro、Linux 浏览器、密码管理器的保存与填充（只验证了属性）、真机触控、读屏播报 | — |

自检过程中发现并改掉的（`dev1/` 里有失败截图）：确认密码的错误原来在失焦时出现，按钮在点击中途下移导致点击落空（改为只在提交时出现）；会话过期后重新登录回到档案仍是缓存的登录提示（激活时重读）；设置页单栏宽度塌缩、我的小咚区块里重复的标题。

运行：`node scripts/rework/account-selfcheck.mjs --port=3575 --out=<目录> [--only=<场景前缀,…>]`（共享运行器；开发服务器另带一个合成 OIDC 提供方配置，issuer 为无人应答的 `https://127.0.0.1:1`）。
证据（不提交）：主检出 `.claude/stage-artifacts/slice-e1/`：`final/`（`slice-e1-selfcheck.json`、截图、`nuxt-dev.log`、`console.txt`；`*-real-*` 为真实服务端渲染，`*-intercepted-*` 为拦截数据）、`run1/`、`dev1/`（开发中的分段运行，含 `FAILED-*`）、`baseline-before/`、`baseline-after/`、`regression-after/`。

### Linux 隔离验收（尚未运行）

在 `shell-sql.mjs` 加 `--check=account`，新建 `account-check.mjs`：沿用 `shell-check.mjs` 的合成账号（`SELECT DATABASE()` 以 `_test` 结尾 + `TAIKO_ALLOW_TEST_DB_MUTATION=1` / `--allow-test-db-mutation`），生产 Nitro，`runAccountScenarios()`，把 `openContext` 的账号拦截换成真实请求（需要一个「不拦截 `/api/account/*`」的开关，本切片没有写）：

- **真实登录（HTTPS）**：合成账号用户名 / 邮箱登录、错误密码、限流、`redirect` 回跳（含 `/oidc/interaction/<uid>` 整页跳转）、会话 cookie 的 `Secure` / `SameSite`、浏览器密码管理器的保存与填充（Chrome、Safari 各一次）；
- **注册与找回**：测试邮件出口的验证码、60 s 冷却与服务端频率限制、过期 / 错误验证码、注册后登录；
- **OIDC**：测试提供方（非 OurTaiko 生产 issuer）完整往返——登录、邮箱冲突、需要原账号、关联、OurTaiko 远端确认的各状态（`oidcNuxtUi.test.mjs` 已有的矩阵按新结构仍可用：`.oidc-options`、`.oidc-linked`、唯一的 `[role=status]`、唯一的按钮、`.profile-main-card`、`.submit-btn` 都保留）；
- **绑定验证**：开始验证 → 修改称号 → 确认（隔离的抓取服务桩）、过期与替换的挑战、最后一个绑定的强制删除、手动账号的新建 / 认领 / 改名 / 认领码 / 解绑 / 永久删除、QQ 验证码与 Bot 迁移；`binding-generation` 跨页失效；
- **会话过期**：页面打开期间删除会话行 → 档案读取 401 → 登录提示 → 登录后回到档案；写操作在会话失效时的提示；
- 头像上传与裁剪（隔离的媒体目录）、我的小咚图与展示保存；
- 另需在 Linux 上更新 `scripts/verify_my_navigation_browser.mjs`（切换绑定按 `.binding-item` 与按钮名称，仍可用；`.my-profile .account-title` 属于 `/my`，不受影响）。

### 看到但没有改

- 设置页「清空缓存」没有确认，并且 `localStorage.clear()` 会清掉记住的账号、主题备份等所有本地数据（原样保留；是否加确认由负责人决定）。
- 设置页的审批入口按写死的用户名与邮箱判断（`isDeveloperReviewer`），原样保留。
- 档案页 keepalive：离开再回来不重新读取档案（原来如此）；在别的页面切换了绑定后回到档案，看到的是旧数据，直到刷新。
- 站内（外壳）没有退出登录入口（Stage 1 起）；本切片只在档案页恢复了一个。
- `tests/rememberedAccountIdentifier.test.mjs` 第 9 条在本机失败（`new Function` 里出现 import 语句，Node 22 的问题），改前改后相同。
- `tests/adminAuthTrustBoundary.test.mjs`（`test:admin-auth`）改前改后都失败（管理员登录路由的源码断言，与本切片无关）。
- `forumI18n` 两条成长文案重复提示（切片 D 已记录）。

## 切片 E2：同步、开发者、工单

2026-11-18，基于 `f3c10b2`，未提交、未合并、未部署，版本仍为 `1.15.0`。没有改 `server/api/**`、没有新增接口、没有数据库访问；`/api/account/sync*`、`/api/account/score-token`、
`/api/account/developer/**`、`/api/support/**`、`/api/account/support/review/**` 的请求与响应不变。**隔离验收（Linux）尚未运行**；下面除注明「真实」外都是本机开发自检：
登录态、同步、token、开发者申请与审批、授权、工单全部来自拦截的请求；所有 token / 密钥都是合成值（`SYNTHETIC-…`、`tk_synthetic…`），截图里只有合成值。

### 做了什么

- **页面**（地址不变）：`/account/sync`、`/account/developer`、`/account/developer/grants`、`/account/developer/review`、`/docs/score-token`、`/support`、`/account/support/review`。
  全部设 `hidePageHeader: true`（页面自己的 `<h1>`）与 `reworkElementPlus: true`；版面宽度不变（同步、开发者、授权、文档 reading；工单 standard；两个审批台 wide）。
- **呈现组件**：`components/rework/sync/*`（`Overview` 当前绑定 + 能否同步 + 目标 + 开始 + 本次结果，`LastSync`，`ScoreToken`，`Kinoko`，`GoalResult`，`NextSteps`，`IndicatorSource`），
  `components/rework/developer/*`（`Status`、`ApplyForm`、`Applications`、`Review`、`ApiGuide`——由 `components/account/DeveloperApiGuide.vue` 搬来、原文件删除，脚本只改了语言选择一行，见下），
  `components/rework/support/*`（`Tickets`、`Review`），`components/rework/ScoreTokenDocs.vue`。授权页 `grants.vue` 仍是自包含的原生标记（见「偏离」）。
- **纯数据**：`utils/rework/sync.ts`（同步页原来声明的响应类型，原样搬来；`syncReadiness`、`syncOutcome`、`syncIndicatorKind` / `syncIndicatorMark`），`utils/rework/developer.ts`（开发者两页的响应类型，原样搬来）。
- **外壳与共享件**：顶栏同步按钮反映同步页最近一次读到的状态（见「同步阶段」）；`ReworkIcon` 加 copy / key；`rework.css` 加 `.rw-lead`、`.rw-facts`、`.rw-alert--warn` / `--info`。
- **文案**：新增 `rework.account.{sync,developer,grants,developerReview,support,supportReview,scoreTokenDocs}`（中日键一一对应，按文本插入，其余格式未动）。七个页面的行内中日表
  （`copy`、`goalCopy`、两页的分类表、授权页的 `ja.value ? {…}`、文档页的步骤 / 须知 / 约束 / SEO 文字、`'前往账号资料'` 等零散行内文字）由脚本对原文件求值抽取，**逐字**写入
  （`tests/fixtures/e2-copy-original.json` 是抽取结果，`reworkStage4` 逐键比对）。占位（`{seconds}`、`{id}`、`{count}`…）原样传入，处理函数里的 `.replace(...)` 不用改。删去的说明性副标题见「偏离」。

### 功能对照：`/account/sync`

| 改前 | 改后 |
| --- | --- |
| 布局 h1 + 卡片 h2「多端同步」+ 说明段 | 页面 `<h1>`；说明段删去，其中「提交后进入 30 分钟冷却」改为开始按钮旁的一行提示 |
| 绑定信息格：当前绑定 ID、当前称号、冷却状态（剩余 Ns / 可立即同步） | 第一块：当前绑定（名称 + ID）、称号（缺失「—」）、右上状态标签（冷却中「剩余 Ns」，可同步「可立即同步」，需重新验证 / 服务未配置时不显示）；**新增**「最近一次同步 · 时间 · 结果标签 · 查看结果」一行（数据就是下方卡片的 lastSync） |
| 无绑定：el-empty「请先绑定…」，下面各卡片照常显示（按钮全部禁用） | `ReworkGate need=binding`（去档案页绑定）；token 与迁移区照常显示且禁用；目标列表与开始按钮不显示（原来显示但禁用） |
| canSyncFromWahlap=false：重新验证 / 手动已保存 / 服务未配置三种 el-alert + 「前往账号资料」 | 同样三种（手动为中性，其他为警告）+ 同一链接，在第一块里 |
| 同步目标卡（手动绑定不显示）：el-checkbox-group（`pending || submitting` 时禁用）、无目标空态、开始按钮、冷却时文字「冷却中 Ns」 | 同一块里：原生复选框 fieldset（同一禁用条件）、同样空态、开始按钮的禁用表达式逐字不变、同样文字；请求中转圈 + `aria-busy` |
| 结果：ElMessage（成功 / 部分 / 失败 / 未返回 / 传输错误） | ElMessage 保留；**新增**同样文字的结果行在按钮下（成功、警告 `role=status`，错误 `role=alert`）；没有本次结果且上次不是成功时，显示 buildSyncFeedback 的原因 |
| 「接下来」（showNextSteps）三个链接 | 同条件、同链接，按钮样式 |
| 最近一次同步卡：时间、整体状态、压缩体积、压缩比例、逐目标（名称、成功 / 失败、HTTP · message、解压 · 曲目） | 全部保留（`#sync-last-result`） |
| 网页成绩 token：说明、文档链接、手动 / 不可用提示、掩码 / 生成时间 / 最近使用 / 状态标签、一次性明文 + 复制、生成或轮换、撤销（danger plain） | 全部保留；状态标签在标题旁；撤销为危险色描边并与生成 / 轮换分在两端；文档链接加了 `localePath`（日文页原来指向中文文档） |
| 菌菌迁移：说明、迁移目标、API 密钥（password + 显示、autocomplete=off）、两个按钮（冷却文字）、提示 | 全部保留；回车仍提交「一键迁移成绩」；**新增**未填密钥时错误在输入框下并聚焦、本次结果行；两个按钮都为次要样式（页面只留「开始同步」一个主操作） |
| 目标进展块：标题、上下文变化提示、结果、目标名、变化、重试、返回目标 | 全部保留（`.goal-sync-result`、`.goal-return` 类名保留） |
| `AnnualBetaContinue` | 未改，位置不变（页头之后）；年度合约脚本不读这个页面 |

### 同步阶段：接口能给出的与呈现（RK-03）

接口是同步的：`POST /api/account/sync` 一次返回 `log`（`status` = success / partial / failed，其他值归为失败）与逐目标结果；没有阶段、进度、耗时、历史列表。因此**不做**原型的三步步骤器、
进度 n/3、新进展条数、历史表（契约缺口）。客户端能区分并呈现的：

| 状态 / 结果 | 来源 | 呈现 |
| --- | --- | --- |
| 读取中 / 读取失败 | 概览 `pending` / `error` | 骨架 / 失败 + 重试（同一读取） |
| 未绑定 · 手动 · 需重新验证 · 服务未配置 · 无目标 · 冷却中 · 可同步 | 概览字段，判断顺序同开始按钮的禁用条件（`syncReadiness`，单元测试逐组合比对） | 见对照表 |
| 未选目标 / 目标上下文已变 | 页面校验（不发请求） | 结果行 warning + toast |
| 请求中 | `submitting` | 按钮转圈禁用、目标锁定、外壳按钮转动 |
| 成功 / 部分成功 / 失败 / 未返回结果 | 返回的 `log` | 结果行 + toast；随后重读概览 |
| 传输错误（含 409 profile-changed、503、服务端 504 超时） | 抛错的 `statusMessage` | 结果行 `role=alert` + toast；恢复动作同前：冷却允许时再按开始 |
| 取消 | 离开页面（keepalive 停用） | 迟到的响应被丢弃：无 toast、无结果行、无请求中状态（客户端原来就没有取消按钮和自己的超时） |

**外壳同步按钮**：同步页渲染一个不可见的 `ReworkSyncIndicatorSource`，把「本账号 + 本绑定代次」下最近读到的概览换算成状态写进 `useState("rework-sync-indicator")`；外壳只读它，
账号或绑定代次不同就当作未知。未知（这次访问还没打开过同步页）时与原来一样是普通链接；running 时图标转动（减少动效时不转、改颜色），未绑定 / 需处理 / 从未同步 / 部分成功为山吹点，
失败为危险点；`aria-label` 读出状态（「同步：上次同步失败」）；在同步页时 `aria-current=page`。**没有新增任何请求或轮询**。

### 功能对照：开发者三页与文档页

| 页面 | 改前 | 改后 |
| --- | --- | --- |
| `/account/developer` | 卡片：标题、说明、当前状态（原始英文 status）、Token 掩码、最近使用、审批台链接（canReview） | 页头 `<h1>` + 说明（权限范围，保留）；状态块：状态标签（pending / approved / rejected 译名，未知值原样）、掩码、最近使用、审批台链接 |
| | 接入指南（隐藏挂载，保持 ElTabs） | 同（`ApiGuide`：`data-*` 钩子与类名不变，h3→h2；复制按钮改 `rw-btn`；代码块与字段表在自身内横向滚动且可聚焦；复制只复制示例） |
| | 申请表（canSubmit 时）：反馈邮箱、理由（4000 计数）、截图（最多 4 张、文件名）、提交（禁用文字） | 同；邮箱 `type=email`（表单 `novalidate`，能提交的内容不变）；**新增**理由 / 邮箱为空时错误在字段下；回车提交与原来相同（原表单只有一个文本框，回车即提交） |
| | 申请状态（时间、邮箱、理由、截图、审批反馈）、历史（状态、时间、邮箱） | 同；状态用译名 |
| `/grants` | 标题、两段权限说明、错误 + 重新加载、状态行、限量提示、授权记录（应用、绑定、状态、范围、到期、撤销）、分页、授权新应用（两个下拉、不同意 / 同意）、开发者应用（注册、列表、停用 + `window.confirm`、分页） | 全部保留，`id` / `data-*` / 按钮名称不变；嵌套的 `<main>` 改为 `<div data-grants-page>`（同一 `aria-busy`）；撤销授权、停用应用为危险色描边；授权卡片标题 h2→h3；空状态行只给读屏 |
| `/review` | 待审批（申请人、邮箱、时间、理由、截图、通过 / 驳回）、历史（状态、邮箱、备注）、无权限 el-result | 同；说明段只留后果句「审批通过后将自动签发 24 位开发者 Token。」；任一申请处理中时所有决定按钮禁用（原来只禁用该条，处理函数本来就会拒绝） |
| `/docs/score-token` | 布局 h1、引言、返回链接、步骤、安全须知、API 表、请求 / 响应示例、错误表（**只有中文**）、约束 | 页面 `<h1>` + 引言 + 返回链接；内容逐字相同；错误表与请求示例的占位进 locale（日文页新增日文译文）；面包屑「多端同步」改为 `account.sync` 键 |

### 功能对照：工单两页

| 页面 | 改前 | 改后 |
| --- | --- | --- |
| `/support` | 说明卡；表单：分类（7 项）、标题（120 计数）、联系方式（255，默认账号邮箱）、内容（8000 计数）、提交（loading）；我的工单：错误 + 重试、空 / 加载、卡片（编号、分类、未读、标题、状态、投递、内容、时间、联系方式、查看详情 / 收起）、对话、追加留言（8000）、已关闭提示、详情失败 + 重试 | 全部保留（原生控件，同样上限与计数）；≥1100 两栏；**新增**标题 / 内容为空时错误在字段下并聚焦，追加留言为空时错误在框下；展开按钮 `aria-expanded` / `aria-controls`；提交按钮仍是 `type=button`（原表单回车不提交） |
| `/account/support/review` | 待处理 / 已关闭列表、选中详情（用户、分类、联系方式、状态、对话、回复 + 三个操作）、无权限 | 同；≥1100 左侧列吸顶，以下列表在上；手机上选中后焦点移到工单标题并滚到它；占位改为「请选择一张工单」（原「请从左侧选择工单」在手机上方位不对）；动作后的重读期间保留列表与当前工单（原来整页换成骨架） |

`/support` 需要登录（`account-auth`，原样），没有不登录的公开表单；服务端渲染为 302 到登录页。工单没有附件功能（生产不存在）。

### 守卫与确认（逐项保留，接在 E1 清单之后）

- [x] 同步：开始按钮禁用表达式逐字保留（`pending || !overview.currentBinding || overview.canSyncFromWahlap === false || cooldown > 0 || !overview.targets.length`），请求中另加禁用；
  目标在 `pending || submitting` 时锁定；`submitting / pending / evaluatingGoal` 时不发；目标上下文变化与未选目标在请求之前拦下（自检断言 0 请求）；请求中第二次点击不发（自检断言）。
- [x] 同步：离开页面后迟到的响应不生效（`useAccountPageScope`，自检断言无 toast、无结果行）；冷却每秒递减（自检断言）。
- [x] 迁移：两个按钮禁用条件同前（无绑定、冷却、另一个在进行）；密钥为空不发；请求中输入框禁用；被拒绝时密钥保留，接受后清空。
- [x] token：撤销先确认（warning 对话框，Esc / 取消不发请求）再请求；绑定切换时关闭确认框（`accountEntryState`）；生成 / 轮换无确认（原来如此）；请求中两按钮禁用。
- [x] 开发者申请：canSubmit 之外不显示表单；理由、邮箱为空不发；只取前 4 张图；请求中禁用、重复点击不发（自检断言 1 次 multipart）。
- [x] 开发者审批：通过 / 驳回都先弹输入框；驳回理由必填（输入框校验，未填 0 请求）；身份切换关闭对话框（`accountEntryState`）；处理中所有决定按钮禁用。
- [x] 授权：同意需两项都选；不同意清空并收起；撤销只对未撤销的授权；停用应用 `window.confirm`（取消 0 请求，自检断言）。
- [x] 工单：标题、内容、追加留言为空不发；提交 / 追加中禁用；审批台回复为空不发，三个操作请求中都禁用；关闭工单无确认（原来如此）。

### 秘密值的处理

- 网页成绩 token 明文只在「生成 / 轮换」成功后的一次性区块里出现一次（`issuedScoreToken` 在模板里只传给这个区块，单元测试断言）；离开页面即清空（原 `actionScope` 重置）；
  不进地址、存储、标题、cookie（自检 `secretLeaks` 断言为空），不进外壳状态。掩码照常显示；明文框在自身内横向滚动；复制行为不变。
- 开发者 Token 明文只在审批通过后的提示框里（原样），开发者页只显示掩码。迁移密钥为 password 框（可切换显示）、`autocomplete=off`，请求体不变。
- 截图里的 token 都是 `SYNTHETIC-…`（文件名带 `SYNTHETIC`）；fixtures 里没有像真的值。

### 与原型或规则的偏离与原因

- 同步：没有原型的三步步骤器、进度、开关式目标、逐目标「已同步时间」、历史表、新进展统计（接口没有，RK-03）；目标仍是本次同步的选择（复选框），不是持久开关。
  删去说明段与「同步目标」「最近一次同步」两个副标题、「冷却状态」标签（AGENTS 文案规则；冷却显示在状态标签里）。没有原型的「重新生成…」确认（生产没有，守卫不加不减）。
- 开发者：删去「申请状态」「历史记录」两个副标题，历史记录并入申请状态块（h3）。审批台说明段只留后果句（删去写死的审批人名）。
- 授权页不用任何自动注册组件，样式只用 Element Plus 变量：`check-token-collisions` 不许页面读 DS token，Linux 的同意 / 管理检查又单独编译这个文件；在本页 `rework-ep` 下这些变量就是 V1.3 映射值。
- 工单：删去「把标题、现象…」「这里会保留…」两个副标题与「加载中...」文字（改为骨架）。
- 文档页：日文页的错误表原来是中文，现为日文译文（新文字；中文逐字不变）。

### 契约缺口（生产没有，界面不放替身）

- 同步：阶段与进度、耗时、多条历史、新进展 / 新全连 / 新全良统计、逐目标最近成功时间、目标开关的持久化、取消接口。
- 外壳同步状态：没有轻量的「最近同步状态」接口，打开同步页之前外壳不知道状态（不为此加轮询）。
- 工单：附件、按状态 / 分类筛选、重新打开。

### 改动的数据代码（请重点复核）

- `pages/account/sync.vue`：响应类型搬到 `utils/rework/sync.ts`；`copy` / `goalCopy` 改读 locale；`buildSyncFeedback` 无结果时的行内文字改读 locale（同文字）；**新增**呈现状态
  `syncNotice`、`importNotice`、`scoreTokenError`——只在原有 ElMessage 旁各加一行赋值、在开始时清空、在 `actionScope` 重置里清空；未填密钥时聚焦输入框（`kinokoForm` 引用）；`lastFeedback` 计算属性。请求、守卫、顺序未改。
- `pages/account/developer/index.vue`、`review.vue`、`grants.vue`、`pages/support.vue`、`pages/account/support/review.vue`：类型搬家（开发者两页）；`copy` 与分类表改读 locale；
  开发者申请与工单**新增**字段错误 ref（在原校验分支里各加一行、在重置里清空），工单另加两个输入框引用用于聚焦；`detailErrors` 行内文字改读 locale；`grants.vue` 的 `useI18n` 解构加 `t`。
- `pages/account/support/review.vue` 模板：加载态只在首次没有列表时显示（动作后的重读期间保留版面；原来整页换成骨架，手机上选中工单后的焦点也因此丢失——自检发现）。
- `components/rework/developer/ApiGuide.vue`：语言选择由 `props.locale === 'ja' ? 'ja' : 'zh'` 改为按 `developerGuideCopy` 的键选择（zh / ja 结果相同；`check-ds-copy` 不允许行内语言分支）。

### 测试基线（裁定 1；不需要数据库与浏览器的测试，逐文件运行）

证据：主检出 `.claude/stage-artifacts/slice-e2/baseline-before/`、`baseline-after/`（两个 `summary.txt` **逐行相同**）。

| 文件 | 改前 | 改后 | 说明 |
| --- | --- | --- | --- |
| `accountEntryState`（执行同步、授权、审批、工单页面脚本） | 28/28 | 28/28 | |
| `homeDeepState`、`growthPageState`、`accountSyncWorker`、`internalServiceBoundary`、`privateCacheBoundary`、`personalHomeLocale` | 23/23、9/9、15/15、7/7、3/3、5/5 | 同 | |
| `developerApiGuide`、`developerApiBatch1` | 2/3、13/14 | 同 | 失败的都是「执行 curl / Python 示例」（本机环境） |
| `developerAnalysisWorker` | 1/3 | 同 | 本机分析服务不可用 |
| `forumI18n` | 4/6 | 同 | 改前即失败（切片 D 已记） |
| `developerApiGuideUi` | 0/1 | 0/1 | 需要 QA 包装与 `/usr/bin/chromium`。另用只改了浏览器与路径的副本在改前运行也是 0/1：测试给的外壳没有 `useForumResource` / `useAccountPageScope`（页面在 `f3c10b2` 之前已用它们），指南从未渲染 |
| `botScoreTokenSql`、`developerApiV1Sql`、`developerApiV1ManageabilitySql`、`accountSyncCanonicalSql` | 1/25、0/1、0/1、0/37 | 同 | 隔离测试库守卫拒绝（Linux 验收运行） |

### 改动的测试断言与测试工装（逐条）

1. `tests/fixtures/developerApiV1Ui.mjs`、`developerApiV1ManageabilityUi.mjs`（Linux 工装，不是断言）：给页面的 `useI18n` 补上读 `locales/zh.json` 的 `t`（文案搬进 locale，文字相同）；
   等待条件 `document.querySelector('main')` 改为 `'[data-grants-page]'`（嵌套 `<main>` 已去掉，同一个 `aria-busy`）。断言的按钮名称、区域名称、请求与数据库检查不变。
   **注意**：这两个工装原来就没有提供 `useAccountPageScope`（页面在 `f3c10b2` 之前已用），所以在 Linux 上改前就会失败；本切片没有补，交给负责人决定。
   本机用同样的编译与打包方式（含 locale 导入）加上该函数、合成接口跑过一遍「同意 → 撤销」：通过，请求体 `{bindingId, clientId, consent:true, consentVersion, audience}`。
2. `tests/reworkStage4.test.mjs` 新增 7 条（E2）；新增工装数据 `tests/fixtures/e2-copy-original.json`（改前七个页面的行内中日表，逐字）。已有断言未改。

### 验证

| 层级 | 内容 | 结果 |
| --- | --- | --- |
| 业务测试基线（真实） | 见上表，16 个文件改前改后逐文件运行 | 逐文件相同 |
| 静态 / 单元（真实） | `npm run test:ds`、`npm run check:ds`、`npm run test:version`、`reworkStage1`…`4` | 90/90；通过（tokens 2352、对比度 368/368、token 对照表已重新生成、collisions 0、scoped 0、ds usage 166 文件 0、ds copy 162 文件、小图标 46）；1/1；14/14、19/19、11/11、15/15 |
| 本机真实 SSR（`nuxt dev`，无数据库） | 中日：`/docs/score-token` 200、`rework-ep`、唯一 `<h1>`、两个代码块、四条错误、占位、返回链接都在服务端 HTML；六个登录页 302 到登录（`redirect` 为本页）；水合 0 警告、代码块 `overflow-x:auto` 且可聚焦；`/support` 未登录落到登录页 | 2/2 |
| 拦截数据的自检 | 同步 10 种概览状态 × 外壳按钮状态 / 点 / 读屏名称（含换绑定代次后清除）；同步请求：未选目标、请求中、成功、部分、失败、无结果、500 / 504 / 409 / 503、离开后迟到响应、目标上下文变化；token：生成一次性显示、复制、轮换、撤销确认（Esc 取消 / 确认）、失败、离开清空、不可用；迁移：空密钥、显示、回车、部分、历史、429；开发者：未申请表单校验与 multipart（5 选 4）、待审批、驳回、通过、失效、审批人、读取失败重试；审批：取消、通过备注与一次性 Token 提示（合成）、驳回必填、403 与 503 区分；授权：标签、撤销、同意 / 不同意、翻页焦点、注册、停用确认；工单：校验与聚焦、回车不提交、创建请求体与投递失败、对话、追加、已关闭、详情失败重试、列表失败与空；工单审批：选择、回复、回复并关闭、关闭、无权限、手机焦点 | 13/13 |
| 键盘（intercepted） | 同步页 Tab 到目标 → 空格勾选 → Tab 到开始 → 回车发请求 | 1/1 |
| 矩阵 | 文档（真实）+ 六个登录页（拦截，长文本、长 token、长邮箱）× 360/390/820/1440 × 浅/深 + 日文 390 浅、1440 深：`rework-ep`、主题、唯一 `<h1>`、无横向溢出、触控目标 ≥ 44 | 10/10 |
| EP 开关 | /about 无 → 同步页有，撤销确认框为映射色，离开后去掉、`<body>` 节点不多于基线 + 3，返回恢复 | 1/1 |
| 合计 | `account2-selfcheck.mjs` 最终一次（全部修改之后） | **25/25**，0 控制台错误、0 水合警告、0 Vue 警告；`portFreeAfter: true`、`browserStoppedAfter: true`；最长任务 63 ms（开发模式） |
| 回归（共享文件：Shell、Icon、`rework.css`、locale） | 改前（动手前，`f3c10b2`）：曲库 HTTP 57/57、SSR 失败通过、24/24；A 44/44 + SSR 失败；B 25/25；C 54/54；D 27/27；E1 25/25。改后（最终代码）：曲库 HTTP 57/57、SSR 失败通过、24/24；A 44/44 + SSR 失败；B 25/25；C 54/54；D 27/27；E1 25/25（与改前完全相同） | 端口与浏览器进程结束后都已释放 |
| 未验证 | 真实数据库与登录、真实同步与鼓众广场、真实邮件、生产 Nitro、Linux 浏览器、真机、读屏 | — |

运行：`node scripts/rework/account2-selfcheck.mjs --port=3576 --out=<目录> [--only=<场景前缀,…>]`。证据（不提交）：主检出 `.claude/stage-artifacts/slice-e2/`：`final/`（JSON、截图、`nuxt-dev.log`）、
`dev1/`（开发中的分段运行，含 `FAILED-*`）、`baseline-before/`、`baseline-after/`、`regression-before/`、`regression-after/`。

自检中发现并改掉的：概览状态标签与外壳按钮用了同名 `data-` 属性；工单审批台每次读详情后整页换成骨架（手机上选中后的焦点因此丢失）；两个 Element Plus 对话框交替时的选择器。

### Linux 隔离验收（尚未运行）

在 `shell-sql.mjs` 加 `--check=account2`，新建 `account2-check.mjs`：合成账号（`SELECT DATABASE()` 以 `_test` 结尾 + `TAIKO_ALLOW_TEST_DB_MUTATION=1`），生产 Nitro，`runAccount2Scenarios()`，
需要一个「不拦截 `/api/account/*`、`/api/support/*`」的开关（本切片没有写）。覆盖：

- 同步：隔离的鼓众广场桩与同步目标桩，成功 / 某目标失败 / 全部失败、冷却与服务端 429、`profile-changed`、未配置凭据 503、长耗时请求期间离开页面；目标进展（`?from=goal`）；
- token：生成 / 轮换 / 撤销与 bot 端同一 token、`/api/public-score/by-token` 用旧 token 401；迁移的密钥账号不一致 409、无有效记录 422、已存在 409；
- 开发者：申请（图片到隔离目录）、审批通过的邮件出口与 Token、驳回、授权的同意 / 撤销与第三方读取（`developerApiV1*` 工装，先补 `useAccountPageScope`）；
- 工单：创建与邮件出口失败、追加、站务回复 / 回复并关闭 / 关闭、未读标记；
- 需要在 Linux 上更新的浏览器脚本：`scripts/verify_training_loop_browser.mjs`（`.target-item .el-checkbox` 改为 `.target-item input`；按钮名「开始同步」、`.target-item`、`.goal-sync-result`、`.goal-return` 未变）；
  `tests/developerApiGuideUi.test.mjs` 的外壳补 `useForumResource` / `useAccountPageScope`（改前即缺）。

### 看到但没有改

- 同步页刷新概览时整页换成骨架（`useForumResource` 的 refresh 先清数据），每次同步 / 迁移 / token 操作后会闪一下；开发者审批台同样。没有改读取逻辑。
- 网页成绩 token 生成 / 轮换没有确认（轮换会让旧 token 立即失效）；关闭工单没有确认。
- 工单审批台把任何读取错误都当作「无权访问」（原样）；它用 `useAsyncData`，keepalive 返回不重读（原样）。
- 文档页成功响应示例里的样例值是中文（`北京市`、`太鼓达人`），日文页也显示（示例数据，未改）。
- 授权页的 Linux 工装与开发者指南 UI 测试缺页面已用的组合函数（见上），改前即失败。
