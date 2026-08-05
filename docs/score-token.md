# 网页成绩 token 使用与接入文档

线上文档：`https://viewer.sakura-bot.cn/docs/score-token`

## 用户使用

1. 登录 Viewer，进入“个人账户 > 多端同步”。
2. 确认页面顶部显示的是需要授权的当前绑定 ID。
3. 在“网页成绩 token”区域点击“生成 token”。
4. 立即保存本次唯一展示的 48 位 token，并填写到需要读取成绩的应用。

也可以私聊 Sakura bot 发送 `网页成绩token` 生成。Viewer 与 bot 管理同一份 token；任意一端重新生成后，旧 token 都会立即失效。

token 等同于成绩读取密码。不要发送到群聊，不要放进截图、URL、前端源码或公开仓库。怀疑泄露时，应在 Viewer 中轮换或撤销。

## 开发者接入

- Method: `POST`
- URL: `https://sakura-bot.cn/api/public-score/by-token`
- Content-Type: `application/json`
- CORS: 支持

```bash
curl -X POST "https://sakura-bot.cn/api/public-score/by-token" \
  -H "Content-Type: application/json" \
  -d '{"token":"用户的48位token"}'
```

成功响应：

```json
{
  "ok": true,
  "taikoId": "2258735",
  "fetchedAt": "2026-08-05T12:30:20Z",
  "data": {
    "profile": {
      "mydon_name": "SakuraDon",
      "userid": "2258735",
      "is_disp_dan_on": true,
      "province": "北京市",
      "gameCostume": {
        "title": "太鼓达人",
        "got_dan_max": 6,
        "dan_name": { "grade": "06", "level": 1 }
      }
    },
    "songs": [
      {
        "song_no": 187,
        "level": 4,
        "high_score": 1000000,
        "best_score_rank": 7,
        "good_cnt": 160,
        "ok_cnt": 0,
        "ng_cnt": 0,
        "combo_cnt": 160,
        "clear_cnt": 1,
        "full_combo_cnt": 1,
        "dondaful_combo_cnt": 1,
        "highscore_datetime": "2026-08-05 20:30:20"
      }
    ],
    "achievement": {
      "count_level": 5,
      "ary_crown_count": [250, 3, 0],
      "ary_score_rank_count": [19, 56, 136, 142, 29, 1, 0]
    }
  }
}
```

示例仅展示一条曲目记录；实际响应中的 `songs` 是该用户的完整成绩数组。

常见状态码：

- `400`：请求体或 token 字段不合法
- `401`：token 无效、已轮换或已撤销
- `404`：绑定 ID 或本地成绩不存在
- `502`：上游成绩拉取失败

接口返回前会尝试拉取最新成绩。接入方应避免高频轮询，并设置短时间缓存。有后端时建议由服务端代调用，同时确保 token 不进入日志、埋点或错误上报。
