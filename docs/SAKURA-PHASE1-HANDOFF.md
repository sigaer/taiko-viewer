# 第 1 阶段：OurTaiko 已部署，等待 Viewer 配合

致 Sakura Viewer 开发方。依据双方已确认的 [SAKURA-0.2-ACCOUNT-POLICY.md](SAKURA-0.2-ACCOUNT-POLICY.md)（下称「方案」），OurTaiko 一侧第 1 阶段已于 2026-11-05 部署到生产（SSO `bd7b6c1`，迁移 0010）。**自动建号开关目前关闭**，现有登录行为没有变化。本文说明已上线的内容、需要 Viewer 做的事，以及打开开关后的联调方法。

## 1. 已上线、现在就生效的内容

| 内容 | 对 Viewer 的影响 |
| --- | --- |
| `ExternalLink` 新增来源 `origin`：`partner_link`（Viewer 调 `external/link`）、`signup`（首次登录建号）、`user_link`（第 2 阶段） | 无。现有两条绑定都是 `partner_link` |
| `external/lookup` 支持可选参数 `withExternalId` | **不带参数时响应与之前逐字节相同**，Viewer 现有的严格校验不受影响 |
| 「使用 Sakura Viewer 登录」入口有了英日韩文案 | 无 |
| 「忘记密码」也给没有密码的账号发邮件 | 无。自动建出的账号可以借此设置密码 |

已关联账号经 Viewer 登录 OurTaiko 的流程（`5ca66ac`）不变。

## 2. 需要 Viewer 做的事

### 2.1 ID Token claims（必需，打开开关的前提）

OurTaiko 只从 **ID Token** 读取（Authlib 解析的是 ID Token，不另调 userinfo），请不要只放在 `/oidc/me`。

| claim | 类型 | 何时给出 |
| --- | --- | --- |
| `sub` | string | 不变：精确十进制 Viewer 账号 ID |
| `email` | string | scope 含 `email` 且用户在同意页同意 |
| `email_verified` | **boolean** | 同上；只有 Viewer 确认用户控制该邮箱时才是 `true`。字符串 `"true"` 会被视为未验证 |
| `name` 或 `preferred_username` | string | 可选，用于预填昵称；含换行、控制字符或超过 40 字时 OurTaiko 留空 |
| `ourtaiko_sub` | string | 只在 Viewer 本地已有该账号对 OurTaiko 的映射（**任何状态**，含 `pending`/`failed`）时给出 |

注意 `ourtaiko_sub`：**只要 claim 存在**（无论值是什么），OurTaiko 就不建号，只提示用户先用 OurTaiko 密码登录。所以没有映射时请完全省略这个 claim，不要给 `null` 或空字符串。

示例（没有映射、邮箱已验证）：

```json
{
  "iss": "https://viewer.sakura-bot.cn/oidc",
  "aud": "OurTaiko",
  "sub": "9007199254740993",
  "email": "player@example.com",
  "email_verified": true,
  "name": "Viewer 玩家",
  "nonce": "…", "iat": 0, "exp": 0
}
```

### 2.2 同意页（必需）

授权 `OurTaiko` 客户端时，同意页需要列出将提供给 OurTaiko 的内容：Viewer 账号 ID、已验证邮箱，以及已关联的 OurTaiko 账号（如有）。

### 2.3 lookup 客户端（第 2 阶段前完成即可）

方案 §3.4、§3.6 的正向自动建号与恢复需要它。请先让 lookup 客户端接受新字段，**再**开始发送参数：

```http
POST https://sso.ourtaiko.org/internal/v1/external/lookup
X-Service-ID: Sakura
X-Service-Key: <Sakura 的 client secret>
Content-Type: application/json

{"id": "<32 位小写十六进制 OurTaiko ID>", "withExternalId": true}
```

```json
{"code": "OK", "message": "", "data": {
  "id": "…", "nickname": "…", "email": "…", "emailVerified": true,
  "externalId": "9007199254740993"
}}
```

- `externalId`：该 OurTaiko 账号在 `Sakura` 应用下已关联的 Viewer ID；没有关联时为 `null`。
- `withExternalId` 只能是 `true`；写 `false` 或字符串会返回 400 `REQUEST_INVALID`，不带这个参数则按原样返回。
- 鉴权、限流、404／409 规则都不变（只能查刚授权、或已与 `Sakura` 关联的账号）。

## 3. 打开开关后的 OurTaiko 行为

Viewer 完成 2.1 和 2.2 后通知我们，OurTaiko 会在生产打开 `SAKURA_REVERSE_SIGNUP_ENABLED`。之后 `/login/sakura/callback/` 在找不到绑定时：

| 情况 | HTTP | 用户看到 |
| --- | --- | --- |
| 已有 `Sakura` 绑定 | 302 → `/` | 直接登录（现状） |
| 绑定的 OurTaiko 账号已停用 | 403 | 账号不可用，不另建账号 |
| ID Token 带 `ourtaiko_sub` | 409 | 「这个 Viewer 账号已经关联了一个 OurTaiko 账号。请先用 OurTaiko 登录名和密码登录，再完成关联。」 |
| `email_verified` 不是 `true`，或没有 `email` | 409 | 「你的 Viewer 邮箱还没有验证……」 |
| OurTaiko 已有同邮箱账号（不区分大小写） | 409 | 「这个邮箱已经有 OurTaiko 账号。请先登录原账号，再关联 Sakura Viewer。」 |
| 以上都不是 | 302 → `/login/sakura/signup/` | 「完成注册」页 |

「完成注册」页：
- 显示邮箱；用户填登录名（3–24 位字母或数字，唯一），昵称按 `name`／`preferred_username` 预填。
- 页面 10 分钟内有效，过期后需要重新用 Viewer 登录。
- 提交时会重新检查邮箱和绑定。期间若有人占用了这个邮箱或这个 Viewer ID，返回 409，不建号。
- 建成的账号：普通用户（非管理员）、邮箱已验证、没有密码，`ExternalLink(Sakura, origin=signup)`，并立即登录。
- **建号时 OurTaiko 不会通知 Viewer**。这时 Viewer 一侧还没有对应记录，按方案 §3.6 在用户下次从 OurTaiko 登录 Viewer 时补上。

## 4. 联调与验收（方案 §6）

请准备以下 Viewer 账号，并在打开开关后依次测试：

1. **新用户**：Viewer 邮箱已验证，这个邮箱从未注册过 OurTaiko，账号也没有任何关联。
   - 第一次：OurTaiko 登录页 →「使用 Sakura Viewer 登录」→ 授权 →「完成注册」→ 进入 OurTaiko。
   - 退出后再登录一次：直接回到同一个账号，不再出现「完成注册」。
2. **邮箱未验证**：不建号，看到验证提示。
3. **邮箱已被占用**：用一个已注册 OurTaiko 的邮箱，不建号、不登录那个账号。
4. **Viewer 一侧已有映射**：给 Viewer 本地造一条 `pending`／`failed` 映射，使 ID Token 带 `ourtaiko_sub`；不建号。
5. **已关联账号**：照常登录。

每完成一项，OurTaiko 会核对生产数据：账号数、`ExternalLink` 的行数和 `origin`、新账号不是管理员。联调用的账号事后由 OurTaiko 管理员清理。

## 5. 之后的阶段

- 第 2 阶段：OurTaiko 账号页主动关联 Viewer（方案 §3.3）和 §3.6 的登录后确认；Viewer 按 §3.4 做正向自动建号与恢复，届时需要用到 2.3。
- 第 3 阶段：双方的 `unlink` 和用户自助解绑。

如有疑问，请在 [OurTaiko/OurTaikoSSO#2](https://github.com/OurTaiko/OurTaikoSSO/issues/2) 回复。
