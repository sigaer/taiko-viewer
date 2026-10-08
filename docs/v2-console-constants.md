# 家用机 V2 定数补全

补充数据为 `taiko_viewer/assets/data/v2_console_constants.json`。当前覆盖 143 首家用机歌曲、291 张困难/魔王/里魔王单人谱面。目录中共有 303 个目标难度条目，12 个条目未通过来源核验，详情保留在数据文件的 `issues` 中。歌曲目录、TJA 和 V1 数据均未修改。

## 计算与校准

使用 [OurTaiko/Constants](https://github.com/OurTaiko/Constants) 的计算代码和已发布的 13 项全量校准参数，未在家用机子集上重新归一化。参数文件 SHA-256、源代码 Git tree、每首谱面的相对路径和 SHA-256 都写入数据文件；源码各文件的 Git blob 身份固定在 `scripts/v2_console_sources.json`。

在线旧分析接口返回的结构缺少 `noteTypes`，长音符处理也与当前定数不符。因此生成器使用 [OurTaiko/TJAAnalyzer](https://github.com/OurTaiko/TJAAnalyzer) 的官方离线分析实现和 [OurTaiko/TJARenderer](https://github.com/OurTaiko/TJARenderer) 解析器，设置 `unit=ms`、`longNoteHandling=skip`。计算前检查音符类型与间隔对应关系，并显式执行算法，避免上游异常捕获产生静默零值。有效的低难度换算结果允许为零。

发布前强制复算 ID 1、495、1172 的困难和魔王谱面，音符数必须一致，各字段误差不超过 `1e-9`。本次六张参考谱面最大误差 `1.4210854715202004e-14`。

V2 玩家能力仍是体力、手速、爆发、精度、节奏、复合六项。谱面静态数据包含五项能力基础定数及 75%/主/99% 三项定数；精度需要成绩参与计算，本数据集不捏造静态精度字段，也不迁移现有玩家 Rating 计算。

## 合并与显示

有效上游 V2 值优先，补充数据只填当前目录中 `shelf_status=2` 的缺失难度。运行时再次核对音符数和星级；目录发生变化时旧补充值自动停用。单人谱面只选对应难度或 `_single`，分支优先 `master`，其次 `unbranched`。不得用 P1/P2 或其他难度代替。

补充值进入既有 V2 定数表和 CSV。家用机歌曲详情增加 V2 定数卡片，跟随试听难度切换；缺失难度显示空状态。原有 V1 数据如存在仍保留显示。上游暂时不可用时，本地补充值可继续使用。

## 未通过核验的条目

| 歌曲 ID | 难度 | 原因 |
| --- | --- | --- |
| 100000 | hard | 目录 260 音符，TJA 583 音符，且 TJA 未提供所需达人分支 |
| 100001 | edit | 目录 784 音符，TJA 788 音符 |
| 100003 | edit | 目录 186 音符对应双打 P1；单人 Edit 有 325 音符 |
| 100015 | hard | 674 / 675 音符不一致 |
| 100018 | hard | 202 / 201 音符不一致 |
| 100026 | hard | 239 / 240 音符不一致 |
| 100030 | hard | 297 / 298 音符不一致 |
| 100033 | edit | TJA 没有单人 Edit；Oni 单人 362 音符已补入 Oni |
| 100076 | hard | 232 / 240 音符不一致 |
| 100082 | hard | 230 / 231 音符不一致 |
| 100138 | hard | 目录音符数缺失 |
| 100139 | hard | 目录音符数为 0 |

这些条目需要修正目录或取得正确版本谱面后重新生成，不能仅因数值差距小就填入。

## 重现

在仓库根目录运行，使用磁盘上的工作目录。生成器会下载并核验固定源码，串行计算，不向在线数据库写入。

```bash
bash scripts/memory/run_qa.sh /usr/bin/python3 \
  "$PWD/taiko_viewer/scripts/generate_v2_console_constants.py" \
  --song-data /home/sigaer/taiko/songs/song_data.json \
  --tja-index /home/sigaer/taiko/data/viewer_cache/song-tja-index.json \
  --tja-root /home/sigaer/git/ESE_autosync \
  --work-dir /var/tmp/taiko-v2-console-generation \
  --node /www/server/nvm/versions/node/v24.13.0/bin/node
```

执行 `node --experimental-strip-types --test taiko_viewer/tests/v2ConsoleConstants.test.ts` 时同样使用 QA wrapper。生成后审查 `coverage`、`issues`、校准结果和定数变更，再走正常 Viewer 版本与发布流程。
