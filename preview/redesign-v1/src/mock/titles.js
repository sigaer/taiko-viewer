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
