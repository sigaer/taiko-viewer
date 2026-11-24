# Dependency Compatibility Matrix

只对本地RC组合给出证据，不把生产/源码/强制安装/解析器依赖声明混为同一个PASS。

| 组合 / 层 | 版本/要求 | 结果与证据 |
|---|---|---|
| 原Center生产组合 | Bot0.26.3、Application0.9.2、Core0.1.1 | 保持原状；前批已确认无法满足新availability契约，不作为修复后制品PASS |
| 新Core + 原Application/宿主 | App<=0.1.2，offline运行时必须0.1.1 | 实际拒绝；首次新venv测试collection失败，记录于初次installed-python日志 |
| Core RC独立安装 | Core0.1.3rc1 + Contract0.1.0 | PASS：真实wheel安装、所有Core源码hash一致、无overlay |
| Application RC | 0.9.3rc1，Core>=0.1.1,<=0.1.3rc1 | PASS：pip check、实际安装public projection、七维度契约；此上限只用于批准前候选 |
| Bot基础依赖 | 0.26.4rc1 + App0.9.3rc1 | PASS：完整基础依赖安装后的pip check；不是启动真实Bot或在线adapter |
| Bot Center extra | Core[hiroba]==0.1.3rc1 + groupmate0.1.0 + routing0.1.4 +PyMySQL | PASS：真实pip `--dry-run --no-index --find-links release-candidate taiko-bot[center]==0.26.4rc1`，exit0；依赖已实际安装；未启动生产Bot |
| Center计算/Offline | 新Center精确Core版本检查、真实installed Bot/Application | PASS：12方法 +76回归/4原skip；-I导入路径为新venv |
| Client声明依赖 | client extra精确Core0.1.2；新Center包是0.1.3rc1 | BLOCKED：无法把同一个Center RC满足Client pin；受控RC wheel集合下resolver exit1。未宣称Client 0.1.2本身不能安装 |
| Client计算接口 | `recommend_songs(...identity_namespace='pair')` / ClientSongStats等0.1.2扩展 | FAIL：27桥接中Client9项TypeError，18项Offline/Center通过。不能删除参数或改用title namespace绕过 |
| Viewer | Node24.22.1；候选1.19.9-rc.1 | PASS：Node310、真实候选build；认证HTTP/生产DB集成不在此次写入范围 |
| 所有消费者统一发行 | Center与Client仍分别有策略/接口边界 | RELEASE BLOCKED：需要单独审阅的统一Core profile兼容设计或明确Client配套修复制品；不得把Center维护wheel直接发给Client |

桥接测试使用实际TS resolver、真实installed Core/Application和三个宿主函数的合成provider，逐项结果在`bridge-cases.json`。它证明函数边界兼容，不等于完整Bot进程、生产HTTP或真实SQL写入。

构建清单、`center-resolver.txt`、`client-resolver.txt`、实际freeze及SHA256SUMS保存在最终RC目录。第三方版本不是只写宽松requirements：最终freeze记录实际解析安装版本。早期开发venv曾安装Pillow13，发现Center插件pil-utils0.2.2要求<12后以既有11.3.0 wheel对齐；最终依赖验证和Python回归重新执行。

后续单一Core实现优先采用显式Center/Client profile及共同模型接口，在独立版本中证明两侧既有数值/身份规则。不能采用长期双读/双配置掩盖不兼容；若审批临时分线发行，必须限定收敛任务、版本和退出gate。
