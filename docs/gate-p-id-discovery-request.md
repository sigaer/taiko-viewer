# P-ID-DISCOVERY：单项待批卡

`CAN_RUN_NOW=false`。当前未批准、未执行；Gate P 保持 `DEPLOY_PENDING_AUTH`。

目的：仅确认候选 `taiko-viewer.service` 是否存在及十项元数据。名称来自仓库模板（SHA-256 `9ec0bd95d11ac79e59946bd1a03bc92e91cd0e3b435c59e70b612753b96e3270`），尚未在线确认。

待批准的唯一操作（一次，总上限 10 秒）：

```sh
timeout --signal=TERM --kill-after=1s 9s systemctl show taiko-viewer.service --property=Id,LoadState,ActiveState,SubState,MainPID,User,Group,WorkingDirectory,FragmentPath,ControlGroup --no-pager
```

仅允许 `Id, LoadState, ActiveState, SubState, MainPID, User, Group, WorkingDirectory, FragmentPath, ControlGroup` 十字段；输出由获批操作者保存到 Owner 指定的私有存证目录，公开报告仅记录状态和证据身份。

| Owner 需填写 | 当前值 |
|---|---|
| 明确批准该单项范围／批准编号 | 未批准 |
| 操作者 | UNKNOWN |
| 有效期（含时区） | UNKNOWN |
| 私有存证目录 | UNKNOWN |

禁止 `list-units`、全量 show、Environment、ExecStart 详情、进程 cmdline/environ、业务文件、数据库、HTTP、任何修改。unit 不存在、名称不匹配、超时或超出字段范围即停止；不猜其他名称、不重试扩围。

此前 F1–F5 聊天批准不覆盖此发现请求。该项完成后，才可依据真实发现准备精确 P-ID-VERIFY／代理文件审批；SQL metadata、DDL、备份、发布、开关启用均另批。本卡也不授权执行后续事项。
