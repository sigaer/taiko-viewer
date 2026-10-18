// Static documentation only. No credentials, account state or network requests.
export const developerApiOrigin = 'https://viewer.sakura-bot.cn';
export const dimensionKeys = ['big_song', 'stamina', 'speed', 'accuracy_power', 'rhythm', 'complex'] as const;
type Text = { zh: string; ja: string };
const text = (zh: string, ja: string): Text => ({ zh, ja });
type Field = { name: string; type: string; description: Text };
const field = (name: string, type: string, zh: string, ja: string): Field => ({ name, type, description: text(zh, ja) });
const revision = '0'.repeat(64);
const versions = { contractVersion: '1.1', schemaRevision: revision, catalogRevision: revision, scoreRevision: null, calculationProfile: null, observationSource: null, capturedAt: null };
const analysisFields = [
  field('playerId', 'string', '本次请求的太鼓 Source ID；不是网站账号 ID。', 'リクエストした太鼓 Source ID。Viewer アカウント ID ではありません。'),
  field('scoreRevision', 'string', 'songs 与 _meta 的 SHA-256 摘要；用于识别本次计算使用的数据。', '計算対象の songs と _meta の SHA-256 ダイジェスト。'),
  field('model', 'string', '当前为 v1，是计算模型标识，不是应用或 Contract 版本。', '現在は v1。計算モデルの識別子で、アプリや Contract のバージョンとは別です。')
];
export const developerApis = [
  {
    id: 'userdata', path: '/api/developer/userdata/{userid}', protected: true, timeout: 20,
    name: text('当前成绩', '現在スコア'),
    purpose: text('读取玩家当前存档，用于成绩展示与自定义统计。', '現在のプレイヤーデータを読み取り、成績表示や独自集計に利用できます。'),
    note: text('只读当前数据，不提供成长历史、年度报告、同步或写入。响应保留来源数据的结构；以下 JSON 是合成示例，不是所有 Source 的固定字段模板。', '現在データの読み取り専用です。成長履歴・年間レポート・同期・書き込みは含みません。元データの構造を維持します。以下の JSON は合成例で、全 Source 共通の固定形式ではありません。'),
    fields: [
      field('profile', 'JSON (optional)', '个人资料，来源决定内部字段；可能缺省或为 null。', 'プロフィール。内部フィールドはデータソースに依存し、省略や null の場合があります。'),
      field('songs', 'JSON (usually array)', '歌曲成绩记录；常见 song_no、level、high_score 等字段可能随来源变化。', '曲別スコア。通常は配列で、song_no・level・high_score などの有無はデータソースに依存します。'),
      field('achievement', 'JSON (optional)', '成就数据，保留来源结构；可缺省或为 null。', '実績データ。元の構造を保持し、省略や null の場合があります。'),
      field('dojo', 'JSON (optional)', '段位数据，保留来源结构；可缺省或为 null。', '段位データ。元の構造を保持し、省略や null の場合があります。'),
      field('_meta', 'JSON (optional)', '来源与时间等元数据。上述五个顶层字段仅在原始数据存在时返回；敏感键会递归过滤，不补空对象或数组。', '取得元や時刻などのメタデータ。これらの 5 フィールドは元データにある場合のみ返り、機密キーを再帰的に除去します。空のオブジェクトや配列で補完しません。')
    ],
    example: { profile: { mydon_name: 'Synthetic Player' }, songs: [{ song_no: 10001, level: 4, high_score: 900000 }], achievement: null, dojo: [], _meta: { source: 'manual', ts: '2026-01-01T00:00:00Z' } },
    errors: text('400 参数无效；401 Token 无效或已撤销；403 无读取权限；404 Source 或数据不存在；429 当日调用限额；503 数据暂不可用。', '400 パラメーター不正、401 Token 無効・失効、403 権限不足、404 Source・データなし、429 日次制限、503 データが一時的に利用不可。')
  },
  {
    id: 'catalog', path: '/api/v1/taiko/catalog/songs', protected: false, timeout: 20,
    name: text('歌曲目录与别名', '楽曲カタログ・別名'),
    purpose: text('查询歌曲 ID、中日原始曲名与别名，用于搜索和成绩关联。', '曲 ID・中国語／日本語の元の曲名・別名を取得し、検索やスコアとの照合に使えます。'),
    note: text('公开请求不发送 Authorization。主动附带的 Bearer Token 仍会被验证，无效时不会自动降级为匿名读取。别名已包含在本响应中；没有独立 aliases 接口。曲库不包含谱面成绩。', '公開リクエストには Authorization を付けません。付けた Bearer Token は検証され、無効でも匿名アクセスには切り替わりません。別名はこの応答に含まれ、独立した aliases API はありません。スコアは含みません。'),
    fields: [
      field('versions', 'object', 'contractVersion 当前为 1.1；schemaRevision 与 catalogRevision 是摘要。scoreRevision、calculationProfile、observationSource、capturedAt 在此接口均为 null。Contract 1.1 仍为候选状态。', 'contractVersion は現在 1.1。schemaRevision・catalogRevision はダイジェストです。scoreRevision・calculationProfile・observationSource・capturedAt は null。Contract 1.1 は引き続き候補状態です。'),
      field('items', 'array<object>', '完整有界目录，无分页或筛选参数。', '件数が制限された全件カタログ。ページ分割や絞り込みパラメーターはありません。'),
      field('items[].songId', 'string', '歌曲 ID。与分析接口的数字 songId 类型不同。', '曲 ID。分析 API の数値 songId とは型が異なります。'),
      field('items[].song_name / song_name_jp', 'string | null', '中文／日文原始曲名；缺失时为 null，不生成翻译。', '中国語／日本語の元の曲名。欠損時は null で、翻訳を生成しません。'),
      field('items[].aliases', 'array<string>', '已有别名；没有别名时为 []。', '登録済みの別名。ない場合は []。'),
      field('items[].catalogRevision', 'string', '与 versions.catalogRevision 对应，联合覆盖曲名元数据与别名数据。', 'versions.catalogRevision と対応し、楽曲メタデータと別名データの両方を対象にします。'),
      field('items[].availability', 'object', 'region 为 CN、JP 或 UNKNOWN；status 为 active、removed 或 unknown，不推断缺失地区。', 'region は CN・JP・UNKNOWN、status は active・removed・unknown。不明な地域を推測しません。')
    ],
    example: { versions, items: [{ songId: '10001', song_name: '合成歌曲', song_name_jp: null, aliases: [], catalogRevision: revision, availability: { region: 'UNKNOWN', status: 'active' } }] },
    errors: text('400 不支持的查询参数；401 主动附带的 Token 无效；404 接口未开放；429 日次限流（RATE_LIMITED）；503 曲库或服务暂不可用。错误体为 code、message、requestId。', '400 未対応のクエリ、401 付与した Token が無効、404 API 無効、429 日次制限（RATE_LIMITED）、503 カタログ・サービス一時利用不可。エラー本文は code・message・requestId です。')
  },
  {
    id: 'rating', path: '/api/developer/userdata/{userid}/rating', protected: true, timeout: 90,
    name: text('Rating 与六维', 'Rating・六次元'),
    purpose: text('基于当前成绩计算综合 Rating、六维与高 Rating 谱面详情。', '現在スコアから総合 Rating・六次元と高 Rating 譜面の詳細を計算します。'),
    note: text('最多返回 30 个谱面详情，按谱面 rating 降序。这不代表综合 Rating 是这 30 项的平均值。聚合复用现有模型：topN 当前为 20，六维分别聚合，综合值使用自身的聚合规则。没有独立 B30 路径或可调查询参数。', '詳細は譜面 rating の降順で最大 30 件。総合 Rating がこの 30 件の平均という意味ではありません。既存モデルの集計を使用し、topN は現在 20。各次元と総合値はそれぞれの規則で集計します。独立 B30 パスや調整用クエリはありません。'),
    fields: [...analysisFields,
      field('overallRating', 'number | null', '综合 Rating；没有正的综合结果时为 null。', '総合 Rating。正の結果がない場合は null。'),
      field('dimensions', 'array<{key: string, value: number}>', '固定六维键：big_song（大曲）、stamina（体力）、speed（速度）、accuracy_power（准度）、rhythm（节奏）、complex（复杂度）。空样本时各值为 0。', '六次元のキー：big_song（大曲）・stamina（体力）・speed（速度）・accuracy_power（精度）・rhythm（リズム）・complex（複雑度）。サンプルなしでは各値は 0。'),
      field('sampleCount', 'integer', '参与计算的有效成绩样本数，不是 topSongsCount。', '計算に使った有効なスコアサンプル数。topSongsCount とは別です。'),
      field('aggregation / topN / duplicateHandling', 'string / integer / string', '当前为 per-dimension-top20 / 20 / preserve；保留重复版本样本。以响应值识别聚合方式。', '現在は per-dimension-top20 / 20 / preserve。重複バージョンのサンプルを保持します。応答値で集計方式を確認してください。'),
      field('topSongs / topSongsCount', 'array<object> / integer', '最多 30 项及实际返回数；可能为空数组和 0。', '最大 30 件と実際の返却件数。空配列・0 の場合があります。'),
      field('topSongs[]', 'object', 'songId、level 为整数，title 为字符串（仍保留，可为 ""），rating 为数字；dimensions 为六维键到数字的对象，不是上方的数组。', 'songId・level は整数、title は文字列（引き続き存在し、空文字の場合あり）、rating は数値。dimensions は六次元キーから数値へのオブジェクトで、上記の配列とは異なります。')
    ],
    example: { playerId: 'SYNTHETIC_SOURCE', scoreRevision: revision, model: 'v1', aggregation: 'per-dimension-top20', topN: 20, duplicateHandling: 'preserve', overallRating: null, sampleCount: 0, dimensions: dimensionKeys.map(key => ({ key, value: 0 })), topSongs: [], topSongsCount: 0 },
    errors: text('400 参数无效；401 Token 无效或已撤销；403 无读取权限；404 数据不存在；429 当日调用限额；503 包括 ANALYSIS_BUSY、数据变化、计算超时或数据不可用。网关可能返回 502 / 504。', '400 パラメーター不正、401 Token 無効・失効、403 権限不足、404 データなし、429 日次制限、503 ANALYSIS_BUSY・計算中のデータ変更・計算タイムアウト・データ利用不可。ゲートウェイが 502 / 504 を返す場合もあります。')
  },
  {
    id: 'recommendations', path: '/api/developer/userdata/{userid}/recommendations', protected: true, timeout: 90,
    name: text('推荐游玩谱面', 'おすすめ譜面'),
    purpose: text('基于当前成绩取得普通 Rating 推荐列表，用于安排下一次游玩。', '現在スコアに基づく通常の Rating おすすめ一覧を取得し、次に遊ぶ譜面を選べます。'),
    note: text('最多 20 项，保留算法排序：优先严格范围内的未玩／已玩候选，再按现有分组规则补足；不是按某个返回字段全局排序。可为空或不足 20 项。没有数量、六维等查询选项，也不返回推荐理由或预计提升分数。', '最大 20 件。厳密範囲内の未プレイ／プレイ済み候補を優先し、既存のグループ規則で補充した順序を保持します。単一フィールドの全体ソートではありません。0 件や 20 件未満の場合もあります。件数・次元などの指定や、推薦理由・予想上昇量の返却はありません。'),
    fields: [...analysisFields,
      field('basis', 'string', '当前固定为 rating。', '現在は rating 固定。'),
      field('items', 'array<object>', '已排序的推荐谱面，最多 20 个。', '順序付きのおすすめ譜面。最大 20 件。'),
      field('items[].songId / level / title', 'integer / integer / string', '歌曲 ID、难度档位与显示曲名（可为 ""）。', '曲 ID・難易度区分・表示曲名（空文字の場合あり）。'),
      field('items[].isUnplayed', 'boolean', '候选在本次合并重复版本后的成绩样本中没有游玩记录。', '重複バージョンをまとめた今回のスコアサンプルにプレイ記録がない候補。'),
      field('items[].candidateIndicator / referenceIndicator', 'number / number', '候选谱面指标与个人 Rating 前 20 样本对应谱面指标的中位数；不是预计得分或提升分数。', '候補譜面の指標と個人 Rating 上位 20 サンプルに対応する譜面指標の中央値。予想スコアや上昇量ではありません。'),
      field('items[].deviationRatio', 'number', '(候选指标 − 参考指标) / 参考指标的比例；0.05 表示 +5%，不是数值 5。输出经过舍入。', '（候補指標 − 参照指標）/ 参照指標の比率。0.05 は +5% を表します。返却値は丸められます。'),
      field('items[].inStrictRange', 'boolean', '候选指标处于参考指标的 90%～105% 范围内。', '候補指標が参照指標の 90%～105% に入るかどうか。')
    ],
    example: { playerId: 'SYNTHETIC_SOURCE', scoreRevision: revision, model: 'v1', basis: 'rating', items: [{ songId: 10001, level: 4, title: 'Synthetic Song', isUnplayed: true, candidateIndicator: 10.5, referenceIndicator: 10, deviationRatio: 0.05, inStrictRange: true }] },
    errors: text('400 参数无效；401 Token 无效或已撤销；403 无读取权限；404 数据不存在；429 当日调用限额；503 包括 ANALYSIS_BUSY、数据变化、计算超时或数据不可用。网关可能返回 502 / 504。', '400 パラメーター不正、401 Token 無効・失効、403 権限不足、404 データなし、429 日次制限、503 ANALYSIS_BUSY・計算中のデータ変更・計算タイムアウト・データ利用不可。ゲートウェイが 502 / 504 を返す場合もあります。')
  }
] as const;
export type DeveloperApi = typeof developerApis[number];

export function developerApiExamples(api: DeveloperApi) {
  const curlUrl = developerApiOrigin + api.path.replace('{userid}', '${TAIKO_SOURCE_ID:?Set TAIKO_SOURCE_ID}');
  const curl = [
    ...(api.protected ? ['export TAIKO_SOURCE_ID=\'YOUR_SOURCE_ID\''] : []),
    `curl --fail-with-body --connect-timeout 5 --max-time ${api.timeout} \\`,
    ...(api.protected ? ['  -H "Authorization: Bearer ${TAIKO_VIEWER_DEVELOPER_TOKEN:?Set TAIKO_VIEWER_DEVELOPER_TOKEN}" \\'] : []),
    `  "${curlUrl}"`
  ].join('\n');
  const python = [
    ...(api.protected ? ['import os', 'from urllib.parse import quote'] : []),
    'import json', 'import requests', '',
    ...(api.protected ? [
      'source_id = os.environ["TAIKO_SOURCE_ID"]',
      'token = os.environ["TAIKO_VIEWER_DEVELOPER_TOKEN"]',
      'source_id = quote(source_id, safe="")'
    ] : []),
    `url = ${api.protected ? 'f' : ''}"${developerApiOrigin + api.path.replace('{userid}', '{source_id}')}"`,
    'try:',
    '    response = requests.get(', '        url,',
    ...(api.protected ? ['        headers={"Authorization": f"Bearer {token}"},'] : []),
    `        timeout=(5, ${api.timeout}),`,
    '    )', '    response.raise_for_status()',
    'except requests.HTTPError as error:',
    '    status = error.response.status_code',
    '    raise SystemExit(f"HTTP {status}: check authentication, permissions or service limits") from None',
    'except requests.RequestException:',
    '    raise SystemExit("Network error or timeout; do not retry in parallel") from None',
    'try:', '    data = response.json()',
    'except ValueError:', '    raise SystemExit("Response is not JSON") from None',
    'print(json.dumps(data, ensure_ascii=False, indent=2))'
  ].join('\n');
  return { curl, python, json: JSON.stringify(api.example ?? {}, null, 2) };
}

export const developerGuideCopy = {
  zh: {
    title: '可用 API 与接入指南', public: '公开 · 无需 Token', protected: '需要 Developer Token',
    requiresApproval: '受保护接口需要先申请开发者权限并获批，再使用有效的 Developer Token。',
    inactive: '当前没有有效 Token。请联系管理员处理后再调用受保护接口。',
    active: 'Token 使用指南',
    tokenHelp: '从审批邮件保存完整 Token；本页仅显示掩码，不会再次显示完整密钥。遗失时请联系管理员。',
    setup: '受保护示例：将 YOUR_... 替换为自己的值，在本机环境中设置以下变量。公开曲库无需设置 Token。Python 依赖：python -m pip install requests。',
    params: '参数', sourceParam: '{userid}：太鼓 Source ID，不是 Viewer 网站账号 ID。无查询参数。', noParams: '无路径参数或查询参数；一次返回完整有界目录。',
    fields: '关键返回字段', field: '字段', type: '类型', meaning: '含义', examples: '调用示例与响应',
    curl: 'cURL', python: 'Python', json: '合成 JSON 示例', errors: '错误处理', copy: '复制', copied: '已复制示例代码', copyFailed: '复制失败，请手动选中代码复制',
    common: '鉴权、安全与调用限制',
    safety: '通过 HTTPS 在 Authorization: Bearer 中发送有效 Developer Token；不要放入 URL、前端脚本、公开仓库或日志。示例不需要浏览器 Cookie。这里只提供只读接口。',
    quota: '受保护的三个接口共用 developer_userdata 日次额度，曲库使用另一套日次计数；实际额度由服务配置决定。收到 429 后暂停调用，按响应及额度重置情况处理，不要立即循环重试。当前不保证返回 Retry-After。',
    busy: 'Rating 与推荐共享单分析任务容量，应串行请求。503 可能表示繁忙、数据变化或计算失败；稍后有限次数退避重试，持续失败时联系维护者。Worker 期限为 60 秒，当前 API 网关读取超时为 60 秒；示例客户端读取等待 90 秒，但不能保证服务完成，也不能避免网关 504。',
    cache: '200 返回 JSON。携带 If-None-Match 命中时可返回无正文的 304，此时不要解析 JSON；受保护接口仍检查权限，分析计算也可能照常执行。曲库响应为 public 缓存，个人响应为 private，请勿共享个人缓存。',
    version: 'API 路径 v1、计算模型 v1、Contract 1.1 与网站发布版本各自独立。Contract 1.1 仍为候选状态。'
  },
  ja: {
    title: '利用可能な API・接続ガイド', public: '公開 · Token 不要', protected: 'Developer Token が必要',
    requiresApproval: '保護された API は開発者申請の承認後、有効な Developer Token で利用してください。',
    inactive: '有効な Token がありません。保護された API の利用前に管理者へお問い合わせください。',
    active: 'Token の使い方',
    tokenHelp: '承認メールの完全な Token を保存してください。この画面ではマスクのみ表示し、全文を再表示しません。紛失時は管理者へお問い合わせください。',
    setup: '保護された API の例：YOUR_... を自分の値に置き換え、ローカル環境に以下の変数を設定します。公開カタログに Token は不要です。Python 依存：python -m pip install requests。',
    params: 'パラメーター', sourceParam: '{userid} は太鼓 Source ID で、Viewer アカウント ID ではありません。クエリパラメーターはありません。', noParams: 'パス・クエリパラメーターはありません。件数が制限された全件カタログを返します。',
    fields: '主なレスポンスフィールド', field: 'フィールド', type: '型', meaning: '意味', examples: 'リクエスト・レスポンス例',
    curl: 'cURL', python: 'Python', json: '合成 JSON 例', errors: 'エラー処理', copy: 'コピー', copied: 'サンプルをコピーしました', copyFailed: 'コピーできませんでした。コードを選択してコピーしてください。',
    common: '認証・安全性・利用制限',
    safety: 'HTTPS の Authorization: Bearer で有効な Developer Token を送信します。URL・ブラウザースクリプト・公開リポジトリ・ログに含めないでください。ブラウザー Cookie は不要です。これらは読み取り専用 API です。',
    quota: '保護された 3 API は developer_userdata の日次枠を共有し、カタログは別の日次カウントを使います。上限はサービス設定によります。429 を受けたら呼び出しを停止し、応答と枠のリセット状況を確認してください。即時ループ再試行は避けてください。Retry-After の返却は保証されません。',
    busy: 'Rating とおすすめは単一の分析枠を共有します。直列で呼び出してください。503 は混雑・データ変更・計算失敗などを示します。間隔を空けて有限回のみ再試行し、続く場合は管理者に連絡してください。Worker 期限と現在の API ゲートウェイ読み取りタイムアウトは共に 60 秒です。例のクライアント読み取り待機は 90 秒ですが、完了やゲートウェイ 504 の回避を保証しません。',
    cache: '200 は JSON を返します。If-None-Match が一致すると本文のない 304 になるため JSON として読まないでください。保護された API の権限確認は継続し、分析計算も通常どおり行われる場合があります。カタログは public、個人応答は private キャッシュです。個人キャッシュを共有しないでください。',
    version: 'API パス v1・計算モデル v1・Contract 1.1・サイトのリリース版は別の識別子です。Contract 1.1 は引き続き候補状態です。'
  }
} as const;
