# Gameplay Fundamentals

`OFFICIAL` 太鼓是随音乐击打鼓面的节奏游戏，街机基本操作与音符说明以[官方玩法页](https://taiko.namco-ch.net/taiko/en/howto/)为准。不同平台控制器与游戏模式需要分别标注，不能用模拟器实现推导所有街机的判定窗。

`PROJECT` 目录 COURSE 1/2/3/4/5 映射 easy/normal/hard/oni/ura。鬼与里是不同chart身份，歌有鬼不代表有里；difficulty的星级与Rating常数是不同字段。公开目录、历史成绩、国行可玩、原谱存在、解析能力分别保存。

`PROJECT` 目前候选TJA数字表示：1/2是小红/小蓝，3/4是大红/大蓝，5/6是小/大连打，7/9是气球/特殊长音符，8是长音符终点，0是空槽。这个表是本项目parser编码，不声称所有TJA方言都只使用这些字符。普通note count采用1–4；roll hit次数、气球要求次数另计，不能把长音符终点计入普通combo。

`OFFICIAL` [官方首页](https://taiko.namco-ch.net/taiko/en/index.php)提示曲目和开放时点可能因地区或店铺而异。`PROJECT` 国行资格最终由Catalog Authority按来源/region/platform/release/asOf提供；OurTaiko有曲、ESE有谱或历史成绩有歌均不足以证明CN当前可玩。

`HYPOTHESIS` 同星级曲目在短爆发、持续密度、读谱、节奏变化等方面可能对某位玩家难度不同。需要分段标注与同一玩家的重复观察来证明，不能只由总音符数或标题推断。
