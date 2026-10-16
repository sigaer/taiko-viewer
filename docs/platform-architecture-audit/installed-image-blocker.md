# Installed Viewer image dependency closure — initial FAIL / bounded retry PASS

2026-10-16，0.82 R2；不代表生产操作。

`installedViewerImages.test.mjs` 首次真实 Viewer `charts.ts::getB30ImageBuffer` → `python -I` → wheel B30 渲染失败，`ModuleNotFoundError: runtime_memory`。1 test / 0 PASS / 1 FAIL；精度维度与六维 radar 尚未到达，**没有 PNG Golden PASS**。精确日志、hash、源码范围见 `evidence/installed-viewer-images-20261016.json`。

直接 import 位于 wheel 的 `taiko_bot/offline/memory.py` 及 `taiko_bot/runtime/player/center/b30_support/memory.py`；候选源码与已安装模块一致。Taiko `pyproject.toml` 没有安装此支持包。`docs/server-ownership-migration.md` 已明确：`runtime_memory` 是 Sakura 根维护的通用 1.1.0 artifact，Miku/maimaiDX/Taiko 均使用，不应复制成 Taiko 私有库。因此这是角色重建闭包漏记的共享支持构件，不是 Python cwd 修复或算法迁移。

Sakura 跟踪的包有 `__init__.py`、`cache.py`、`metrics.py`、`store.py`、`_build_sqlite.py`；依赖标准库。最近相关提交为 `1491c128ef2159370145b73325b33ca2691b788f`。未读取生产 `/opt` artifact，未向现有 venv 添加文件，也未启用 `.pth`、PYTHONPATH 或源码fallback。

最短正确修复范围：

1. 在独立共享owner工作树为已有 `runtime_memory` 添加可构建wheel的元数据，保持源码及缓存/预算行为不变；版本来源、许可证与包名需要明确。Taiko仅声明/记录支持包依赖，不复制算法或通用运行库。
2. 从固定源码revision构建非editable支持wheel，归档源码及wheel hash，并纳入center/client角色manifest、精确依赖锁和rebuild runner。旧93 distributions的安装证据不删除，但不再作为完整业务依赖闭包证明。
3. 新建角色环境安装完整集合，`pip check` + `python -I` 实际import来源验证。禁止修改当前已证明环境；新构件和旧环境分别留证。
4. 重跑真正Viewer图片callsite（B30、精度top、六维radar）及共享memory自身测试；之后继续验证其他图片消费者。三个新oracle只证明callsite与installed adapter一致，旧frozen算法Golden仍须单列。

测试错误输出已改为只保留exit、signal和末尾最多2048字节stderr（先切片再解码）；不传播execFile原始Error/cause/stdout/stderr Buffer对象，防止Node reporter打印二进制。该改动未重跑QA，不改变首次FAIL事实。

## 新94包center环境重试

共享owner固定源码构建了独立 `python-memory-runtime==1.1.0` 支持wheel，并安装到**全新**center94包环境。旧93包环境和首次FAIL原样保留。

`/var/tmp/viewer0822-images-with-memory.log`：1 PASS / 0 FAIL，实际完成B30、精度top、六维radar三个Viewer callsite；每项PNG与独立installed adapter完全相同，随后真实Sharp JPEG转换成功。精确PNG/JPEG hash、尺寸、解释器及role重建证据在 `evidence/installed-viewer-images-retry-20261016.json`。

本缺失依赖在新候选角色环境中已消除；只签收这三个合成callsite的安装与adapter一致性，不能升级为旧算法Golden、完整图片消费者、生产资源或生产发布PASS。runtime integration runner引用此独立证据，不重复20秒图片测试。
