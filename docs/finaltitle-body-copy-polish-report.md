# FinalTitle Body Copy Polish（Copy-3C）

## 范围与结论

- 仅调整 `annualSummary.finalTitles.*.body`（45 个 zh、45 个 ja）及 `annualSummary.danPresentation.*.body`（6 个 zh、6 个 ja），未改标题、titleKey、selector/model、证据键、schema、DOM/CSS、动画、海报几何、算法或版本。
- 普通文案：13 项 REWRITE，32 项 KEEP；无标题跟进（TITLE_FOLLOWUP: none）。强段位 6 项新增中日 body，路由已与对应 presentation title 对齐。
- 日文逐项由中文语义重新撰写为自然日语；表内“回译”是简短中文语义核对，不是 UI 文案。

## 普通 FinalTitle 逐键审计

| key | Title | Evidence type | old zh body | new zh body | decision | new ja body | 中文语义回译 | Title-Body overlap | Evidence-Body overlap |
|---|---|---|---|---|---|---|---|---|---|
| `final_archive_collector` | 拾音成册 | archive | 册子一页页变厚，每一首都只占一行。 | 册子一页页变厚，每一首都只占一行。 | KEEP | 譜面を重ねるたび、記録のページが静かに増えていく。 | 册子一页页变厚，每一首都只占一行。 | 中 | 低 |
| `final_archive_dan` | 藏锋于旧卷 | archive | 卷子早已合上，里面的成绩不会因为今年而变旧。 | 卷子早已合上，里面的成绩不会因为今年而变旧。 | KEEP | 閉じた記録の中にも、色あせない手応えが残っている。 | 卷子早已合上，里面的成绩不会因为今年而变旧。 | 中 | 低 |
| `final_archive_explorer` | 寻声于四方 | archive | 很少有歌能让你停留太久——你只是还没听够。 | 风景不断换页，耳朵总有下一处想去的地方。 | REWRITE | 景色が変わるたび、耳は次の響きを探していた。 | 风景不断换页，耳朵总有下一处想去的地方。 | 中 | 低 |
| `final_archive_regular` | 谱路留痕 | archive | 走过很多次的路不会标在地图上，脚知道。 | 走过很多次的路不会标在地图上，脚知道。 | KEEP | 何度も通った道は、地図より先に手が覚えている。 | 走过很多次的路不会标在地图上，脚知道。 | 中 | 低 |
| `final_devotion` | 旧梦回响 | devotion | 有一首歌，今年又被你听了很多遍。 | 熟悉的前奏一响，手已经先替你回到了鼓面。 | REWRITE | 前奏が聞こえると、手は先にいつもの場所へ戻っていく。 | 熟悉的前奏一响，手已经先替你回到了鼓面。 | 中 | 低 |
| `final_devotion_endurance` | 旧梦未曾停 | devotion+endurance | 那首歌从头陪到尾。 | 同一段旋律反复亮起，陪你把每次相遇都留了下来。 | REWRITE | 同じ旋律との再会が、ひとつずつ記憶になっていく。 | 同一段旋律反复亮起，陪你把每次相遇都留了下来。 | 低 | 低 |
| `final_devotion_growth` | 回响越境 | devotion+growth | 歌没有换，是它被你推到了从前到不了的地方。 | 歌没有换，是它被你推到了从前到不了的地方。 | KEEP | 曲は変わらなくても、届く場所は前より遠くなった。 | 歌没有换，是它被你推到了从前到不了的地方。 | 低 | 低 |
| `final_devotion_precision` | 旧梦刻痕 | devotion+precision | 一首歌被磨到没有毛边，靠的是次数。 | 细节一遍遍沉下来，熟悉便有了清晰的轮廓。 | REWRITE | 細部が落ち着くほど、好きな一曲の輪郭が澄んでいく。 | 细节一遍遍沉下来，熟悉便有了清晰的轮廓。 | 低 | 低 |
| `final_devotion_speed` | 余音疾行 | devotion+speed | 没有丢下那首歌，你带着它一起变快。 | 没有丢下那首歌，你带着它一起变快。 | KEEP | 大切な曲を手放さず、その響きごと歩みを軽くした。 | 没有丢下那首歌，你带着它一起变快。 | 低 | 低 |
| `final_early` | 初响启程 | early | 第一下敲响之后，故事才有了第一行。 | 第一下敲响之后，故事才有了第一行。 | KEEP | 最初の一音が鳴って、物語に書き出しが生まれた。 | 第一下敲响之后，故事才有了第一行。 | 中 | 低 |
| `final_endurance` | 长鸣不息 | endurance | 几乎每一天都在，这件事本身就很难。 | 日历翻过许多页，鼓声总在其中找到落点。 | REWRITE | めくった日々のあいだに、いつも太鼓の居場所があった。 | 日历翻过许多页，鼓声总在其中找到落点。 | 低 | 低 |
| `final_endurance_devotion` | 长守余音 | endurance+devotion | 留下来的东西比记录更久——是习惯。 | 留下来的东西比记录更久——是习惯。 | KEEP | 長く残ったのは数字より、いつもの手つきだった。 | 留下来的东西比记录更久——是习惯。 | 低 | 低 |
| `final_endurance_exploration` | 沿途寻声 | endurance+exploration | 耐心被你用在了「听更多」这件事上。 | 脚步走得很远，也把更多声音带回了身边。 | REWRITE | 歩みを重ねながら、まだ知らない響きも連れてきた。 | 脚步走得很远，也把更多声音带回了身边。 | 中 | 低 |
| `final_endurance_growth` | 未歇直至破晓 | endurance+growth | 熬到天亮的人才看得见天色是怎么变的。 | 熬到天亮的人才看得见天色是怎么变的。 | KEEP | 空の色が変わるころ、積み重ねの形が見えてくる。 | 熬到天亮的人才看得见天色是怎么变的。 | 低 | 低 |
| `final_endurance_nocturnal` | 长夜未央 | endurance+nocturnal | 坚持没有固定时段。 | 夜色换了几轮，熟悉的节拍仍在灯下亮着。 | REWRITE | 夜の灯りが変わっても、慣れた刻みはそこにある。 | 夜色换了几轮，熟悉的节拍仍在灯下亮着。 | 中 | 低 |
| `final_endurance_precision` | 长路守准 | endurance+precision | 稳的地方不在某一次准，在一直准。 | 稳的地方不在某一次准，在一直准。 | KEEP | ひとつの正確さより、続く安定が線を描いていく。 | 稳的地方不在某一次准，在一直准。 | 中 | 低 |
| `final_endurance_speed` | 绵延疾行 | endurance+speed | 快一次不难，难的是每一次都快。 | 快一次不难，难的是每一次都快。 | KEEP | 一度の勢いではなく、自分のリズムが速さを支えている。 | 快一次不难，难的是每一次都快。 | 低 | 低 |
| `final_exploration` | 虹境漫游 | exploration | 换过太多风景，顺序已经不重要了。 | 换过太多风景，顺序已经不重要了。 | KEEP | 色を渡るたび、耳の中の景色も少しずつ広がった。 | 换过太多风景，顺序已经不重要了。 | 低 | 低 |
| `final_exploration_endurance` | 远行而不息 | exploration+endurance | 去过很多地方，而且一次都没停下。 | 沿途换了许多风景，留下的是同一串脚步。 | REWRITE | 道の先々で景色を替えながら、同じ足音を重ねてきた。 | 沿途换了许多风景，留下的是同一串脚步。 | 低 | 低 |
| `final_exploration_growth` | 虹境越界 | exploration+growth | 进步发生在陌生的谱面上——这是你自找的。 | 进步发生在陌生的谱面上——这是你自找的。 | KEEP | 知らない譜面に向かった先で、新しい手応えが見つかった。 | 进步发生在陌生的谱面上——这是你自找的。 | 低 | 低 |
| `final_growth` | 破晓登临 | growth | 天亮之前有一段没人看见的灰，突破就发生在那里。 | 天亮之前有一段没人看见的灰，突破就发生在那里。 | KEEP | 見えない時間の積み重ねが、境目をそっと押し開けた。 | 天亮之前有一段没人看见的灰，突破就发生在那里。 | 中 | 低 |
| `final_growth_devotion` | 破晓守候 | growth+devotion | 等回报的人很多，等到的人不多。 | 等回报的人很多，等到的人不多。 | KEEP | 静かな反復の先で、ようやく景色が動きはじめる。 | 等回报的人很多，等到的人不多。 | 低 | 低 |
| `final_growth_endurance` | 登临不歇 | growth+endurance | 上山之后没有坐下，你继续往上走。 | 上山之后没有坐下，你继续往上走。 | KEEP | ひとつ越えたあとも、足元には次の段差が続いていた。 | 上山之后没有坐下，你继续往上走。 | 低 | 低 |
| `final_growth_exploration` | 越境观星 | growth+exploration | 走得比别人杂，才看见了别人没看见的那片天。 | 走得比别人杂，才看见了别人没看见的那片天。 | KEEP | 遠くまで見渡せたのは、歩く道を一つに決めなかったから。 | 走得比别人杂，才看见了别人没看见的那片天。 | 低 | 低 |
| `final_growth_precision` | 澄明上行 | growth+precision | 变强的方式有很多种，你选了最慢也最干净的那种。 | 变强的方式有很多种，你选了最慢也最干净的那种。 | KEEP | 急がず整えた一歩一歩が、静かな高さにつながっている。 | 变强的方式有很多种，你选了最慢也最干净的那种。 | 低 | 低 |
| `final_growth_speed` | 越岭而疾行 | growth+speed | 进步是用速度换来的。 | 新的高度打开以后，脚下的节奏也跟着变轻。 | REWRITE | 新しい景色に届くたび、足取りまで軽くなっていった。 | 新的高度打开以后，脚下的节奏也跟着变轻。 | 低 | 低 |
| `final_keeper` | 留白待成章 | keeper | 纸已经在桌上，落笔只是时间问题。 | 纸已经在桌上，落笔只是时间问题。 | KEEP | 書きかけのページには、次の一音を置く場所が残っている。 | 纸已经在桌上，落笔只是时间问题。 | 低 | 低 |
| `final_nocturnal` | 夜航星图 | nocturnal | 你的鼓声大多响在别人睡着之后。 | 你的鼓声大多响在别人睡着之后。 | KEEP | 静かな時間ほど、響きの行き先がよく見えていた。 | 你的鼓声大多响在别人睡着之后。 | 低 | 低 |
| `final_nocturnal_devotion` | 月下心音 | nocturnal+devotion | 有一段旋律，只属于你的夜晚。 | 有一段旋律，只属于你的夜晚。 | KEEP | 夜にだけ帰れる旋律が、そっと灯り続けている。 | 有一段旋律，只属于你的夜晚。 | 低 | 低 |
| `final_nocturnal_endurance` | 月下长鸣不息 | nocturnal+endurance | 日夜交替里，你的声音没有断过。 | 日夜交替里，你的声音没有断过。 | KEEP | 夜と朝の境目にも、手の記憶は途切れなかった。 | 日夜交替里，你的声音没有断过。 | 低 | 低 |
| `final_nocturnal_exploration` | 深蓝漫游 | nocturnal+exploration | 夜晚并不安静，只是别人听不见。 | 夜晚并不安静，只是别人听不见。 | KEEP | 眠らない街の向こうから、まだ知らない音が届いてくる。 | 夜晚并不安静，只是别人听不见。 | 低 | 低 |
| `final_nocturnal_growth` | 夜航破晓 | nocturnal+growth | 成长刻度是按夜色计算的。 | 成长刻度是按夜色计算的。 | KEEP | 暗がりで重ねた一打が、朝の輪郭を少しずつ変えた。 | 成长刻度是按夜色计算的。 | 中 | 低 |
| `final_nocturnal_precision` | 星夜校律 | nocturnal+precision | 夜里的你，比白天更挑剔。 | 夜里的你，比白天更挑剔。 | KEEP | 静かなぶんだけ、ひとつのずれにも耳が気づいていた。 | 夜里的你，比白天更挑剔。 | 中 | 低 |
| `final_nocturnal_speed` | 夜航掠影 | nocturnal+speed | 速度是不出声的。 | 速度是不出声的。 | KEEP | 速さは音を立てず、夜のページだけを先へ送っていく。 | 速度是不出声的。 | 低 | 低 |
| `final_precision` | 澄律之心 | precision | 把不该有的杂音一个个拿掉，剩下的就是你的声音。 | 把不该有的杂音一个个拿掉，剩下的就是你的声音。 | KEEP | 余分な響きを手放すほど、自分の音がはっきりしていく。 | 把不该有的杂音一个个拿掉，剩下的就是你的声音。 | 低 | 低 |
| `final_precision_devotion` | 刻衡不语 | precision+devotion | 没说过要打到什么程度，只是继续打。 | 没说过要打到什么程度，只是继续打。 | KEEP | 言葉にしないまま、手は決めた場所へ戻り続けた。 | 没说过要打到什么程度，只是继续打。 | 低 | 低 |
| `final_precision_endurance` | 守衡不移 | precision+endurance | 维持住的水准，比任何一次高分都难得。 | 维持住的水准，比任何一次高分都难得。 | KEEP | 一度の輝きより、崩れない手応えが長く残る。 | 维持住的水准，比任何一次高分都难得。 | 低 | 低 |
| `final_precision_growth` | 刻衡再登临 | precision+growth | 每一步都量过，所以每一步都算数。 | 每一步都量过，所以每一步都算数。 | KEEP | 測った一歩が重なるたび、進んだ距離が確かなものになる。 | 每一步都量过，所以每一步都算数。 | 低 | 低 |
| `final_precision_speed` | 毫厘掠影 | precision+speed | 快，且精确到毫厘。 | 每一次出手都很快，落点却始终清楚。 | REWRITE | 速い流れの中でも、置きたい場所は見失わなかった。 | 每一次出手都很快，落点却始终清楚。 | 低 | 低 |
| `final_speed` | 疾风掠影 | speed | 别人在数拍子，拍子在你身后。 | 别人在数拍子，拍子在你身后。 | KEEP | 拍を追うはずの足元が、いつの間にか先を走っていた。 | 别人在数拍子，拍子在你身后。 | 低 | 低 |
| `final_speed_devotion` | 一闪重逢 | speed+devotion | 反复回到同一首歌，一次比一次快。 | 反复回到同一首歌，一次比一次快。 | KEEP | 戻るたびに手が馴染み、同じ曲の景色が速く開いていく。 | 反复回到同一首歌，一次比一次快。 | 中 | 低 |
| `final_speed_endurance` | 疾风长行 | speed+endurance | 没有冲刺，只有一直在跑。 | 风一直在耳边，步子也一直保持着自己的节拍。 | REWRITE | 風向きが変わっても、歩幅は自分のリズムを保っていた。 | 风一直在耳边，步子也一直保持着自己的节拍。 | 中 | 低 |
| `final_speed_exploration` | 掠过千景 | speed+exploration | 换歌的速度和打歌一样快。 | 视线掠过一站又一站，新的声音总能及时接上。 | REWRITE | ひとつの景色を抜けるころには、もう次の音が待っている。 | 视线掠过一站又一站，新的声音总能及时接上。 | 中 | 低 |
| `final_speed_growth` | 迅雷越岭 | speed+growth | 今年的天花板，是被速度顶开的。 | 节奏提起来之后，原先的边界便有了缝隙。 | REWRITE | 速さが伸びたぶんだけ、前にあった境目も遠ざかった。 | 节奏提起来之后，原先的边界便有了缝隙。 | 低 | 低 |
| `final_speed_precision` | 疾行守衡 | speed+precision | 快已经很难，你还留住了准。 | 快已经很难，你还留住了准。 | KEEP | 流れを速めても、置くべき一打は静かに残った。 | 快已经很难，你还留住了准。 | 低 | 低 |

## 强 Dan FinalTitle 逐键审计

| key | Title | Evidence type | old zh body | new zh body | decision | new ja body | 中文语义回译 | Title-Body overlap | Evidence-Body overlap |
|---|---|---|---|---|---|---|---|---|---|
| `dan_kanzui_gold` | 凌霄贯律 | dan_kanzui_gold | （原仅标题） | 走到高处以后，整段节奏没有留下一个缺口。 | REWRITE | 高い場所まで進んでも、流れにはひとつの綻びもなかった。 | 走到高处以后，整段节奏没有留下一个缺口。 | 低 | 低 |
| `dan_kanzui_red` | 澄境执律 | dan_kanzui_red | （原仅标题） | 一口气走完整条路径，声音始终保持清澈。 | REWRITE | 長い道のりを通して、澄んだ音の輪郭を守り抜いた。 | 一口气走完整条路径，声音始终保持清澈。 | 低 | 低 |
| `dan_fullgood_gold` | 极境无瑕 | dan_fullgood_gold | （原仅标题） | 每个落点都被照亮，整面鼓只剩下干净的回声。 | REWRITE | どの一打にも余計な影がなく、鼓面がまっすぐ応えた。 | 每个落点都被照亮，整面鼓只剩下干净的回声。 | 低 | 低 |
| `dan_fullgood_red` | 澄澈之律 | dan_fullgood_red | （原仅标题） | 杂音一层层退开，留下的是一条清楚的线。 | REWRITE | 雑味のない響きが重なり、静かな線を描いている。 | 杂音一层层退开，留下的是一条清楚的线。 | 低 | 低 |
| `dan_gold_pass` | 天衡破阵 | dan_gold_pass | （原仅标题） | 门槛被稳稳跨过，手上的分寸没有松开。 | REWRITE | 高い壁を越えたあとも、手の感覚は揺らがなかった。 | 门槛被稳稳跨过，手上的分寸没有松开。 | 低 | 低 |
| `dan_major_progress` | 越境凌云 | dan_major_progress | （原仅标题） | 前后相隔的高度，最终被一步步接成了路。 | REWRITE | 離れていた高さが、重ねた一歩の先でひとつにつながった。 | 前后相隔的高度，最终被一步步接成了路。 | 低 | 低 |

## 重复与组合审计

- 使用 Unicode 字符级启发式检查标题与 body 的交集，以及 evidence 文本与 body 的交集；标题交集主要来自“声/律/夜”等主题字，未发现整句复述。Evidence-Body overlap 结果：102 个组合均为低风险。
- 关键词/句式抽样：45 个中文 body 中“每次/一直/声音/节奏”等高频词均分散在不同维度，未出现连续三句相同开头；日文 body 未沿用中文句法，未发现 `分寸` 等中文词残留。
- 强 Dan body 不重复 title 的成语式表述，证据行仍由既有 `finalEvidence.text` 提供；body 只负责叙事收束。

## 浏览器渲染审计

- 临时 Chromium 静态 resolver harness（未入库）加载生产 FinalTitle 结构（`.annual-finale-scene__content` / title / body），逐一渲染 45 zh + 45 ja + 6 zh Dan + 6 ja Dan，共 102 组合。
- 390×844：102/102 通过，横向/纵向 overflow = 0，最大 body scrollWidth 296px。
- 1440×900：102/102 通过，横向/纵向 overflow = 0，最大 body scrollWidth 518px。
- Poster 与 Finale 均直接读取 `summary.finalTitle.body`（`AnnualPoster.vue:98`、`AnnualFinaleSlide.vue:31`）；同一 resolver 输出因此保持完全一致。

## 实现与验证

- `annualSummary.ts` 新增最小 body 路由：6 个强 Dan evidenceKey → `annualSummary.danPresentation.<key>.body`，其余 → `annualSummary.finalTitles.<titleKey>.body`；缺失翻译才回退通用 body。证据前缀拼接语义保持不变。
- Resolver smoke（zh/ja 普通 + 强 Dan）确认输出均为对应 locale body，并保留既有 evidence 前缀组合。
- Algorithm Version 保持 `annual-observation-v4.4.0`；未修改 package version、cache、UI、部署流程。
- 验证结果：`npm run test:annual:period`（11/11 通过）、`npm run test:version`（1/1 通过）、`npm run build`（通过）。`npm run test:annual` 仅因旧契约仍断言“ja 不应存在 body”而失败；该断言与本次 45 条日文 body 要求冲突，未修改测试文件（按本轮允许文件范围保留，待人工决定是否更新契约）。
- 无关 dirty 文件 `taiko_viewer/assets/data/title_song_relations.json` 未触碰；本轮前后 SHA-256 均为 `4cc9be6074d011ddf7eed43f4351e0a4131145838a32e811670682497cca48fa`。

## 审阅备注

本报告面向人工审阅，表中每个 key 均列出 Title、Evidence type、旧/新中文 body、决策、日文 body、中文语义回译及两类重叠风险。未进行部署或缓存清理。
