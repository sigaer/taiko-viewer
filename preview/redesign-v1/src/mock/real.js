// Design V1.3 · 真实曲目集（数据集 `real`，见 docs/16 A8）与曲绘白名单（A1）。
//
// 曲号与曲名只取自生产仓库 main:tests/fixtures/annual-summary.sample.json 的 songNo / songName / songNameJa，
// 那份文件里的其他内容一律不进原型。成绩、王冠、评价、定数、帖子内容仍是确定性生成的模拟数据。
// 50 首里 44 首的 200px 缩略图 HEAD 返回 200；1255、345、32、1323、395、1324 返回 404（加载时退回原图，再退回缺失占位）。

/** [曲号, 日文名, 中文名] */
export const REAL_PAIRS = [
  [851, '気焔万丈神楽', '气焰万丈神乐'],
  [138, 'Scars of FAUNA', 'Scars of FAUNA'],
  [154, 'Garakuta Doll Play', 'Garakuta Doll Play'],
  [1308, 'GIGALODOON', 'GIGALODOON'],
  [484, 'マジで…！？', 'Magic day...!?'],
  [1060, 'YONA YONA DANCE', 'YONA YONA DANCE'],
  [816, '星屑ストラック', 'Struck Stardust'],
  [118, 'さちさちにしてあげる♪', 'さちさちにしてあげる♪'],
  [1197, 'Re ： End of a Dream', 'Re ： End of a Dream'],
  [1351, '蛇鉄', '蛇铁'],
  [1053, '平等院鳳凰ドン vs 鳥獣戯カッ', '平等院凤凰咚 vs 鸟兽戏咔'],
  [10, '3piece-JazzParty！', '3piece-JazzParty!'],
  [1104, 'Aragami', 'Aragami'],
  [410, '天妖ノ舞', '天妖ノ舞'],
  [766, 'シンクロニシティ', 'Synchronicity'],
  [514, '聖徳たいこの「日いずるまで飛鳥」', '圣德太鼓的「日出为止飞鸟」'],
  [438, 'ウルトラマンギンガの歌', '银河奥特曼之歌'],
  [1188, '逆戦 NI ZHAN', '逆战'],
  [231, '限界突破×サバイバー', '限界突破×Survivor'],
  [857, 'サクラ・シークレット', 'Sakura Secret'],
  [413, 'Bad Apple!! feat.nomico', 'Bad Apple!! feat.nomico'],
  [971, '星河一天', '星河一天'],
  [360, 'Angel Halo', 'Angel Halo'],
  [402, 'Rotter Tarmination', 'Rotter Tarmination'],
  [106, 'Day by Day！', 'Day by Day!'],
  [179, 'はたラク2000', '工作2000'],
  [396, 'super star shooter', 'super star shooter'],
  [615, '天狗囃子', '天狗配乐'],
  [566, '凛', '凛'],
  [635, '須佐之男', '须佐之男'],
  [1057, 'ウサテイ', 'USATEI'],
  [1379, 'Valsqotch', 'Valsqotch'],
  [716, '彼は誰時の誘惑', 'KAHATAREDOKI NO YUUWAKU'],
  [1102, '俺こそオンリーワン', 'Orekoso Only One'],
  [833, 'Goldfish City', 'Goldfish City'],
  [751, 'シャイニング☆アブラカタブラ', 'SHINING☆ABRACADABRA'],
  [1255, '電脳幻夜の星言詠', '电脑幻夜之星言咏唱'],
  [914, 'シンクロニカ・エアライン', 'Synchronica Airline'],
  [1412, '案山子姫 -Princess Scarecrow-', 'Kakashi-Hime: Princess Scarecrow'],
  [345, 'ラーメン de Yo‐Men!!', '拉面 德 呦-面!!'],
  [1413, 'ピッチフェイダ', 'pitchfader'],
  [32, 'アレキサンダーのテーマ', '亚历山大 主题曲'],
  [997, 'twinkle night (feat. somunia)', 'twinkle night (feat. somunia)'],
  [504, 'Abyss of hell', 'Abyss of hell'],
  [1323, '女神な世界 Ⅲ', '女神的世界 III'],
  [395, 'junction', 'junction'],
  [1324, 'イオシス秋の爆食祭2024', 'IOSYS Autumn Voracious Festival 2024'],
  [1085, '弧', '弧'],
  [714, 'OK I’m blue rat', "OK I'm blue rat"],
  [702, '懐中庭園を持つ少女', '拥有手中庭园的少女'],
]

/** `full` / `demo` 里能显示真实曲绘的精选曲：ID 与曲名在仓库里有依据（docs/14 第 4 节「已验证」）。 */
export const VERIFIED_CURATED = [615, 438, 816, 851, 1255, 1351, 1412, 971, 179, 1053, 345, 1188]

/**
 * `real` 数据集里，V1.2 精选曲中未验证的 18 首各借用一个真实曲号与曲名（只借身份；星级、定数、成绩等模拟值沿用原行），
 * 这样页面上原本指向这些曲目的成绩、目标、帖子仍然成立，而文字里的曲名换成与曲绘一致的那首。
 * 旧 ID → 新 ID
 */
export const REAL_REMAP = {
  233: 413,
  512: 1308,
  88: 410,
  278: 1104,
  960: 504,
  41: 106,
  702: 702,
  1290: 1379,
  100140: 138,
  100138: 1197,
  100136: 154,
  100130: 635,
  100120: 1060,
  100126: 766,
  100128: 514,
  100039: 857,
  100052: 231,
  100066: 118,
}

/** 手写文字里出现的曲名简写（全名由 data.js 按原行自动替换）。 */
export const REAL_SHORT_NAMES = [
  // 先处理一句话里提到两首歌的地方：只留下旁边有曲绘的那一首
  ['现在千本桜鬼能稳定通关，但红莲华一到副歌就乱', '现在鬼 ★7 能稳定通关，但{702}一到副歌就乱'],
  ['白鳥の湖', '{88}'],
  ['千本桜', '{233}'],
  ['千本樱', '{233zh}'],
  ['红莲华', '{702zh}'],
]
