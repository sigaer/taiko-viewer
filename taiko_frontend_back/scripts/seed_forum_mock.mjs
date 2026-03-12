import { scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const workspaceRoot = resolve(repoRoot, "..");
const songDataPath = process.env.TAIKO_SONG_DATA_PATH || resolve(workspaceRoot, "songs", "song_data.json");
const coverBaseUrl = (process.env.TAIKO_FORUM_MOCK_COVER_BASE_URL || "https://static.sakura-bot.cn/cover").replace(/\/$/, "");
const forumBaseUrl = (process.env.TAIKO_FORUM_BASE_URL || "https://forum.sakura-bot.cn").replace(/\/$/, "");
const dbConfig = {
  host: process.env.TAIKO_DB_HOST || "127.0.0.1",
  port: Number(process.env.TAIKO_DB_PORT || 3306),
  user: process.env.TAIKO_DB_USER || "root",
  password: process.env.TAIKO_DB_PASSWORD || "wtf025366",
  database: process.env.TAIKO_DB_NAME || "taiko",
  charset: "utf8mb4"
};

const MOCK_PASSWORD = process.env.TAIKO_FORUM_MOCK_PASSWORD || "Sakura-Taiko-Mock-2026-Seed-Only";
const PASSWORD_SALT = "taiko-forum-mock-v1";
const PASSWORD_HASH = `${PASSWORD_SALT}:${scryptSync(MOCK_PASSWORD, PASSWORD_SALT, 64).toString("hex")}`;

const cover = (songId) => `${coverBaseUrl}/${songId}.png`;
const avatar = (songId) => cover(songId);
const pngFallbackAvatar = `${forumBaseUrl}/miku.png`;

const textBlock = (...texts) => texts.map((text) => ({ type: "paragraph", text }));
const imageBlock = (songId, caption) => ({
  type: "image",
  imageUrl: cover(songId),
  alt: caption,
  caption
});

const post = (author, body, createdAt, likes = [], replies = [], key = "") => ({
  author,
  body,
  createdAt,
  likes,
  replies,
  key
});

const reply = (author, body, createdAt, likes = [], key = "") => ({
  author,
  body,
  createdAt,
  likes,
  key
});

const USERS = [
  {
    key: "matsuri_admin",
    username: "matsuri_admin",
    email: "matsuri_admin_mock@sakura-bot.cn",
    role: "admin",
    signature: "祭典开始前先把规则贴好。",
    reputation: 520,
    taikoId: "1002003001",
    verifiedTitle: "祭典站务",
    verifiedTitleplateId: 101,
    avatarUrl: avatar(1419)
  },
  {
    key: "forum_demo",
    username: "forum_demo",
    email: "forum_demo_mock@sakura-bot.cn",
    role: "user",
    signature: "先报到，再慢慢练成十段。",
    reputation: 148,
    taikoId: "1002003002",
    verifiedTitle: "全良见习",
    verifiedTitleplateId: 102,
    avatarUrl: avatar(1156)
  },
  {
    key: "don_chan_cn",
    username: "don_chan_cn",
    email: "don_chan_cn_mock@sakura-bot.cn",
    role: "user",
    signature: "目标是把喜欢的歌都点成金冠。",
    reputation: 236,
    taikoId: "1002003003",
    verifiedTitle: "金冠收集者",
    verifiedTitleplateId: 103,
    avatarUrl: avatar(302)
  },
  {
    key: "rhythm_lab",
    username: "rhythm_lab",
    email: "rhythm_lab_mock@sakura-bot.cn",
    role: "user",
    signature: "谱面拆解和手序实验进行中。",
    reputation: 310,
    taikoId: "1002003004",
    verifiedTitle: "谱面拆解师",
    verifiedTitleplateId: 104,
    avatarUrl: avatar(1094)
  },
  {
    key: "dojo_runner",
    username: "dojo_runner",
    email: "dojo_runner_mock@sakura-bot.cn",
    role: "user",
    signature: "今天也在和段位体力线拔河。",
    reputation: 267,
    taikoId: "1002003005",
    verifiedTitle: "段位修行中",
    verifiedTitleplateId: 105,
    avatarUrl: avatar(1421)
  },
  {
    key: "arcade_map",
    username: "arcade_map",
    email: "arcade_map_mock@sakura-bot.cn",
    role: "moderator",
    signature: "机厅踩点、鼓况记录和同城集合。",
    reputation: 331,
    taikoId: "1002003006",
    verifiedTitle: "机厅雷达",
    verifiedTitleplateId: 106,
    avatarUrl: avatar(127)
  },
  {
    key: "fanart_kana",
    username: "fanart_kana",
    email: "fanart_kana_mock@sakura-bot.cn",
    role: "user",
    signature: "二创可以慢慢画，但一定要有鼓点。",
    reputation: 189,
    taikoId: "1002003007",
    verifiedTitle: "应援绘师",
    verifiedTitleplateId: 107,
    avatarUrl: avatar(1420)
  },
  {
    key: "fullcombo_aki",
    username: "fullcombo_aki",
    email: "fullcombo_aki_mock@sakura-bot.cn",
    role: "user",
    signature: "先稳住可见，再冲全良线。",
    reputation: 358,
    taikoId: "1002003008",
    verifiedTitle: "全良追猎者",
    verifiedTitleplateId: 108,
    avatarUrl: avatar(1419)
  },
  {
    key: "score_doctor",
    username: "score_doctor",
    email: "score_doctor_mock@sakura-bot.cn",
    role: "user",
    signature: "先做诊断，再谈冲分。",
    reputation: 412,
    taikoId: "1002003009",
    verifiedTitle: "谱面门诊",
    verifiedTitleplateId: 109,
    avatarUrl: avatar(1421)
  },
  {
    key: "city_captain",
    username: "city_captain",
    email: "city_captain_mock@sakura-bot.cn",
    role: "moderator",
    signature: "活动排期、机厅整备和版务协同。",
    reputation: 405,
    taikoId: "1002003010",
    verifiedTitle: "活动整备员",
    verifiedTitleplateId: 110,
    avatarUrl: avatar(1094)
  }
];

const THREADS = [
  {
    key: "official_launch",
    sectionSlug: "official",
    author: "matsuri_admin",
    threadType: "official",
    title: "论坛正式开张：鼓众广场国服交流区启用",
    summary: "论坛社区已经开放，欢迎围绕国服、鼓众广场、机厅与谱面攻略进行交流。",
    tags: ["开站", "公告", "鼓众广场"],
    coverImageUrl: cover(1419),
    viewCount: 1680,
    isPinned: true,
    isFeatured: true,
    isLocked: false,
    createdAt: "2026-03-12 08:30:00",
    contentBlocks: [
      ...textBlock(
        "欢迎来到太鼓论坛。现在论坛首页、版块页、帖子详情页和移动端入口都已经打通，后续会逐步补齐活动整理、机厅索引和更多便民工具。",
        "首批开放的版块包括官方公告、活动赛事、新手问答、谱面攻略、段位道场、晒分战报、同城机厅和二创杂谈。发帖时请尽量选择正确分类，方便大家检索。"
      ),
      imageBlock(1419, "论坛开张主视觉占位图"),
      ...textBlock("如果你发现页面展示、鼓众广场绑定或帖子分类还有问题，可以直接在新手问答区反馈。")
    ],
    likes: ["forum_demo", "don_chan_cn", "arcade_map", "fanart_kana", "fullcombo_aki"],
    posts: [
      post(
        "forum_demo",
        "终于有独立论坛了，先来报到。希望后面能补一个机厅约鼓合集入口。",
        "2026-03-12 08:52:00",
        ["don_chan_cn", "arcade_map"],
        [
          reply(
            "matsuri_admin",
            "已经在排下一轮迭代，机厅信息会先用帖子整理，后面再考虑做结构化索引。",
            "2026-03-12 09:05:00",
            ["forum_demo"],
            "launch_reply_admin"
          )
        ],
        "launch_floor_forum_demo"
      ),
      post(
        "fanart_kana",
        "首页的鼓面配色和按钮手感很有祭典味道，二创区已经准备发图了。",
        "2026-03-12 09:11:00",
        ["fullcombo_aki"],
        [],
        "launch_floor_fanart"
      )
    ]
  },
  {
    key: "forum_rules",
    sectionSlug: "official",
    author: "matsuri_admin",
    threadType: "official",
    title: "版规与发帖格式说明（发帖前必读）",
    summary: "统一整理论坛发帖规范、版务处理标准和攻略帖推荐格式，避免重复提问与灌水。",
    tags: ["站务", "版规", "必读"],
    coverImageUrl: cover(127),
    viewCount: 1160,
    isPinned: true,
    isFeatured: false,
    isLocked: true,
    createdAt: "2026-03-12 08:00:00",
    contentBlocks: [
      ...textBlock(
        "攻略帖请尽量写清楚谱面、难点段落、推荐手序和适合的人群；晒分帖建议带上曲名、难度、成绩和一点简短复盘。",
        "为避免楼层水化，版规说明帖默认锁定。如果需要补充建议，请去新手问答区另开主题。"
      )
    ],
    likes: ["forum_demo", "dojo_runner", "arcade_map"],
    posts: []
  },
  {
    key: "march_event",
    sectionSlug: "events",
    author: "matsuri_admin",
    threadType: "official",
    title: "三月祭典挑战赛报名帖与规则说明",
    summary: "第一期活动以魔王 9-10 星稳定度为核心，分为单曲挑战和段位 endurance 两个分组。",
    tags: ["赛事", "报名", "挑战赛"],
    coverImageUrl: cover(1156),
    viewCount: 1425,
    isPinned: false,
    isFeatured: true,
    isLocked: false,
    createdAt: "2026-03-11 19:00:00",
    contentBlocks: [
      ...textBlock(
        "本次活动分为单曲挑战和段位 endurance 两组，鼓励大家以录像或成绩截图的形式参赛。只要是国服鼓众广场账号成绩都可以报名。",
        "单曲组会按金冠、全良和稳定率表现分别做展示；段位组更看重通关率和体力分配，欢迎把自己的训练记录也贴出来。"
      ),
      imageBlock(1156, "赛事规则图示占位"),
      ...textBlock("报名格式已放在文末模板区，记得写明机厅、手台/双台和鼓棒配置。")
    ],
    likes: ["forum_demo", "don_chan_cn", "dojo_runner", "arcade_map", "fullcombo_aki", "fanart_kana"],
    posts: [
      post(
        "fullcombo_aki",
        "单曲组报名，准备冲 NAKED GLOW 和 SUDDEN GUST OC 两首。最近这两首的尾杀段都在练。",
        "2026-03-11 19:22:00",
        ["matsuri_admin", "don_chan_cn"],
        [],
        "event_signup_aki"
      ),
      post(
        "dojo_runner",
        "段位 endurance 组也报名一份，想借这个活动把十段前两曲的体力线练稳一点。",
        "2026-03-11 19:48:00",
        ["forum_demo", "arcade_map"],
        [
          reply(
            "matsuri_admin",
            "收到，段位组后面会单独开一个训练日志汇总贴，方便大家互相抄作业。",
            "2026-03-11 20:03:00",
            ["dojo_runner"]
          ),
          reply(
            "fanart_kana",
            "到时候我给活动做一套名次横幅，顺便把战报贴做成统一封面。",
            "2026-03-11 20:18:00",
            ["matsuri_admin"]
          )
        ],
        "event_signup_dojo"
      )
    ]
  },
  {
    key: "east_arcade_relay",
    sectionSlug: "events",
    author: "arcade_map",
    threadType: "discussion",
    title: "周末线下团建：华东鼓友机厅接力赛集合",
    summary: "先用帖子收集城市、可出勤时间和机厅意向，后面再根据回帖密度拆出同城群组。",
    tags: ["线下", "机厅", "同城"],
    coverImageUrl: cover(127),
    viewCount: 896,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-11 16:30:00",
    contentBlocks: [
      ...textBlock(
        "这帖先收集华东区域的线下意向，主要看上海、杭州、南京和苏州四地。请尽量写明可出勤时间、惯用机厅和大概水平。",
        "如果同城人数够多，会再拆成单独帖子，方便约练、踩点和安排友谊赛。"
      ),
      imageBlock(127, "线下机厅活动占位图")
    ],
    likes: ["forum_demo", "don_chan_cn", "dojo_runner", "fanart_kana"],
    posts: [
      post(
        "forum_demo",
        "上海可以到，周六下午或者周日晚上都行。如果能定在徐家汇一带我基本随叫随到。",
        "2026-03-11 16:45:00",
        ["arcade_map"],
        [],
        "relay_shanghai"
      ),
      post(
        "don_chan_cn",
        "杭州也能凑一车，主要想找鼓况稳定一点的店，最好有两台以上机可以轮换。",
        "2026-03-11 17:06:00",
        ["dojo_runner", "arcade_map"],
        [
          reply(
            "arcade_map",
            "收到，我会把已回帖的城市先整理成表，周末前单独发一个踩点汇总。",
            "2026-03-11 17:18:00",
            ["don_chan_cn"]
          )
        ],
        "relay_hangzhou"
      )
    ]
  },
  {
    key: "beginner_route",
    sectionSlug: "beginner-help",
    author: "dojo_runner",
    threadType: "discussion",
    title: "新手入坑先打什么歌？从 7 星到 9 星的练习路线",
    summary: "把常见入门歌、节奏密度变化和练手目标拆成三个阶段，适合刚从普通曲往高星过渡的玩家。",
    tags: ["新手", "练习路线", "入坑"],
    coverImageUrl: cover(1094),
    viewCount: 1310,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-10 21:00:00",
    contentBlocks: [
      ...textBlock(
        "如果你刚从 6-7 星往上打，不建议一上来就硬啃体力谱。先把节奏型和手感练稳定，再去抬速度，进步会更顺。",
        "这篇路线按 7 星、8 星、9 星三段分层写，优先挑能反复练同一类节奏型的曲子。"
      ),
      imageBlock(1094, "练习路线参考曲封面"),
      ...textBlock("如果你已经能稳定处理单手交替和小段 24 分，可以直接从文中的 8 星部分开始。")
    ],
    likes: ["forum_demo", "don_chan_cn", "rhythm_lab", "fullcombo_aki", "arcade_map"],
    posts: [
      post(
        "forum_demo",
        "这个路线挺适合我现在的进度，7 星过渡到 8 星的时候最怕那种突然加密的小节。",
        "2026-03-10 21:16:00",
        ["dojo_runner", "fanart_kana"],
        [
          reply(
            "dojo_runner",
            "先把固定节奏型练熟，再把眼睛和手的节奏同步起来。怕突然加密的话，就多挑短曲反复过一遍。",
            "2026-03-10 21:29:00",
            ["forum_demo"],
            "beginner_route_reply_dojo"
          )
        ],
        "beginner_route_floor_demo"
      ),
      post(
        "fanart_kana",
        "我当年是靠一堆 8 星流行曲堆手感，练烦了就去打点喜欢的动画歌，比较不容易坐牢。",
        "2026-03-10 21:43:00",
        ["forum_demo"],
        [],
        "beginner_route_floor_fanart"
      )
    ]
  },
  {
    key: "binding_faq",
    sectionSlug: "beginner-help",
    author: "matsuri_admin",
    threadType: "guide",
    title: "国服账号、鼓众广场绑定和成绩同步常见问题",
    summary: "把登录、绑定、称号校验和成绩更新常见问题集中在一帖，方便新用户快速自助排查。",
    tags: ["绑定", "FAQ", "成绩同步"],
    coverImageUrl: cover(302),
    viewCount: 980,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-10 18:00:00",
    contentBlocks: [
      ...textBlock(
        "如果你能正常登录论坛，但鼓众 ID 一直显示未绑定，优先检查输入的太鼓广场号是否完整，以及当前称号是否和待校验记录一致。",
        "成绩同步一般依赖你本地的数据源更新时间。如果刚打完新成绩，稍等几分钟再刷新通常就能看到。"
      ),
      imageBlock(302, "绑定问题说明示意图")
    ],
    likes: ["forum_demo", "dojo_runner", "arcade_map"],
    posts: [
      post(
        "don_chan_cn",
        "把称号改回原来的之后就绑定成功了，确实是我自己当时换了称号忘记改回来。",
        "2026-03-10 18:26:00",
        ["matsuri_admin"],
        [],
        "binding_faq_floor"
      )
    ]
  },
  {
    key: "vigvangs_guide",
    sectionSlug: "score-guides",
    author: "rhythm_lab",
    threadType: "guide",
    title: "vs.VIGVANGS 魔王 10 星拆谱：24 分纵连的手序思路",
    summary: "把前半段纵连、尾段爆发和体力留法拆开讲，尽量让第一次认真练这首的人少走弯路。",
    tags: ["攻略", "手法", "10星", "魔王"],
    coverImageUrl: cover(1419),
    songId: 1419,
    difficultyType: 4,
    viewCount: 2250,
    isPinned: false,
    isFeatured: true,
    isLocked: false,
    createdAt: "2026-03-12 09:10:00",
    contentBlocks: [
      ...textBlock(
        "这首最容易掉心态的地方，不是最密的那一下，而是前半段连续纵连把手型打散之后，后面恢复不过来。",
        "我的建议是把前半和尾段拆开练。先只记住每一段的发力方向，再慢慢连起来，不要一上来就整首硬顶。"
      ),
      imageBlock(1419, "vs.VIGVANGS 封面"),
      ...textBlock("如果你是体力先崩的类型，尾段请主动放一点音色，稳定过谱优先。")
    ],
    likes: ["forum_demo", "don_chan_cn", "dojo_runner", "arcade_map", "fanart_kana", "fullcombo_aki", "matsuri_admin"],
    posts: [
      post(
        "fullcombo_aki",
        "这首前半的纵连我一直是靠固定手序顶过去，但后面一乱就会全线炸开。这个拆法很有用。",
        "2026-03-12 09:24:00",
        ["rhythm_lab", "forum_demo"],
        [],
        "vigvangs_floor_aki"
      ),
      post(
        "dojo_runner",
        "@forum_demo 你之前不是说想找一首练 24 分纵连的谱吗，这篇可以直接当作本周作业。",
        "2026-03-12 09:31:00",
        ["forum_demo", "don_chan_cn"],
        [
          reply(
            "forum_demo",
            "看到了，今晚就去把前半段单独拆出来练。之前一直被尾段吓到，没想到前面才是根源。",
            "2026-03-12 09:43:00",
            ["dojo_runner"],
            "vigvangs_reply_demo"
          )
        ],
        "vigvangs_floor_dojo"
      ),
      post(
        "don_chan_cn",
        "我更怕的是中后段体力线断掉，感觉前半越紧张，后面越容易把击打位置打偏。",
        "2026-03-12 09:46:00",
        ["rhythm_lab"],
        [
          reply(
            "rhythm_lab",
            "那就更要把前半段节奏打轻一点，留出手臂空间。稳定性比音量更重要。",
            "2026-03-12 09:58:00",
            ["don_chan_cn"]
          )
        ],
        "vigvangs_floor_don"
      )
    ]
  },
  {
    key: "naked_glow_guide",
    sectionSlug: "score-guides",
    author: "fullcombo_aki",
    threadType: "guide",
    title: "NAKED GLOW 魔王 9 星稳定全良的小节练习法",
    summary: "针对容易滑手的小节和节奏回正点给出拆练顺序，适合已经有可见成绩、想往全良线推进的人。",
    tags: ["攻略", "全良", "9星"],
    coverImageUrl: cover(1156),
    songId: 1156,
    difficultyType: 4,
    viewCount: 1765,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-11 23:20:00",
    contentBlocks: [
      ...textBlock(
        "NAKED GLOW 最容易掉可见的地方，是你以为已经进入稳定段，结果节奏突然往前抢半拍。",
        "这首适合按小节练。每个小节先找回正点，再练连段，不要把所有注意力都放在尾段。"
      ),
      imageBlock(1156, "NAKED GLOW 封面"),
      ...textBlock("如果你是刚从金冠线往全良线推进，这首非常适合拿来训练稳手和节奏纠偏。")
    ],
    likes: ["forum_demo", "don_chan_cn", "rhythm_lab", "dojo_runner", "arcade_map", "matsuri_admin"],
    posts: [
      post(
        "forum_demo",
        "这首我可见已经稳定了，最近就是老在副歌前面那段抢拍。按小节练确实比整首反复有效。",
        "2026-03-11 23:41:00",
        ["fullcombo_aki"],
        [],
        "naked_glow_floor_demo"
      ),
      post(
        "rhythm_lab",
        "我建议把副歌前那段单独降速听两遍，找到你每次手会提前发力的点，再回原速打。",
        "2026-03-12 00:05:00",
        ["forum_demo", "fullcombo_aki"],
        [
          reply(
            "fullcombo_aki",
            "对，我自己也是先听回正点，再去处理击打大小。只盯着判定很容易越打越紧。",
            "2026-03-12 00:12:00",
            ["rhythm_lab"]
          )
        ],
        "naked_glow_floor_lab"
      )
    ]
  },
  {
    key: "dojo_training",
    sectionSlug: "dojo",
    author: "dojo_runner",
    threadType: "guide",
    title: "从九段到十段：体力段位配置与每日训练表",
    summary: "把一周训练拆成体力日、精度日和恢复日，适合正卡在九段后段或刚摸十段门槛的人。",
    tags: ["段位", "训练", "体力"],
    coverImageUrl: cover(1421),
    viewCount: 1840,
    isPinned: false,
    isFeatured: true,
    isLocked: false,
    createdAt: "2026-03-10 22:40:00",
    contentBlocks: [
      ...textBlock(
        "九段到十段最容易出现的误区，是每天都把自己打到体力见底，结果精度和恢复都没跟上。",
        "我更推荐一周拆成体力日、精度日和恢复日，训练密度拉开之后，稳定率反而更容易抬起来。"
      ),
      imageBlock(1421, "段位训练配表占位图"),
      ...textBlock("这份表不是唯一答案，但它至少能帮你避免天天把自己练爆。")
    ],
    likes: ["forum_demo", "don_chan_cn", "rhythm_lab", "arcade_map", "fullcombo_aki"],
    posts: [
      post(
        "forum_demo",
        "这份训练表很对我胃口，我之前就是每天都想硬冲，结果三天后整个人手都散掉了。",
        "2026-03-10 22:58:00",
        ["dojo_runner"],
        [],
        "dojo_floor_demo"
      ),
      post(
        "arcade_map",
        "如果是机厅练习时间有限的人，可以把恢复日换成短时精度校正。我一般会多打几首 8-9 星把手感找回来。",
        "2026-03-10 23:13:00",
        ["forum_demo", "dojo_runner"],
        [
          reply(
            "dojo_runner",
            "这个补充很好，特别适合工作日只能打一小时的人。@forum_demo 你如果周中时间紧，可以按这个版本压缩。",
            "2026-03-10 23:25:00",
            ["forum_demo", "arcade_map"],
            "dojo_reply_mention_demo"
          )
        ],
        "dojo_floor_arcade"
      )
    ]
  },
  {
    key: "dojo_pacing",
    sectionSlug: "dojo",
    author: "dojo_runner",
    threadType: "discussion",
    title: "十段一曲目总断气？这里有一份三周配速计划",
    summary: "从单曲拆段、两曲连打到完整模拟，把体力配速和节奏恢复都放到计划里，不再只靠硬顶。",
    tags: ["十段", "配速", "训练计划"],
    coverImageUrl: cover(1094),
    viewCount: 1228,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-09 20:30:00",
    contentBlocks: [
      ...textBlock(
        "如果你总在十段一曲目后半断气，问题通常不只是体力不够，而是前面配速和恢复节奏都失控了。",
        "这份三周计划先从单曲拆段开始，第二周做两曲连打，第三周再进完整模拟。"
      ),
      imageBlock(1094, "配速训练阶段示意")
    ],
    likes: ["forum_demo", "don_chan_cn", "fullcombo_aki", "arcade_map"],
    posts: [
      post(
        "don_chan_cn",
        "我就是那种前面一激动就把手打满，后面直接空掉的人。这个三周计划很适合纠正坏习惯。",
        "2026-03-09 20:44:00",
        ["dojo_runner"],
        [
          reply(
            "dojo_runner",
            "那就第一周先只盯配速，不看成绩。只要你能把每次断气点往后拖，第三周模拟时就会明显轻松。",
            "2026-03-09 20:57:00",
            ["don_chan_cn"]
          )
        ],
        "dojo_pacing_floor_don"
      )
    ]
  },
  {
    key: "sudden_gust_crown",
    sectionSlug: "achievements",
    author: "don_chan_cn",
    threadType: "achievement",
    title: "今天终于拿下 SUDDEN GUST OC 金冠",
    summary: "连续卡了好多天的尾段终于稳住，打出这次金冠之后，感觉后续全良也终于有盼头了。",
    tags: ["金冠", "战报", "9星"],
    coverImageUrl: cover(1421),
    songId: 1421,
    difficultyType: 4,
    viewCount: 1530,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-12 00:40:00",
    contentBlocks: [
      ...textBlock(
        "这首我已经卡了好多天，主要是尾段一紧张就会把手打乱。今晚终于把前面节奏压住，后面也没再乱掉。",
        "先把金冠拿下，接下来就可以更安心地冲全良了。"
      ),
      imageBlock(1421, "SUDDEN GUST OC 成绩截图占位")
    ],
    likes: ["forum_demo", "rhythm_lab", "dojo_runner", "arcade_map", "fanart_kana", "fullcombo_aki"],
    posts: [
      post(
        "fullcombo_aki",
        "恭喜，这首尾段稳住之后就会突然变得很顺。你已经离全良线不远了。",
        "2026-03-12 00:56:00",
        ["don_chan_cn"],
        [],
        "sudden_reply_aki"
      ),
      post(
        "forum_demo",
        "我也是被尾段卡住的类型，看到你这帖突然觉得还能再坚持几天。",
        "2026-03-12 01:10:00",
        ["don_chan_cn", "dojo_runner"],
        [
          reply(
            "don_chan_cn",
            "真的别急，先把前半的放松感练出来，尾段会自然跟着顺一点。",
            "2026-03-12 01:16:00",
            ["forum_demo"]
          )
        ],
        "sudden_reply_demo"
      )
    ]
  },
  {
    key: "tenshou_fullcombo",
    sectionSlug: "achievements",
    author: "fullcombo_aki",
    threadType: "achievement",
    title: "报上大名（天上篇）首个全良记录，手还在抖",
    summary: "这首一直是我的心理阴影，今天状态意外平稳，最后一小节打完的时候手都还在抖。",
    tags: ["全良", "战报", "高光时刻"],
    coverImageUrl: cover(302),
    songId: 302,
    difficultyType: 4,
    viewCount: 1910,
    isPinned: false,
    isFeatured: true,
    isLocked: false,
    createdAt: "2026-03-11 22:10:00",
    contentBlocks: [
      ...textBlock(
        "这首以前每次都能把我从自信打到沉默，尤其是最后一段只要脑子一空就会直接断掉。",
        "今天终于把它收成首个全良了。现在回头看，关键还是前面要留手，不要提前把注意力耗空。"
      ),
      imageBlock(302, "报上大名（天上篇）战报占位图")
    ],
    likes: ["forum_demo", "don_chan_cn", "rhythm_lab", "dojo_runner", "arcade_map", "fanart_kana", "matsuri_admin"],
    posts: [
      post(
        "fanart_kana",
        "首个全良放在这种高压曲上，含金量直接拉满了。恭喜你把心理阴影正式拆了。",
        "2026-03-11 22:29:00",
        ["fullcombo_aki"],
        [],
        "tenshou_reply_fanart"
      ),
      post(
        "rhythm_lab",
        "这首最后一段能稳下来，说明你前面配速已经成熟很多了。后面完全可以继续摸更高压力的歌。",
        "2026-03-11 22:40:00",
        ["fullcombo_aki", "forum_demo"],
        [],
        "tenshou_reply_lab"
      )
    ]
  },
  {
    key: "xujiahui_arcade",
    sectionSlug: "arcade",
    author: "arcade_map",
    threadType: "discussion",
    title: "上海徐家汇机厅踩点汇总：排队、机况和充值",
    summary: "把最近几家常去店的鼓况、排队时段和充值方式先汇总一版，方便大家周末少踩雷。",
    tags: ["上海", "机厅", "踩点"],
    coverImageUrl: cover(127),
    viewCount: 1104,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-09 18:20:00",
    contentBlocks: [
      ...textBlock(
        "先做一个徐家汇区域的踩点汇总。主要看鼓面回弹、按键灵敏度、排队长度和充值便利性，后续会慢慢补到别的城区。",
        "如果你最近也去过附近机厅，欢迎直接在楼里补充实际体验。"
      ),
      imageBlock(127, "机厅踩点封面")
    ],
    likes: ["forum_demo", "don_chan_cn", "dojo_runner", "fanart_kana"],
    posts: [
      post(
        "forum_demo",
        "这帖太实用了。我周末基本都在徐家汇附近出没，最怕的是排半天队结果鼓面还发闷。",
        "2026-03-09 18:34:00",
        ["arcade_map"],
        [],
        "xujiahui_reply_demo"
      ),
      post(
        "don_chan_cn",
        "如果是想认真冲分，建议优先去两台机的那家，轮换和休息空间都更舒服。",
        "2026-03-09 18:49:00",
        ["forum_demo", "arcade_map"],
        [
          reply(
            "arcade_map",
            "收到，我把这个建议加进主楼，顺便把高峰期大概排队时长也补进去。",
            "2026-03-09 19:02:00",
            ["don_chan_cn"]
          )
        ],
        "xujiahui_reply_don"
      )
    ]
  },
  {
    key: "guangzhou_meetup",
    sectionSlug: "arcade",
    author: "forum_demo",
    threadType: "discussion",
    title: "广州鼓友周五夜练约起",
    summary: "先用帖子收人，定下大概的时间段和常驻机厅，再看要不要拆一个长期夜练串。",
    tags: ["广州", "夜练", "同城"],
    coverImageUrl: cover(1420),
    viewCount: 760,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-08 21:10:00",
    contentBlocks: [
      ...textBlock(
        "广州鼓友如果周五晚上有固定练习需求，可以先在这里报个到。人够的话我就把常去的店和大概时间段整理出来。",
        "先不建群，帖子里收一轮人数和区域偏好再说。"
      ),
      imageBlock(1420, "广州夜练串封面")
    ],
    likes: ["don_chan_cn", "arcade_map", "fullcombo_aki"],
    posts: [
      post(
        "arcade_map",
        "我这边周五 20:00 后能到，@forum_demo 如果你把常去店和机况先列一下，大家会更容易决定去哪里。",
        "2026-03-08 21:30:00",
        ["don_chan_cn"],
        [],
        "guangzhou_reply_arcade"
      )
    ]
  },
  {
    key: "emoji_pack",
    sectionSlug: "creative",
    author: "fanart_kana",
    threadType: "discussion",
    title: "给论坛画了一个咚咔表情包套组",
    summary: "先贴第一版草图和几个常用表情，看看大家更想要偏搞怪还是偏机厅日常的方向。",
    tags: ["二创", "表情包", "咚咔"],
    coverImageUrl: cover(1420),
    viewCount: 1005,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-11 15:15:00",
    contentBlocks: [
      ...textBlock(
        "最近想给论坛做一套自己的咚咔表情包，先把几张草图贴出来收集意见。现在大概分成鼓友日常、打歌崩溃和全良高光三类。",
        "如果有特别想要的梗图方向，也可以在楼里点单。"
      ),
      imageBlock(1420, "表情包草图占位图")
    ],
    likes: ["forum_demo", "don_chan_cn", "arcade_map", "matsuri_admin", "fullcombo_aki"],
    posts: [
      post(
        "matsuri_admin",
        "这个方向很好，后面论坛如果加勋章和活动贴纸，也可以直接沿用同一套视觉语言。",
        "2026-03-11 15:30:00",
        ["fanart_kana"],
        [],
        "emoji_reply_admin"
      ),
      post(
        "forum_demo",
        "强烈建议画一个“刚打完全良但不敢截图确认”的表情，我感觉会超级常用。",
        "2026-03-11 15:44:00",
        ["fanart_kana", "don_chan_cn"],
        [
          reply(
            "fanart_kana",
            "收到，这个一定安排。再补一个“明明只差一 good 却想重新打一小时”的版本。",
            "2026-03-11 15:56:00",
            ["forum_demo"]
          )
        ],
        "emoji_reply_demo"
      )
    ]
  },
  {
    key: "roleplay_thread",
    sectionSlug: "creative",
    author: "fanart_kana",
    threadType: "discussion",
    title: "如果太鼓角色开论坛，会发什么帖子？",
    summary: "纯脑洞串，欢迎把游戏角色、曲包吉祥物和机厅常驻鼓友都拉进来整活。",
    tags: ["脑洞", "玩梗", "二创"],
    coverImageUrl: cover(1094),
    viewCount: 870,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-12 01:30:00",
    contentBlocks: [
      ...textBlock(
        "假设游戏里的角色真的会发论坛帖，你觉得他们第一篇会写什么？是发战报、发活动通知，还是在同城机厅区抱怨鼓况？",
        "这个串纯粹用来整活，欢迎放飞。"
      ),
      imageBlock(1094, "脑洞串封面")
    ],
    likes: ["forum_demo", "dojo_runner", "arcade_map", "fullcombo_aki"],
    posts: [
      post(
        "don_chan_cn",
        "我先来：某角色会在晒分区发《今天也只是随便打打，结果不小心又全良了》。",
        "2026-03-12 01:46:00",
        ["fanart_kana", "forum_demo"],
        [],
        "roleplay_reply_don"
      ),
      post(
        "dojo_runner",
        "另一个角色肯定会在段位区发《有没有不吃体力的十段训练法》，然后楼下全是“没有”。",
        "2026-03-12 02:02:00",
        ["don_chan_cn", "fanart_kana"],
        [
          reply(
            "fanart_kana",
            "笑死，这个帖标题我已经能脑补完整排版了。",
            "2026-03-12 02:10:00",
            ["dojo_runner"]
          ),
          reply(
            "forum_demo",
            "然后第三楼一定会有人认真回一份三千字训练计划。",
            "2026-03-12 02:14:00",
            ["dojo_runner"]
          )
        ],
        "roleplay_reply_dojo"
      )
    ]
  },
  {
    key: "april_update_notice",
    sectionSlug: "official",
    author: "matsuri_admin",
    threadType: "official",
    title: "四月功能更新预告：收藏、草稿和机厅索引排期",
    summary: "先公开下一阶段论坛迭代重点，包括主题收藏、发帖草稿和同城机厅索引的上线顺序。",
    tags: ["更新预告", "站务", "路线图"],
    coverImageUrl: cover(1420),
    viewCount: 1288,
    isPinned: false,
    isFeatured: true,
    isLocked: false,
    createdAt: "2026-03-12 10:15:00",
    contentBlocks: [
      ...textBlock(
        "四月会优先补三个方向：主题收藏、发帖草稿和机厅索引。前两个是为了让攻略创作和长期追帖更顺手，机厅索引则会先做城市聚合，再逐步补店铺详情。",
        "移动端也会同步跟进图片上传、帖子草稿恢复和更完整的通知入口。"
      ),
      imageBlock(1420, "四月更新路线图占位图"),
      ...textBlock("如果你更希望先做别的功能，可以在楼里集中反馈，我们会按频次排优先级。")
    ],
    likes: ["forum_demo", "arcade_map", "score_doctor", "city_captain", "fanart_kana"],
    posts: [
      post(
        "score_doctor",
        "草稿功能很需要，长攻略在手机上断线一次就没了是真的难受。",
        "2026-03-12 10:28:00",
        ["matsuri_admin", "forum_demo"],
        [],
        "april_notice_floor_score_doctor"
      ),
      post(
        "arcade_map",
        "机厅索引建议先做城市维度和鼓况标签，不然信息很快就会过期。后面有需要我可以继续帮忙整理。",
        "2026-03-12 10:36:00",
        ["city_captain"],
        [
          reply(
            "matsuri_admin",
            "同意，第一版先保证可维护性，机况和人流这种高频变化信息会尽量做成帖子补充。",
            "2026-03-12 10:43:00",
            ["arcade_map"]
          )
        ],
        "april_notice_floor_arcade_map"
      )
    ]
  },
  {
    key: "event_photo_dump",
    sectionSlug: "events",
    author: "city_captain",
    threadType: "discussion",
    title: "三月挑战赛赛前踩点与物料准备记录",
    summary: "把活动物料、分组看板和赛前踩点安排集中在一帖，方便参与者确认现场流程。",
    tags: ["赛事筹备", "物料", "线下"],
    coverImageUrl: cover(127),
    viewCount: 932,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-12 10:05:00",
    contentBlocks: [
      ...textBlock(
        "赛前踩点已经完成第一轮，主要确认了鼓况、候场动线和现场成绩登记方式。主楼会持续更新横幅、分组看板和临时规则调整。",
        "如果你需要代带鼓棒袋、移动电源或者录像支架，也可以在楼里提前登记。"
      ),
      imageBlock(127, "赛事物料占位图")
    ],
    likes: ["forum_demo", "don_chan_cn", "fanart_kana", "arcade_map"],
    posts: [
      post(
        "fanart_kana",
        "我这边可以把横幅和成绩贴纸带过去，晚点把打印尺寸发你确认。",
        "2026-03-12 10:19:00",
        ["city_captain"],
        [],
        "event_photo_floor_fanart"
      ),
      post(
        "city_captain",
        "@arcade_map 你上次整理的城市报名表很有用，能不能把机厅交通信息也补进来，方便外地鼓友直接看。",
        "2026-03-12 10:31:00",
        ["arcade_map", "matsuri_admin"],
        [],
        "event_photo_floor_city_captain"
      )
    ]
  },
  {
    key: "beginner_drumstick",
    sectionSlug: "beginner-help",
    author: "score_doctor",
    threadType: "discussion",
    title: "新手鼓棒怎么选：长度、重量和手感的第一轮排雷",
    summary: "从最容易踩坑的几个维度开始讲，先避免买到不顺手的鼓棒，再谈细分流派。",
    tags: ["新手", "鼓棒", "入门装备"],
    coverImageUrl: cover(1094),
    viewCount: 846,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-12 09:55:00",
    contentBlocks: [
      ...textBlock(
        "新手第一次选鼓棒，先别急着追求某种神奇配置。长度、重量和平衡点只要有一项和你的发力习惯完全反着来，手感就会很难受。",
        "这帖先帮你排掉最常见的坑：太重导致体力线崩、太滑导致握持不稳，以及长度不合适带来的击打偏移。"
      ),
      imageBlock(1094, "鼓棒选择说明图")
    ],
    likes: ["forum_demo", "dojo_runner", "fullcombo_aki"],
    posts: [
      post(
        "forum_demo",
        "我现在就是拿到什么打什么，最近才发现鼓棒太滑的时候尾段很容易乱。",
        "2026-03-12 10:06:00",
        ["score_doctor"],
        [],
        "beginner_drumstick_floor_demo"
      ),
      post(
        "score_doctor",
        "那你先别急着换一堆配置，先把握持稳定和出汗后的防滑处理做好，再去试长度差异会更明显。",
        "2026-03-12 10:14:00",
        ["forum_demo"],
        [],
        "beginner_drumstick_floor_doctor"
      )
    ]
  },
  {
    key: "tower_medley_lab",
    sectionSlug: "score-guides",
    author: "score_doctor",
    threadType: "guide",
    title: "多段变速综合谱的拆练方式：先记转换点，再记手序",
    summary: "给容易在综合谱里迷路的人一套拆练顺序，优先把变速和段落边界打清楚。",
    tags: ["攻略", "综合谱", "变速"],
    coverImageUrl: cover(127),
    songId: 127,
    difficultyType: 4,
    viewCount: 1388,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-12 10:22:00",
    contentBlocks: [
      ...textBlock(
        "综合谱最容易让人失控的不是单段难度，而是切段时大脑和手都还停留在上一段。先把转换点记熟，再记每一段的手序，效率会高很多。",
        "如果你一到变速就开始慌，建议把谱面先按段落拆开，只练开头两拍和收尾两拍。"
      ),
      imageBlock(127, "综合谱拆练示意")
    ],
    likes: ["rhythm_lab", "dojo_runner", "fullcombo_aki", "city_captain"],
    posts: [
      post(
        "rhythm_lab",
        "这套拆法适合综合谱苦手，尤其是先记转换点这个思路，能少很多无效重开。",
        "2026-03-12 10:34:00",
        ["score_doctor"],
        [],
        "tower_medley_floor_lab"
      ),
      post(
        "fullcombo_aki",
        "我之前就是每次都在段落转换时脑子空白，难怪感觉怎么练都卡在同一段。",
        "2026-03-12 10:41:00",
        ["score_doctor", "rhythm_lab"],
        [],
        "tower_medley_floor_aki"
      )
    ]
  },
  {
    key: "score_clinic",
    sectionSlug: "score-guides",
    author: "score_doctor",
    threadType: "guide",
    title: "谱面门诊第一期：为什么你总在同一个小节掉可见",
    summary: "把常见失误拆成视线、配速、发力和心理预判四类，适合遇到固定掉点的玩家对照自查。",
    tags: ["门诊", "攻略", "稳定率"],
    coverImageUrl: cover(1421),
    songId: 1421,
    difficultyType: 4,
    viewCount: 1695,
    isPinned: false,
    isFeatured: true,
    isLocked: false,
    createdAt: "2026-03-12 10:48:00",
    contentBlocks: [
      ...textBlock(
        "总在同一个小节掉可见，通常不是那一小节本身有多难，而是你前一段的节奏、视线或者手部发力已经埋下了问题。",
        "这帖把固定掉点拆成四类症状，你可以按自己的表现对照：看不清、抢拍、手型散和心理预判过度。"
      ),
      imageBlock(1421, "谱面门诊占位图"),
      ...textBlock("如果你愿意，也可以把自己卡住的曲子和掉点描述贴在楼里，后面我会按案例继续写第二期。")
    ],
    likes: ["forum_demo", "rhythm_lab", "dojo_runner", "arcade_map", "city_captain", "matsuri_admin"],
    posts: [
      post(
        "forum_demo",
        "我就是那种每次都在同一小节掉 good 的类型，看完之后发现其实是前一段已经开始抢拍了。",
        "2026-03-12 10:59:00",
        ["score_doctor", "dojo_runner"],
        [],
        "score_clinic_floor_demo"
      ),
      post(
        "score_doctor",
        "@fullcombo_aki 你之前那篇全良帖里提到的“前面留手”其实就很适合作为这里的案例，后面我想整理成一份固定掉点排查表。",
        "2026-03-12 11:08:00",
        ["fullcombo_aki", "matsuri_admin"],
        [],
        "score_clinic_floor_doctor"
      )
    ]
  },
  {
    key: "dojo_mock_exam",
    sectionSlug: "dojo",
    author: "city_captain",
    threadType: "discussion",
    title: "周日段位模拟考场登记帖",
    summary: "先登记参与人数和目标段位，按人数拆出九段、十段和高段模拟场次。",
    tags: ["段位", "模拟考", "集训"],
    coverImageUrl: cover(1421),
    viewCount: 924,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-12 09:48:00",
    contentBlocks: [
      ...textBlock(
        "周日想开一轮段位模拟考场，先统计一下人数和目标段位。人多的话会按九段、十段和更高段分场，避免节奏完全撞在一起。",
        "如果你只是想来热身，也欢迎报名，现场会留一个轻量练习时段。"
      ),
      imageBlock(1421, "段位模拟考场占位图")
    ],
    likes: ["dojo_runner", "forum_demo", "fullcombo_aki"],
    posts: [
      post(
        "dojo_runner",
        "我可以带一份热身曲单过去，先让大家把手打开再进模拟会更稳。",
        "2026-03-12 09:57:00",
        ["city_captain"],
        [],
        "dojo_mock_exam_floor_runner"
      ),
      post(
        "forum_demo",
        "九段组先报个名，我主要想测一下自己在多人环境里会不会紧张到节奏乱掉。",
        "2026-03-12 10:11:00",
        ["dojo_runner"],
        [],
        "dojo_mock_exam_floor_demo"
      )
    ]
  },
  {
    key: "nanjing_arcade_sheet",
    sectionSlug: "arcade",
    author: "city_captain",
    threadType: "discussion",
    title: "南京机厅鼓况登记表第一版",
    summary: "先把常去店的鼓况、排队强度和交通便利性列成清单，方便外地鼓友和活动组织快速参考。",
    tags: ["南京", "机厅", "鼓况"],
    coverImageUrl: cover(1094),
    viewCount: 788,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-12 09:36:00",
    contentBlocks: [
      ...textBlock(
        "南京的机厅信息先做一版基础表，重点看鼓面回弹、鼓槌反馈、排队情况和地铁通达性。后面谁有新情报可以直接在楼里追加。",
        "如果活动最终放在南京，这帖也会直接作为现场踩点的参考底稿。"
      ),
      imageBlock(1094, "南京机厅整理图")
    ],
    likes: ["arcade_map", "forum_demo", "don_chan_cn"],
    posts: [
      post(
        "arcade_map",
        "这帖格式很适合继续扩展，我建议再加一列“高峰期平均等待时间”，约练时会非常有用。",
        "2026-03-12 09:52:00",
        ["city_captain"],
        [],
        "nanjing_arcade_floor_map"
      )
    ]
  },
  {
    key: "creative_merch",
    sectionSlug: "creative",
    author: "fanart_kana",
    threadType: "discussion",
    title: "论坛周边脑洞征集：徽章、贴纸还是票夹？",
    summary: "想给后面的线下活动做一批轻量周边，先看看大家更想要哪种方向。",
    tags: ["二创", "周边", "活动"],
    coverImageUrl: cover(1420),
    viewCount: 918,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    createdAt: "2026-03-12 10:24:00",
    contentBlocks: [
      ...textBlock(
        "如果线下活动持续办下去，想做一批不太占成本的小周边。现在在徽章、贴纸和票夹三种方向里摇摆，先来收一轮偏好。",
        "如果你有更适合鼓友使用场景的点子，也欢迎直接丢在楼里。"
      ),
      imageBlock(1420, "论坛周边草图占位")
    ],
    likes: ["matsuri_admin", "forum_demo", "city_captain", "fullcombo_aki"],
    posts: [
      post(
        "city_captain",
        "票夹挺实用，活动签到和成绩单都能顺手放进去，落地率会比纯收藏向高一点。",
        "2026-03-12 10:37:00",
        ["fanart_kana"],
        [],
        "creative_merch_floor_captain"
      ),
      post(
        "fullcombo_aki",
        "我投贴纸一票，最好来一套“全良达成”“体力见底”“今天不服再来”的固定梗图。",
        "2026-03-12 10:46:00",
        ["fanart_kana", "forum_demo"],
        [],
        "creative_merch_floor_aki"
      )
    ]
  },
  {
    key: "hidden_cleanup",
    sectionSlug: "official",
    author: "forum_demo",
    threadType: "discussion",
    title: "测试帖：临时搬运的旧站内容整理",
    summary: "这是一条用于演示隐藏处理的站务样例，公开列表不展示。",
    tags: ["测试", "站务处理"],
    coverImageUrl: cover(302),
    viewCount: 214,
    isPinned: false,
    isFeatured: false,
    isLocked: false,
    status: "hidden",
    createdAt: "2026-03-12 07:50:00",
    contentBlocks: [
      ...textBlock(
        "这条帖子用于演示版务隐藏后的处理效果。它会保留在后台和日志里，但不会出现在公开列表。",
        "如果后续需要演示恢复显示，也可以直接对这条线程操作。"
      )
    ],
    likes: ["matsuri_admin"],
    posts: [
      post(
        "city_captain",
        "这类内容已经并入新的公告帖，旧串就先隐藏留档。",
        "2026-03-12 08:04:00",
        ["matsuri_admin"],
        [],
        "hidden_cleanup_floor_captain"
      )
    ]
  },
  {
    key: "hidden_offtopic",
    sectionSlug: "creative",
    author: "fanart_kana",
    threadType: "discussion",
    title: "纯跑题水楼样例：和太鼓无关的长串",
    summary: "这是一条用于演示隐藏加锁的管理样例，普通用户在公开站点不会看到。",
    tags: ["跑题", "水楼", "管理样例"],
    coverImageUrl: cover(1094),
    viewCount: 167,
    isPinned: false,
    isFeatured: false,
    isLocked: true,
    status: "hidden",
    createdAt: "2026-03-12 08:20:00",
    contentBlocks: [
      ...textBlock(
        "这里原本是一条明显偏离版块主题的水楼，用来演示隐藏并锁定后的状态。",
        "站务处理后，这类线程会保留日志记录，并向作者发送系统通知。"
      )
    ],
    likes: [],
    posts: [
      post(
        "city_captain",
        "和版块主题无关，先隐藏并锁定，避免继续堆楼。",
        "2026-03-12 08:33:00",
        [],
        [],
        "hidden_offtopic_floor_captain"
      )
    ]
  }
];

const NOTIFICATIONS = [
  {
    user: "forum_demo",
    actor: null,
    type: "system",
    title: "欢迎来到太鼓论坛",
    body: "模拟通知已就位，你现在可以查看回复、提及和点赞提醒。",
    threadKey: null,
    postKey: null,
    isRead: 1,
    createdAt: "2026-03-12 08:40:00"
  },
  {
    user: "forum_demo",
    actor: "arcade_map",
    type: "reply",
    title: "有人回复了你的主题",
    body: "arcade_map 在《广州鼓友周五夜练约起》中回复了你。",
    threadKey: "guangzhou_meetup",
    postKey: "guangzhou_reply_arcade",
    isRead: 0,
    createdAt: "2026-03-12 08:55:00"
  },
  {
    user: "forum_demo",
    actor: "dojo_runner",
    type: "mention",
    title: "有人在帖子里提到了你",
    body: "dojo_runner 在《从九段到十段：体力段位配置与每日训练表》中提到了 @forum_demo。",
    threadKey: "dojo_training",
    postKey: "dojo_reply_mention_demo",
    isRead: 0,
    createdAt: "2026-03-12 09:02:00"
  },
  {
    user: "forum_demo",
    actor: "fullcombo_aki",
    type: "like",
    title: "你的主题收到了新的点赞",
    body: "fullcombo_aki 点赞了《广州鼓友周五夜练约起》。",
    threadKey: "guangzhou_meetup",
    postKey: null,
    isRead: 0,
    createdAt: "2026-03-12 09:06:00"
  },
  {
    user: "arcade_map",
    actor: "city_captain",
    type: "mention",
    title: "有人在帖子里提到了你",
    body: "city_captain 在《三月挑战赛赛前踩点与物料准备记录》中提到了 @arcade_map。",
    threadKey: "event_photo_dump",
    postKey: "event_photo_floor_city_captain",
    isRead: 0,
    createdAt: "2026-03-12 10:32:00"
  },
  {
    user: "fullcombo_aki",
    actor: "score_doctor",
    type: "mention",
    title: "有人在帖子里提到了你",
    body: "score_doctor 在《谱面门诊第一期：为什么你总在同一个小节掉可见》中提到了 @fullcombo_aki。",
    threadKey: "score_clinic",
    postKey: "score_clinic_floor_doctor",
    isRead: 0,
    createdAt: "2026-03-12 11:09:00"
  },
  {
    user: "fanart_kana",
    actor: "city_captain",
    type: "system",
    title: "你的主题已被站务处理",
    body: "你发布的《纯跑题水楼样例：和太鼓无关的长串》因偏离版块主题被隐藏并锁定。",
    threadKey: "hidden_offtopic",
    postKey: null,
    isRead: 0,
    createdAt: "2026-03-12 08:35:00"
  },
  {
    user: "forum_demo",
    actor: "city_captain",
    type: "system",
    title: "你的主题已被站务处理",
    body: "你发布的《测试帖：临时搬运的旧站内容整理》已完成归档并从公开列表隐藏。",
    threadKey: "hidden_cleanup",
    postKey: null,
    isRead: 1,
    createdAt: "2026-03-12 08:06:00"
  }
];

const MODERATION_LOGS = [
  {
    threadKey: "forum_rules",
    operator: "matsuri_admin",
    action: "lock",
    reason: "版规说明帖固定锁定，避免水楼。",
    createdAt: "2026-03-12 08:05:00"
  },
  {
    threadKey: "official_launch",
    operator: "matsuri_admin",
    action: "pin",
    reason: "开站公告固定置顶。",
    createdAt: "2026-03-12 08:31:00"
  },
  {
    threadKey: "march_event",
    operator: "matsuri_admin",
    action: "feature",
    reason: "赛事说明帖加入精选。",
    createdAt: "2026-03-11 19:04:00"
  },
  {
    threadKey: "score_clinic",
    operator: "matsuri_admin",
    action: "feature",
    reason: "谱面门诊系列加入精选，便于新用户集中查阅。",
    createdAt: "2026-03-12 10:50:00"
  },
  {
    threadKey: "hidden_cleanup",
    operator: "city_captain",
    action: "hide",
    reason: "旧站搬运串已归档，移出公开列表。",
    createdAt: "2026-03-12 08:05:00"
  },
  {
    threadKey: "hidden_offtopic",
    operator: "city_captain",
    action: "hide",
    reason: "内容偏离版块主题，先隐藏留档。",
    createdAt: "2026-03-12 08:34:00"
  },
  {
    threadKey: "hidden_offtopic",
    operator: "city_captain",
    action: "lock",
    reason: "隐藏后同步锁定，避免继续堆楼。",
    createdAt: "2026-03-12 08:35:00"
  }
];

const songList = JSON.parse(readFileSync(songDataPath, "utf8"));
const songMap = new Map(songList.map((song) => [Number(song.id), song]));

const getLevel = (songId, difficultyType) => {
  if (!songId || !difficultyType) return null;
  const song = songMap.get(Number(songId));
  if (!song) return null;
  const raw = song[`level_${difficultyType}`];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getConnection = async () => mysql.createConnection(dbConfig);

const findSectionIdMap = async (db) => {
  const [rows] = await db.execute("SELECT id, slug FROM forum_sections ORDER BY id ASC");
  const map = new Map();
  for (const row of rows) {
    map.set(row.slug, Number(row.id));
  }
  return map;
};

const upsertUser = async (db, user) => {
  await db.execute(
    `INSERT INTO web_user_accounts (username, email, password_hash, avatar_url, email_verified)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       avatar_url = VALUES(avatar_url),
       email_verified = VALUES(email_verified)`,
    [user.username, user.email, PASSWORD_HASH, user.avatarUrl || pngFallbackAvatar]
  );
  const [rows] = await db.execute("SELECT id FROM web_user_accounts WHERE email = ? LIMIT 1", [user.email]);
  const id = Number(rows[0]?.id || 0);
  if (!id) {
    throw new Error(`Failed to resolve user id for ${user.username}`);
  }
  await db.execute(
    `INSERT INTO forum_user_profiles (user_id, role, signature, reputation)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       role = VALUES(role),
       signature = VALUES(signature),
       reputation = VALUES(reputation)`,
    [id, user.role, user.signature, user.reputation]
  );
  await db.execute("UPDATE web_taiko_bindings SET is_current = 0 WHERE user_id = ?", [id]);
  await db.execute(
    `INSERT INTO web_taiko_bindings (user_id, taiko_id, is_current, verified_title, verified_titleplate_id)
     VALUES (?, ?, 1, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       is_current = VALUES(is_current),
       verified_title = VALUES(verified_title),
       verified_titleplate_id = VALUES(verified_titleplate_id),
       updated_at = CURRENT_TIMESTAMP`,
    [id, user.taikoId, user.verifiedTitle, user.verifiedTitleplateId]
  );
  return id;
};

const upsertThread = async (db, sectionIdMap, userIdMap, thread) => {
  const sectionId = sectionIdMap.get(thread.sectionSlug);
  const authorUserId = userIdMap.get(thread.author);
  const threadStatus = thread.status || "published";
  if (!sectionId) throw new Error(`Unknown section slug: ${thread.sectionSlug}`);
  if (!authorUserId) throw new Error(`Unknown author key: ${thread.author}`);
  const level = getLevel(thread.songId || null, thread.difficultyType || null);
  const [existingRows] = await db.execute(
    "SELECT id FROM forum_threads WHERE title = ? LIMIT 1",
    [thread.title]
  );
  if (existingRows.length) {
    const id = Number(existingRows[0].id);
    await db.execute(
      `UPDATE forum_threads
       SET section_id = ?, author_user_id = ?, thread_type = ?, title = ?, summary = ?,
           content_blocks_json = ?, cover_image_url = ?, tags_json = ?, song_id = ?, difficulty_type = ?, level = ?,
           status = ?, is_pinned = ?, is_featured = ?, is_locked = ?, view_count = ?,
           created_at = ?, updated_at = ?, latest_post_at = ?
       WHERE id = ?`,
      [
        sectionId,
        authorUserId,
        thread.threadType,
        thread.title,
        thread.summary,
        JSON.stringify(thread.contentBlocks),
        thread.coverImageUrl || "",
        JSON.stringify(thread.tags),
        thread.songId || null,
        thread.difficultyType || null,
        level,
        threadStatus,
        thread.isPinned ? 1 : 0,
        thread.isFeatured ? 1 : 0,
        thread.isLocked ? 1 : 0,
        thread.viewCount,
        thread.createdAt,
        thread.createdAt,
        thread.createdAt,
        id
      ]
    );
    return id;
  }
  const [result] = await db.execute(
    `INSERT INTO forum_threads
      (section_id, author_user_id, thread_type, title, summary, content_blocks_json, cover_image_url, tags_json,
       song_id, difficulty_type, level, status, is_pinned, is_featured, is_locked, view_count, like_count,
       reply_count, latest_post_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    [
      sectionId,
      authorUserId,
      thread.threadType,
      thread.title,
      thread.summary,
      JSON.stringify(thread.contentBlocks),
      thread.coverImageUrl || "",
      JSON.stringify(thread.tags),
      thread.songId || null,
      thread.difficultyType || null,
      level,
      threadStatus,
      thread.isPinned ? 1 : 0,
      thread.isFeatured ? 1 : 0,
      thread.isLocked ? 1 : 0,
      thread.viewCount,
      thread.createdAt,
      thread.createdAt,
      thread.createdAt
    ]
  );
  return Number(result.insertId);
};

const upsertPost = async (db, userIdMap, threadId, floorNo, parentPostId, rootPostId, item) => {
  const authorUserId = userIdMap.get(item.author);
  if (!authorUserId) throw new Error(`Unknown post author key: ${item.author}`);
  const [existingRows] = await db.execute(
    `SELECT id FROM forum_posts
     WHERE thread_id = ? AND author_user_id = ? AND parent_post_id <=> ? AND body_text = ?
     LIMIT 1`,
    [threadId, authorUserId, parentPostId ?? null, item.body]
  );
  if (existingRows.length) {
    const id = Number(existingRows[0].id);
    await db.execute(
      `UPDATE forum_posts
       SET parent_post_id = ?, root_post_id = ?, floor_no = ?, body_text = ?, status = 'published',
           created_at = ?, updated_at = ?
       WHERE id = ?`,
      [parentPostId ?? null, rootPostId ?? null, floorNo, item.body, item.createdAt, item.createdAt, id]
    );
    return id;
  }
  const [result] = await db.execute(
    `INSERT INTO forum_posts
      (thread_id, author_user_id, parent_post_id, root_post_id, floor_no, body_text, status, like_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'published', 0, ?, ?)`,
    [threadId, authorUserId, parentPostId ?? null, rootPostId ?? null, floorNo, item.body, item.createdAt, item.createdAt]
  );
  return Number(result.insertId);
};

const ensureThreadLike = async (db, userId, threadId) => {
  await db.execute(
    "INSERT IGNORE INTO forum_thread_likes (thread_id, user_id, created_at) VALUES (?, ?, NOW())",
    [threadId, userId]
  );
};

const ensurePostLike = async (db, userId, postId) => {
  await db.execute(
    "INSERT IGNORE INTO forum_post_likes (post_id, user_id, created_at) VALUES (?, ?, NOW())",
    [postId, userId]
  );
};

const ensureNotification = async (db, userIdMap, threadIdMap, postIdMap, notification) => {
  const userId = userIdMap.get(notification.user);
  const actorUserId = notification.actor ? userIdMap.get(notification.actor) : null;
  const threadId = notification.threadKey ? threadIdMap.get(notification.threadKey) || null : null;
  const postId = notification.postKey ? postIdMap.get(notification.postKey) || null : null;
  if (!userId) return;
  const [rows] = await db.execute(
    `SELECT id FROM forum_notifications
     WHERE user_id = ? AND actor_user_id <=> ? AND type = ? AND title = ? AND body = ? AND thread_id <=> ? AND post_id <=> ?
     LIMIT 1`,
    [userId, actorUserId, notification.type, notification.title, notification.body, threadId, postId]
  );
  if (rows.length) {
    await db.execute(
      "UPDATE forum_notifications SET is_read = ?, created_at = ? WHERE id = ?",
      [notification.isRead ? 1 : 0, notification.createdAt, Number(rows[0].id)]
    );
    return;
  }
  await db.execute(
    `INSERT INTO forum_notifications
      (user_id, actor_user_id, type, title, body, thread_id, post_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      actorUserId,
      notification.type,
      notification.title,
      notification.body,
      threadId,
      postId,
      notification.isRead ? 1 : 0,
      notification.createdAt
    ]
  );
};

const ensureModerationLog = async (db, userIdMap, threadIdMap, log) => {
  const threadId = threadIdMap.get(log.threadKey);
  const operatorUserId = userIdMap.get(log.operator);
  if (!threadId || !operatorUserId) return;
  const [rows] = await db.execute(
    `SELECT id FROM forum_moderation_logs
     WHERE thread_id = ? AND operator_user_id = ? AND action = ? AND reason <=> ?
     LIMIT 1`,
    [threadId, operatorUserId, log.action, log.reason]
  );
  if (rows.length) {
    await db.execute(
      "UPDATE forum_moderation_logs SET created_at = ? WHERE id = ?",
      [log.createdAt, Number(rows[0].id)]
    );
    return;
  }
  await db.execute(
    `INSERT INTO forum_moderation_logs (thread_id, operator_user_id, action, reason, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [threadId, operatorUserId, log.action, log.reason, log.createdAt]
  );
};

const recalcThreadStats = async (db, threadIds) => {
  if (!threadIds.length) return;
  const placeholders = threadIds.map(() => "?").join(", ");
  await db.execute(
    `UPDATE forum_posts p
     SET like_count = (SELECT COUNT(*) FROM forum_post_likes l WHERE l.post_id = p.id)
     WHERE p.thread_id IN (${placeholders})`,
    threadIds
  );
  await db.execute(
    `UPDATE forum_threads t
     SET like_count = (SELECT COUNT(*) FROM forum_thread_likes l WHERE l.thread_id = t.id),
         reply_count = (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id AND p.status = 'published'),
         latest_post_at = COALESCE((SELECT MAX(p.created_at) FROM forum_posts p WHERE p.thread_id = t.id AND p.status = 'published'), t.created_at),
         updated_at = COALESCE((SELECT MAX(p.created_at) FROM forum_posts p WHERE p.thread_id = t.id AND p.status = 'published'), t.created_at)
     WHERE t.id IN (${placeholders})`,
    threadIds
  );
};

const main = async () => {
  const db = await getConnection();
  const threadIdMap = new Map();
  const postIdMap = new Map();
  try {
    await db.beginTransaction();
    const sectionIdMap = await findSectionIdMap(db);
    if (!sectionIdMap.size) {
      throw new Error("forum_sections is empty. Start the forum service once before seeding mock data.");
    }

    const userIdMap = new Map();
    for (const user of USERS) {
      userIdMap.set(user.key, await upsertUser(db, user));
    }

    for (const thread of THREADS) {
      const threadId = await upsertThread(db, sectionIdMap, userIdMap, thread);
      threadIdMap.set(thread.key, threadId);
      let floorNo = 1;
      for (const floor of thread.posts) {
        const floorId = await upsertPost(db, userIdMap, threadId, floorNo, null, null, floor);
        if (floor.key) postIdMap.set(floor.key, floorId);
        floorNo += 1;
        for (const child of floor.replies) {
          const childId = await upsertPost(db, userIdMap, threadId, 0, floorId, floorId, child);
          if (child.key) postIdMap.set(child.key, childId);
        }
      }
    }

    for (const thread of THREADS) {
      const threadId = threadIdMap.get(thread.key);
      if (!threadId) continue;
      for (const liker of thread.likes) {
        const userId = userIdMap.get(liker);
        if (userId) {
          await ensureThreadLike(db, userId, threadId);
        }
      }
      for (const floor of thread.posts) {
        if (floor.key && postIdMap.has(floor.key)) {
          for (const liker of floor.likes) {
            const userId = userIdMap.get(liker);
            if (userId) {
              await ensurePostLike(db, userId, postIdMap.get(floor.key));
            }
          }
        }
        for (const child of floor.replies) {
          if (!child.key || !postIdMap.has(child.key)) continue;
          for (const liker of child.likes) {
            const userId = userIdMap.get(liker);
            if (userId) {
              await ensurePostLike(db, userId, postIdMap.get(child.key));
            }
          }
        }
      }
    }

    for (const notification of NOTIFICATIONS) {
      await ensureNotification(db, userIdMap, threadIdMap, postIdMap, notification);
    }

    for (const log of MODERATION_LOGS) {
      await ensureModerationLog(db, userIdMap, threadIdMap, log);
    }

    await recalcThreadStats(db, Array.from(threadIdMap.values()));
    await db.commit();

    const [summaryRows] = await db.execute(
      `SELECT
         (SELECT COUNT(*) FROM web_user_accounts WHERE email LIKE '%_mock@sakura-bot.cn') AS mockUsers,
         (SELECT COUNT(*) FROM forum_threads) AS totalThreads,
         (SELECT COUNT(*) FROM forum_posts) AS totalPosts,
         (SELECT COUNT(*) FROM forum_notifications) AS totalNotifications`
    );
    console.log("Forum mock seed complete.");
    console.table(summaryRows);
    console.log(`Default demo password hash refreshed from seed constant. If you need a visible demo login, set TAIKO_FORUM_MOCK_PASSWORD and rerun the seed.`);
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
