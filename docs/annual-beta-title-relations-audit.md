# 称号歌曲关联 canonical 审计

候选：`/var/tmp/annual-v45-unrelated-before-fix.json`，SHA-256 `34291f29689d8e8dd122bb6c3b5d72b172a545a0740132fb30923b8e43a02e1e`。

相对任务开始 Git HEAD：新增 71 条、删除 20 条、相同关系键内容改变 67 条（键为歌曲名、称号名、条件类型、难度）。不是仅排序或格式变化。源文件没有 title ID/song ID 字段，引用按名称，经 NFKC/空白/裏后缀归一映射本机 title catalog 与线上完整 song catalog 的实际 ID；未匹配名称不冒充有效 ID。

候选存在明确错误：将 `1プレイ中全曲でオプション…`、`公式の初音ミク曲`、`GUMI曲` 等非具体歌曲条件写入 song_name。按用户 2.4 规则保留 tracked HEAD，候选备份保留，不合入错误数据。当前 dirty 的 4cc9… 也不是任务开始的 tracked HEAD，不能继续作为特殊 canonical。

最终 canonical SHA：`52a02e6d9d6e2f10ae58fe4d701291ca3894af1c858ff97fb53e6edfe748cf47`。以后以 Git HEAD 为唯一依据；取消历史固定 SHA 和部署前 stash/restore 特殊要求。历史报告只作为当时证据保留，不构成新部署指令。部署脚本本身没有此特殊处理，无需修改。

## headAudit

重复关系 0；未匹配称号 0；未匹配歌曲 19（包含历史别名/已下架以及非歌曲条件，不声称全是 dangling numeric ID）。

称号：

歌曲：B.B.K.K.B.K.K、GO GET'EM、Mecha DESU、Nesin Amatias、R.I、UFO Swingin、YELL EX MAKINA!、”通关所有曲目吧、よく在る15300、よく在る2000、アイドルマスター的楽曲、カラ鞠的花、ココドコ？多分ドッカ島(裏)、初音ミク的消失‐劇場版‐(裏)、大空与太鼓的踊り、恋的処方箋、敬启，我在学校、風的国的龍与騎士、黄ダルマ2000

## candidateAudit

重复关系 0；未匹配称号 0；未匹配歌曲 24（包含历史别名/已下架以及非歌曲条件，不声称全是 dangling numeric ID）。

称号：

歌曲：1プレイ中全曲でオプション「あべこべ」、1プレイ中全曲でオプション「きまぐれ」、1プレイ中全曲でオプション「さんばい」、1プレイ中全曲でオプション「でたらめ」、1プレイ中全曲でオプション「ばいそく」、1プレイ中全曲でオプション「よんばい」、1プレイ中全曲でオプション「ドロン」、B.B.K.K.B.K.K、GO GET'EM、GUMI曲、IA曲、Mecha DESU、Nesin Amatias、R.I、UFO Swingin、YELL EX MAKINA!、”通关所有曲目吧、よくでる15300、アイドルマスターの楽曲、ココドコ？多分ドッカ島(裏)、公式の初音ミク曲、敬启，我在学校、東方Projectアレンジ楽曲、黄ダルマ2000

## 新增

| 歌曲 | 称号 | 类型 / 难度 | 匹配 song ID | 匹配 title ID |
|---|---|---|---|---|
| 1プレイ中全曲でオプション「あべこべ」 | あべこべドンだー | clear / unspecified | [] | [140] |
| 1プレイ中全曲でオプション「きまぐれ」 | きまぐれドンだー | clear / unspecified | [] | [142] |
| 1プレイ中全曲でオプション「さんばい」 | さんばいドンだー | clear / unspecified | [] | [138] |
| 1プレイ中全曲でオプション「でたらめ」 | でたらめドンだー | clear / unspecified | [] | [143] |
| 1プレイ中全曲でオプション「ばいそく」 | ばいそくドンだー | clear / unspecified | [] | [137] |
| 1プレイ中全曲でオプション「よんばい」 | よんばいドンだー | clear / unspecified | [] | [139] |
| 1プレイ中全曲でオプション「ドロン」 | ドロンドンだー | clear / unspecified | [] | [141] |
| Dimpy Dimper | でぃんぴーでぃんぱー！ | all_perfect / oni | [1446] | [1443, 1444, 1445] |
| Dimpy Dimper | でぃんぴーでぃんぱー！ | clear / oni | [1446] | [1443, 1444, 1445] |
| Dimpy Dimper | でぃんぴーでぃんぱー！ | full_combo / oni | [1446] | [1443, 1444, 1445] |
| EXRiXiS | EXRiXiS | all_perfect / inner_oni | [1391] | [1289, 1290, 1291, 1473, 1474, 1475] |
| EXRiXiS | EXRiXiS | clear / inner_oni | [1391] | [1289, 1290, 1291, 1473, 1474, 1475] |
| EXRiXiS | EXRiXiS | full_combo / inner_oni | [1391] | [1289, 1290, 1291, 1473, 1474, 1475] |
| EXRiXiS | EXRiXiS"T" | full_combo / inner_oni | [1391] | [1476] |
| Extreme End | Extreme End | all_perfect / inner_oni | [1370] | [1244, 1245, 1246, 1469, 1470, 1471] |
| Extreme End | Extreme End | clear / inner_oni | [1370] | [1244, 1245, 1246, 1469, 1470, 1471] |
| Extreme End | Extreme End | full_combo / inner_oni | [1370] | [1244, 1245, 1246, 1469, 1470, 1471] |
| Extreme End | 終焉の覇者 | full_combo / inner_oni | [1370] | [1472] |
| GUMI曲 | にんじん好き | clear / unspecified | [] | [251] |
| IA曲 | みつあみ好き | clear / unspecified | [] | [253] |
| Ka.Ma.Se | Beast on the beats | full_combo / inner_oni | [1393] | [1468] |
| Ka.Ma.Se | Ka.Ma.Se | all_perfect / inner_oni | [1393] | [1297, 1298, 1299, 1465, 1466, 1467] |
| Ka.Ma.Se | Ka.Ma.Se | clear / inner_oni | [1393] | [1297, 1298, 1299, 1465, 1466, 1467] |
| Ka.Ma.Se | Ka.Ma.Se | full_combo / inner_oni | [1393] | [1297, 1298, 1299, 1465, 1466, 1467] |
| Ka.Ma.Se(裏) | Ka.Ma.Se | all_perfect / oni_or_inner_oni | [1393] | [1297, 1298, 1299, 1465, 1466, 1467] |
| Ka.Ma.Se(裏) | Ka.Ma.Se | clear / oni_or_inner_oni | [1393] | [1297, 1298, 1299, 1465, 1466, 1467] |
| Ka.Ma.Se(裏) | Ka.Ma.Se | full_combo / oni_or_inner_oni | [1393] | [1297, 1298, 1299, 1465, 1466, 1467] |
| RAGING FIRE | RAGING FIRE | all_perfect / inner_oni | [1392] | [1293, 1294, 1295, 1477, 1478, 1479] |
| RAGING FIRE | RAGING FIRE | clear / inner_oni | [1392] | [1293, 1294, 1295, 1477, 1478, 1479] |
| RAGING FIRE | RAGING FIRE | full_combo / inner_oni | [1392] | [1293, 1294, 1295, 1477, 1478, 1479] |
| RAGING FIRE | ミ(＃ﾟДﾟ)ミRAGING!!彡(ﾟДﾟ＃)彡 | full_combo / inner_oni | [1392] | [1480] |
| RAGING FIRE(裏) | RAGING FIRE | clear / oni_or_inner_oni | [1392] | [1293, 1294, 1295, 1477, 1478, 1479] |
| RAGING FIRE(裏) | RAGING FIRE | full_combo / oni_or_inner_oni | [1392] | [1293, 1294, 1295, 1477, 1478, 1479] |
| SORA-VIII Nebula Trail | SORA-VIII ネビュラトレイル | all_perfect / oni | [1438] | [1423, 1424, 1425] |
| SORA-VIII Nebula Trail | SORA-VIII ネビュラトレイル | clear / oni | [1438] | [1423, 1424, 1425] |
| SORA-VIII Nebula Trail | SORA-VIII ネビュラトレイル | full_combo / oni | [1438] | [1423, 1424, 1425] |
| Tsunaga-rhythm | ツナガリズム | all_perfect / oni | [1457] | [1538, 1539, 1540] |
| Tsunaga-rhythm | ツナガリズム | clear / oni | [1457] | [1538, 1539, 1540] |
| Tsunaga-rhythm | ツナガリズム | full_combo / oni | [1457] | [1538, 1539, 1540] |
| World Keeps Turning | World Keeps Turning | all_perfect / oni | [1456] | [1535, 1536, 1537] |
| World Keeps Turning | World Keeps Turning | clear / oni | [1456] | [1535, 1536, 1537] |
| World Keeps Turning | World Keeps Turning | full_combo / oni | [1456] | [1535, 1536, 1537] |
| よくでる15300 | とても短い曲です(20秒) | full_combo / oni | [] | [1240] |
| よくでる2000 | 今日も定時で帰ります | full_combo / oni | [461] | [304] |
| アイドルマスターの楽曲 | プロデューサーさん | clear / unspecified | [] | [167] |
| カラ鞠の花 | カラ鞠のユカリ | full_combo / oni | [220] | [233] |
| 公式の初音ミク曲 | ねぎ好き | clear / unspecified | [] | [252] |
| 初音ミクの消失‐劇場版‐(裏) | 最高速の歌姫 | full_combo / inner_oni | [283] | [196] |
| 午马的二千锤百炼 【BPM150篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM150編】 | all_perfect / inner_oni | [1450] | [1446, 1447, 1448, 1449, 1450, 1451] |
| 午马的二千锤百炼 【BPM150篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM150編】 | all_perfect / oni | [1450] | [1446, 1447, 1448, 1449, 1450, 1451] |
| 午马的二千锤百炼 【BPM150篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM150編】 | clear / inner_oni | [1450] | [1446, 1447, 1448, 1449, 1450, 1451] |
| 午马的二千锤百炼 【BPM150篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM150編】 | clear / oni | [1450] | [1446, 1447, 1448, 1449, 1450, 1451] |
| 午马的二千锤百炼 【BPM150篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM150編】 | full_combo / inner_oni | [1450] | [1446, 1447, 1448, 1449, 1450, 1451] |
| 午马的二千锤百炼 【BPM150篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM150編】 | full_combo / oni | [1450] | [1446, 1447, 1448, 1449, 1450, 1451] |
| 午马的二千锤百炼 【BPM180篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM180編】 | all_perfect / inner_oni | [1451] | [1452, 1453, 1454, 1455, 1456, 1457] |
| 午马的二千锤百炼 【BPM180篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM180編】 | all_perfect / oni | [1451] | [1452, 1453, 1454, 1455, 1456, 1457] |
| 午马的二千锤百炼 【BPM180篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM180編】 | clear / inner_oni | [1451] | [1452, 1453, 1454, 1455, 1456, 1457] |
| 午马的二千锤百炼 【BPM180篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM180編】 | clear / oni | [1451] | [1452, 1453, 1454, 1455, 1456, 1457] |
| 午马的二千锤百炼 【BPM180篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM180編】 | full_combo / inner_oni | [1451] | [1452, 1453, 1454, 1455, 1456, 1457] |
| 午马的二千锤百炼 【BPM180篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM180編】 | full_combo / oni | [1451] | [1452, 1453, 1454, 1455, 1456, 1457] |
| 午马的二千锤百炼 【BPM240篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM240編】 | all_perfect / inner_oni | [1452] | [1458, 1459, 1460, 1461, 1462, 1463] |
| 午马的二千锤百炼 【BPM240篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM240編】 | all_perfect / oni | [1452] | [1458, 1459, 1460, 1461, 1462, 1463] |
| 午马的二千锤百炼 【BPM240篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM240編】 | clear / inner_oni | [1452] | [1458, 1459, 1460, 1461, 1462, 1463] |
| 午马的二千锤百炼 【BPM240篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM240編】 | clear / oni | [1452] | [1458, 1459, 1460, 1461, 1462, 1463] |
| 午马的二千锤百炼 【BPM240篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM240編】 | full_combo / inner_oni | [1452] | [1458, 1459, 1460, 1461, 1462, 1463] |
| 午马的二千锤百炼 【BPM240篇】 | UMAのﾌｫｰｽﾄﾚｰﾆ千ｸﾞ 【BPM240編】 | full_combo / oni | [1452] | [1458, 1459, 1460, 1461, 1462, 1463] |
| 午马的二千锤百炼 【BPM240篇】 | トレーニ千グの達人 | full_combo / inner_oni | [1452] | [1464] |
| 大空と太鼓の踊り | アイリッシュドンだー | full_combo / oni | [211] | [227] |
| 恋の処方箋 | 恋の病治療中 | clear / unspecified | [377] | [260] |
| 東方Projectアレンジ楽曲 | 普通の魔法使い | clear / unspecified | [] | [329] |
| 風の国の龍と騎士 | 風を翔る騎士 | clear / unspecified | [367] | [265] |

## 删除

| 歌曲 | 称号 | 类型 / 难度 | 匹配 song ID | 匹配 title ID |
|---|---|---|---|---|
| EXRiXiS(裏) | EXRiXiS | all_perfect / inner_oni | [1391] | [1289, 1290, 1291, 1473, 1474, 1475] |
| EXRiXiS(裏) | EXRiXiS | clear / inner_oni | [1391] | [1289, 1290, 1291, 1473, 1474, 1475] |
| EXRiXiS(裏) | EXRiXiS | full_combo / inner_oni | [1391] | [1289, 1290, 1291, 1473, 1474, 1475] |
| Extreme End(裏) | Extreme End | all_perfect / inner_oni | [1370] | [1244, 1245, 1246, 1469, 1470, 1471] |
| Extreme End(裏) | Extreme End | clear / inner_oni | [1370] | [1244, 1245, 1246, 1469, 1470, 1471] |
| Extreme End(裏) | Extreme End | full_combo / inner_oni | [1370] | [1244, 1245, 1246, 1469, 1470, 1471] |
| Ka.Ma.Se(裏) | Ka.Ma.Se | all_perfect / inner_oni | [1393] | [1297, 1298, 1299, 1465, 1466, 1467] |
| Ka.Ma.Se(裏) | Ka.Ma.Se | clear / inner_oni | [1393] | [1297, 1298, 1299, 1465, 1466, 1467] |
| Ka.Ma.Se(裏) | Ka.Ma.Se | full_combo / inner_oni | [1393] | [1297, 1298, 1299, 1465, 1466, 1467] |
| RAGING FIRE(裏) | RAGING FIRE | all_perfect / inner_oni | [1392] | [1293, 1294, 1295, 1477, 1478, 1479] |
| RAGING FIRE(裏) | RAGING FIRE | clear / inner_oni | [1392] | [1293, 1294, 1295, 1477, 1478, 1479] |
| RAGING FIRE(裏) | RAGING FIRE | full_combo / inner_oni | [1392] | [1293, 1294, 1295, 1477, 1478, 1479] |
| よく在る15300 | とても短い曲です(20秒) | full_combo / oni | [] | [1240] |
| よく在る2000 | 今日も定時で帰ります | full_combo / oni | [] | [304] |
| アイドルマスター的楽曲 | プロデューサーさん | clear / unspecified | [] | [167] |
| カラ鞠的花 | カラ鞠のユカリ | full_combo / oni | [] | [233] |
| 初音ミク的消失‐劇場版‐(裏) | 最高速の歌姫 | full_combo / inner_oni | [] | [196] |
| 大空与太鼓的踊り | アイリッシュドンだー | full_combo / oni | [] | [227] |
| 恋的処方箋 | 恋の病治療中 | clear / unspecified | [] | [260] |
| 風的国的龍与騎士 | 風を翔る騎士 | clear / unspecified | [] | [265] |

## 相同关系键内容改变

| 歌曲 / 称号 | 改变字段（旧 → 新） |
|---|---|
| 3piece-JazzParty! / ENDLESS PARTY TIME | condition_text: 3piece-JazzParty!通关 → 3piece-JazzParty!をクリア |
| Abyss of hell / 鈍行に乗るドン！ | condition_text: クロス・ブルー、女帝 ～インバラトゥーラ～、チャーリー ダッシュ！、Abyss of hell魔王难度在すべて全连 → クロス・ブルー、女帝 ～インバラトゥーラ～、チャーリー ダッシュ！、Abyss of hellを難易度おにですべてフルコンボ |
| Angel Halo / 天使の光輪 | condition_text: Angel Halo在魔王难度下全连 → Angel Haloを難易度おにでフルコンボ |
| Black Rose Apostle / 黒薔薇の使徒 | condition_text: Black Rose Apostle在魔王难度下全连 → Black Rose Apostleを難易度おにでフルコンボ |
| Blue Rose Ruin / 青薔薇の破滅 | condition_text: Blue Rose Ruin在魔王难度下全连 → Blue Rose Ruinを難易度おにでフルコンボ |
| Calculator / 電算ドンだー | condition_text: Calculator在魔王难度下全连 → Calculatorを難易度おにでフルコンボ |
| D's Adventure Note / ピアノ弾きの冒険者 | condition_text: D's Adventure Note在魔王难度下全连 → D's Adventure Noteを難易度おにでフルコンボ |
| DEBSTEP! / 重量級ステッパー | condition_text: DEBSTEP!在魔王难度下全连 → DEBSTEP!を難易度おにでフルコンボ |
| DIMENSIONS / 多次元干渉者 | condition_text: DIMENSIONS通关 → DIMENSIONSをクリア |
| EkiBEN2000 / ガマンならんのです！ | condition_text: EkiBEN2000在魔王难度下全连 → EkiBEN2000を難易度おにでフルコンボ |
| Eternal bond / 永遠の絆 | condition_text: Eternal bond在魔王难度下全连 → Eternal bondを難易度おにでフルコンボ |
| Hurtling Boys / 猪突猛進ボーイズ | condition_text: Hurtling Boys在魔王难度下全连 → Hurtling Boysを難易度おにでフルコンボ |
| Nesin Amatias / Nijustat on Amatias | condition_text: Nesin Amatias在魔王难度下全连 → Nesin Amatiasを難易度おにでフルコンボ |
| Purple Rose Fusion / 薔薇を統べし者 | condition_text: Purple Rose Fusion在魔王难度下全连 → Purple Rose Fusionを難易度おにでフルコンボ |
| RAGE v.self / リミットブレイカー | condition_text: RAGE v.self通关 → RAGE v.selfをクリア |
| Red Rose Evangel / 赤薔薇の福音 | condition_text: Red Rose Evangel在魔王难度下全连 → Red Rose Evangelを難易度おにでフルコンボ |
| Rotter Tarmination(裏) / なんじゃこりゃああ！ | condition_text: Rotter Tarmination(裏)全连 → Rotter Tarmination(裏)をフルコンボ |
| Wasabi Body Blow / わさびの達人 | condition_text: Wasabi Body Blow在魔王难度下全连 → Wasabi Body Blowを難易度おにでフルコンボ |
| White Rose Insanity / 白薔薇の狂気 | condition_text: White Rose Insanity在魔王难度下全连 → White Rose Insanityを難易度おにでフルコンボ |
| X-DAY2000 / The end of your love | condition_text: X-DAY2000在魔王难度下全连 → X-DAY2000を難易度おにでフルコンボ |
| Xa(裏) / 戦神 | condition_text: Xa(裏)オプション「あべこべ」在全连 → Xa(裏)をオプション「あべこべ」でフルコンボ |
| †††カオスタイム the DARK††† / ダークカオスタイム | condition_text: †††カオスタイム the DARK†††在魔王难度下全连 → †††カオスタイム the DARK†††を難易度おにでフルコンボ |
| 〆ドレー2000 / 〆ドレーの達人 | condition_text: 〆ドレー2000在魔王难度下全连 → 〆ドレー2000を難易度おにでフルコンボ |
| きたさいたま200 / きたさいたまのたちゅじん | condition_text: きたさいたま200在魔王难度下全连 → きたさいたま200を難易度おにでフルコンボ |
| きたさいたま2000 / きたさいたまの達人 | condition_text: きたさいたま2000在魔王难度下全连 → きたさいたま2000を難易度おにでフルコンボ |
| さいたま2000 / さいたまの達人 | condition_text: さいたま2000在魔王难度下全连 → さいたま2000を難易度おにでフルコンボ |
| さんぽ(裏) / さんぽの達人 | condition_text: さんぽ(裏)全连 → さんぽ(裏)をフルコンボ |
| そつおめしき / 卒業してもずっとトモダチ | condition_text: そつおめしき在魔王难度下全连 → そつおめしきを難易度おにでフルコンボ |
| てんぢく2000 / ちょっと休憩 | condition_text: てんぢく2000在魔王难度下全连 → てんぢく2000を難易度おにでフルコンボ |
| はたラク2000 / お仕事の達人 | condition_text: はたラク2000在魔王难度下全连 → はたラク2000を難易度おにでフルコンボ |
| はやさいたま2000 / はやさいたまの達人 | condition_text: はやさいたま2000在魔王难度下全连 → はやさいたま2000を難易度おにでフルコンボ |
| またさいたま2000 / またさいたまの達人 | condition_text: またさいたま2000在魔王难度下全连 → またさいたま2000を難易度おにでフルコンボ |
| やわらか戦車(裏) / 戦車の達人 | condition_text: やわらか戦車(裏)全连 → やわらか戦車(裏)をフルコンボ |
| クロス・ブルー / 鈍行に乗るドン！ | condition_text: クロス・ブルー、女帝 ～インバラトゥーラ～、チャーリー ダッシュ！、Abyss of hell魔王难度在すべて全连 → クロス・ブルー、女帝 ～インバラトゥーラ～、チャーリー ダッシュ！、Abyss of hellを難易度おにですべてフルコンボ |
| グレート！アニマルカイザー!! / 百獣王者どんちゃん | condition_text: グレート！アニマルカイザー!!全连 → グレート！アニマルカイザー!!をフルコンボ |
| ケチャドン2000 / 〆切の達人 | condition_text: ケチャドン2000在魔王难度下全连 → ケチャドン2000を難易度おにでフルコンボ |
| ケチャドン2000 / で、できましたぁ… | condition_text: ケチャドン2000全连 → ケチャドン2000をフルコンボ |
| ココドコ？多分ドッカ島(裏) / 心の底から「だだだ脱出！」 | condition_text: ココドコ？多分ドッカ島(裏)全连 → ココドコ？多分ドッカ島(裏)をフルコンボ |
| スーハー2000 / スーハーの達人 | condition_text: スーハー2000在魔王难度下全连 → スーハー2000を難易度おにでフルコンボ |
| タベルナ2000 / 食っちゃ寝の達人 | condition_text: タベルナ2000在魔王难度下全连 → タベルナ2000を難易度おにでフルコンボ |
| ダーク・エクス・マキナ♡ / ダーク・エクス・マキナ♡ | condition_text: ダーク・エクス・マキナ♡在魔王难度下全良 → ダーク・エクス・マキナ♡を難易度おにでドンダフルコンボ |
| ダーク・エクス・マキナ♡ / ダーク・エクス・マキナ♡ | condition_text: ダーク・エクス・マキナ♡在魔王难度下通关 → ダーク・エクス・マキナ♡を難易度おにでクリア |
| ダーク・エクス・マキナ♡ / ダーク・エクス・マキナ♡ | condition_text: ダーク・エクス・マキナ♡在魔王难度下全连 → ダーク・エクス・マキナ♡を難易度おにでフルコンボ |
| チャーリー ダッシュ！ / 鈍行に乗るドン！ | condition_text: クロス・ブルー、女帝 ～インバラトゥーラ～、チャーリー ダッシュ！、Abyss of hell魔王难度在すべて全连 → クロス・ブルー、女帝 ～インバラトゥーラ～、チャーリー ダッシュ！、Abyss of hellを難易度おにですべてフルコンボ |
| ツンデレCafeへようこそ☆ / ツンデレCafeの常連 | condition_text: ツンデレCafeへようこそ☆在魔王难度下全连 → ツンデレCafeへようこそ☆を難易度おにでフルコンボ |
| ドキドキ胸きゅん おまつりタイム / ドキがムネムネしちゃうの | condition_text: ドキドキ胸きゅん おまつりタイム通关 → ドキドキ胸きゅん おまつりタイムをクリア |
| ドンカマ2000 / ドンカマの達人 | condition_text: ドンカマ2000在魔王难度下全连 → ドンカマ2000を難易度おにでフルコンボ |
| ナイトメア・サバイバー(裏) / 悪夢からの生還者 | condition_text: ナイトメア・サバイバー(裏)全连 → ナイトメア・サバイバー(裏)をフルコンボ |
| ノるどん2000 / ラリルレランの達人 | condition_text: ノるどん2000在魔王难度下全连 → ノるどん2000を難易度おにでフルコンボ |
| 万戈イム－一ノ十 / 万戈イムの達人 | condition_text: 万戈イム－一ノ十在魔王难度下全连 → 万戈イム－一ノ十を難易度おにでフルコンボ |
| 万戈イム－一ノ十 / 常世人 | condition_text: 万戈イム－一ノ十全连 → 万戈イム－一ノ十をフルコンボ |
| 化物月夜 / 妖異幻怪 | condition_text: 化物月夜在魔王难度下全连 → 化物月夜を難易度おにでフルコンボ |
| 十露盤2000 / ご名答！ | condition_text: 十露盤2000在魔王难度下全连 → 十露盤2000を難易度おにでフルコンボ |
| 十露盤2000 / たつじんコース | condition_text: 十露盤2000全连 → 十露盤2000をフルコンボ |
| 和蘭撫子 / 漢の生き様 | condition_text: 和蘭撫子通关 → 和蘭撫子をクリア |
| 夜桜謝肉祭(裏) / 百カーニバル | condition_text: 夜桜謝肉祭(裏)全连 → 夜桜謝肉祭(裏)をフルコンボ |
| 夜櫻ブレヰダアズ / 参りますッ！ | condition_text: 夜櫻ブレヰダアズ在魔王难度下全连 → 夜櫻ブレヰダアズを難易度おにでフルコンボ |
| 天狗囃子 / 天狗の仕業 | condition_text: 天狗囃子在魔王难度下全连 → 天狗囃子を難易度おにでフルコンボ |
| 女帝 ～インバラトゥーラ～ / 鈍行に乗るドン！ | condition_text: クロス・ブルー、女帝 ～インバラトゥーラ～、チャーリー ダッシュ！、Abyss of hell魔王难度在すべて全连 → クロス・ブルー、女帝 ～インバラトゥーラ～、チャーリー ダッシュ！、Abyss of hellを難易度おにですべてフルコンボ |
| 幽玄ノ乱 / 幽玄を極めし者 | condition_text: 幽玄ノ乱在魔王难度下全连 → 幽玄ノ乱を難易度おにでフルコンボ |
| 彁 / 外ノ世界に顕れシ者 | condition_text: 彁在魔王难度下全连 → 彁を難易度おにでフルコンボ |
| 彁(裏) / たのしかったね | condition_text: 彁(裏)全连 → 彁(裏)をフルコンボ |
| 恋文2000 / 揺り篭から墓場まで | condition_text: 恋文2000在魔王难度下全连 → 恋文2000を難易度おにでフルコンボ |
| 愛想笑い / 仮面の下の真実 | condition_text: 愛想笑い在魔王难度下全连 → 愛想笑いを難易度おにでフルコンボ |
| 燎原ノ舞 / 燎原の覇王 | condition_text: 燎原ノ舞在魔王难度下全连 → 燎原ノ舞を難易度おにでフルコンボ |
| 花オト裏拍子 / 愛ヲ詠イシ花 | condition_text: 花オト裏拍子通关 → 花オト裏拍子をクリア |
| 黄ダルマ2000 / リンリンズのファン | condition_text: 黄ダルマ2000在魔王难度下全连 → 黄ダルマ2000を難易度おにでフルコンボ |
