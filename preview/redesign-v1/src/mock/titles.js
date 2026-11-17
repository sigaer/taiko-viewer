// Design V1.3 · 称号（docs/16 A5）。
// 游戏称号的文字取自生产仓库 taiko_viewer/assets/data/title_song_relations.json（origin/main f9b39e6），
// 牌面按 public/game/plate/manifest.json 的「达成类型 × 难度范围」对应。只选关系表里只有一种组合、因此牌面唯一的称号。
// 模拟玩家的 V1.2 称号（user.title）保留给版本 A；版本 B、C 读 user.gameTitle。

// band：放称号文字的那一段（源图像素行，[上, 下)）；art：右侧角色图开始的列（文字不得压上去），没有为 null。
// 数值来自对切片逐行 / 逐列的不透明度与亮度统计：45px 切片整条是牌面；71px 切片上面 26–30 行是透明或角色图，牌面在 30–68 行；
// 自定义牌 556×90 上半是彩色条，下半 44–86 行是米色的名字区。59 / 60 / 61 右侧 467 列起有角色图。
const P = (file, w, h, band, art = null) => ({ src: `game/plate/${file}`, w, h, band, art })

/** 牌面：键 = manifest 的 plateId，或 custom_* 自定义称号的三张牌 */
export const PLATES = {
  0: { ...P('name_plate_0_slice.png', 556, 45, [4, 42]), req: 'clear', scope: 'unspecified' },
  1: { ...P('name_plate_1_slice.png', 556, 45, [4, 42]), req: 'all_perfect', scope: 'unspecified' },
  2: { ...P('name_plate_2_slice.png', 556, 45, [4, 42]), req: 'full_combo', scope: 'unspecified' },
  41: { ...P('name_plate_41_slice.png', 556, 71, [30, 68]), req: 'clear', scope: 'oni' },
  42: { ...P('name_plate_42_slice.png', 556, 71, [30, 68]), req: 'full_combo', scope: 'oni' },
  43: { ...P('name_plate_43_slice.png', 556, 71, [30, 68]), req: 'all_perfect', scope: 'oni' },
  59: { ...P('name_plate_59_slice.png', 556, 71, [30, 68], 467), req: 'clear', scope: 'inner_oni' },
  60: { ...P('name_plate_60_slice.png', 556, 71, [30, 68], 467), req: 'full_combo', scope: 'inner_oni' },
  61: { ...P('name_plate_61_slice.png', 556, 71, [30, 68], 467), req: 'all_perfect', scope: 'inner_oni' },
  custom_sliver: { ...P('name_plate_custom_sliver.png', 556, 90, [44, 86]), req: 'clear', scope: 'custom' },
  custom_gold: { ...P('name_plate_custom_gold.png', 556, 90, [44, 86]), req: 'full_combo', scope: 'custom' },
  custom_rainbow: { ...P('name_plate_custom_rainbow.png', 556, 90, [44, 86]), req: 'all_perfect', scope: 'custom' },
}

/** 8 个手写玩家的游戏称号。null = 没有称号。custom = 玩家自己写的称号文字（自定义牌面） */
export const BASE_GAME_TITLES = {
  mochidon: { name: '最高速の歌姫', plate: 60 },
  hayate: { name: 'きたさいたまの達人', plate: 42 },
  sakura: { name: 'カオスタイムの達人', plate: 2 }, // full_combo × 不限难度（关系表里只有这一种组合）：金色切片
  kumo: { name: 'ばいそくドンだー', plate: 0 },
  rin: { name: 'フルコンボの達人', plate: 2 },
  tako: { name: '手を叩きながら歩いていこう', plate: null }, // full_combo × easy：manifest 里没有这种组合的牌面
  nagi: { name: 'ドドドドドンだフルコンボ！', plate: 61 },
  uta: { name: '博歌乐爱好者', plate: 'custom_rainbow', custom: true },
}

/** 生成玩家按序号轮流取（确定性） */
export const EXTRA_GAME_TITLES = [
  { name: 'わさびの達人', plate: 42 },
  { name: 'たつじんコース', plate: 2 },
  { name: 'さんばいドンだー', plate: 0 },
  { name: 'さんぽの達人', plate: 60 },
  null,
  { name: '黒薔薇の使徒', plate: 42 },
  { name: '歌いながら歩いていこう', plate: null },
  { name: '百獣王者どんちゃん', plate: 2 },
  { name: '戦神', plate: 60 },
  { name: '鼓棒不离手', plate: 'custom_gold', custom: true },
]

/** 素材页的牌面示例：manifest 里每张切片配一个对应组合的真实称号（41 / 43 / 59 只有以曲名命名、分三档的称号，按达成档位取牌面） */
export const PLATE_SAMPLES = [
  { plate: 0, name: 'ばいそくドンだー' },
  { plate: 1, name: '' },
  { plate: 2, name: 'フルコンボの達人' },
  { plate: 41, name: '歌劇「リコレクトブルー」' },
  { plate: 42, name: 'きたさいたまの達人' },
  { plate: 43, name: 'トロいか2000' },
  { plate: 59, name: '宝の丘' },
  { plate: 60, name: '最高速の歌姫' },
  { plate: 61, name: 'ドドドドドンだフルコンボ！' },
  { plate: 'custom_sliver', name: '咚咔平衡者', custom: true },
  { plate: 'custom_gold', name: '鼓棒不离手', custom: true },
  { plate: 'custom_rainbow', name: '博歌乐爱好者', custom: true },
]

/** 站内称号（AccountTitle）：正式站 ANNUAL_BETA_TITLE。原型里挂在一个模拟玩家上 */
export const SITE_TITLE = { key: 'annual-beta-pioneer', name: '虹光先行者', style: 'rainbow' }
export const SITE_TITLE_HOLDER = 'hayate'

/**
 * 称号页的目录（docs/19 G8）：只用 title_song_relations.json 里真实存在的称号；按正式数据有的两个维度分组：
 * 达成类型 req（clear / full_combo / all_perfect）与难度范围 scope（unspecified / oni / inner_oni / easy / normal / hard）。
 * how = 关系表里的 condition_text 原文（正式数据中日文混合，原样显示）。plate = manifest 里这一组合的牌面编号；没有对应时为 null，只显示文字。
 * owned / using 是模拟的玩家状态。
 */
export const TITLE_CATALOG = [
  { id: 1, name: '最高速の歌姫', req: 'full_combo', scope: 'inner_oni', plate: 60, how: '初音ミクの消失‐劇場版‐(裏)をフルコンボ', owned: true, using: true },
  { id: 2, name: 'きたさいたまの達人', req: 'full_combo', scope: 'oni', plate: 42, how: 'きたさいたま2000を難易度おにでフルコンボ', owned: true },
  { id: 3, name: 'わさびの達人', req: 'full_combo', scope: 'oni', plate: 42, how: 'Wasabi Body Blowを難易度おにでフルコンボ', owned: false },
  { id: 4, name: '黒薔薇の使徒', req: 'full_combo', scope: 'oni', plate: 42, how: 'Black Rose Apostleを難易度おにでフルコンボ', owned: false },
  { id: 5, name: 'さんぽの達人', req: 'full_combo', scope: 'inner_oni', plate: 60, how: 'さんぽ(裏)をフルコンボ', owned: true },
  { id: 6, name: '戦神', req: 'full_combo', scope: 'inner_oni', plate: 60, how: 'Xa(裏)をオプション「あべこべ」でフルコンボ', owned: false },
  { id: 7, name: 'ドドドドドンだフルコンボ！', req: 'all_perfect', scope: 'inner_oni', plate: 61, how: '在《全力咚咚咚咚咚！》的“魔王（隐藏）”难度下达成全良连段吧', owned: false },
  { id: 8, name: 'トロいか2000', req: 'all_perfect', scope: 'oni', plate: 43, how: '在《Toro-Ika 2000》的“魔王”难度下达成全良连段吧', owned: false },
  { id: 9, name: '歌劇「リコレクトブルー」', req: 'clear', scope: 'oni', plate: 41, how: '在《歌剧「Recollect Blue」》的“魔王”难度下达成通关吧', owned: true },
  { id: 10, name: '宝の丘', req: 'clear', scope: 'inner_oni', plate: 59, how: '在《宝物之丘》的“魔王（隐藏）”难度下达成通关吧', owned: true },
  { id: 11, name: 'ばいそくドンだー', req: 'clear', scope: 'unspecified', plate: 0, how: '1プレイ中全曲でオプション「ばいそく」を付けてクリア', owned: true },
  { id: 12, name: 'さんばいドンだー', req: 'clear', scope: 'unspecified', plate: 0, how: '1プレイ中全曲でオプション「さんばい」を付けてクリア', owned: false },
  { id: 13, name: 'フルコンボの達人', req: 'full_combo', scope: 'unspecified', plate: 2, how: '在１次游玩中以“全连”通关所有曲目吧', owned: false },
  { id: 14, name: 'たつじんコース', req: 'full_combo', scope: 'unspecified', plate: 2, how: '十露盤2000をフルコンボ', owned: true },
  { id: 15, name: 'カオスタイムの達人', req: 'full_combo', scope: 'unspecified', plate: 2, how: '用任意难度在《!!!Chaos Time!!!》中达成全连吧', owned: false },
  { id: 16, name: '手を叩きながら歩いていこう', req: 'full_combo', scope: 'easy', plate: null, how: '在《4+1的各自的未来》的“简单”难度下达成全连吧', owned: true },
  { id: 17, name: '歌いながら歩いていこう', req: 'full_combo', scope: 'normal', plate: null, how: '在《4+1的各自的未来》的“一般”难度下达成全连吧', owned: false },
  { id: 18, name: '支え合いながら歩いていこう', req: 'full_combo', scope: 'hard', plate: null, how: '在《4+1的各自的未来》的“困难”难度下达成全连吧', owned: false },
]
export const TITLE_REQ = [
  { key: 'clear', zh: '通关', ja: 'クリア' },
  { key: 'full_combo', zh: '全连', ja: 'フルコンボ' },
  { key: 'all_perfect', zh: '全良', ja: '全良' },
]
export const TITLE_SCOPE = [
  { key: 'unspecified', zh: '不限难度', ja: '難易度指定なし' },
  { key: 'oni', zh: '魔王', ja: 'おに' },
  { key: 'inner_oni', zh: '魔王（里）', ja: 'おに（裏）' },
  { key: 'hard', zh: '困难', ja: 'むずかしい' },
  { key: 'normal', zh: '普通', ja: 'ふつう' },
  { key: 'easy', zh: '简单', ja: 'かんたん' },
]
