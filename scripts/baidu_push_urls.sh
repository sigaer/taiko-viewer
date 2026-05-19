#!/usr/bin/env bash
# 向百度普通收录接口主动推送 sitemap 中的 URL（每批最多 2000 条）
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/baidu_push_urls.sh

环境变量（或 deploy/baidu-push.env）:
  BAIDU_PUSH_SITE          已验证站点，默认 https://viewer.sakura-bot.cn
  BAIDU_PUSH_TOKEN         推送准入密钥（必填）
  BAIDU_PUSH_SITEMAP_URL   sitemap 地址，默认同站点 /sitemap.xml
  BAIDU_PUSH_BATCH_SIZE    每批条数，默认 2000
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/deploy/baidu-push.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

BAIDU_PUSH_SITE="${BAIDU_PUSH_SITE:-https://viewer.sakura-bot.cn}"
BAIDU_PUSH_SITEMAP_URL="${BAIDU_PUSH_SITEMAP_URL:-${BAIDU_PUSH_SITE%/}/sitemap.xml}"
BAIDU_PUSH_BATCH_SIZE="${BAIDU_PUSH_BATCH_SIZE:-2000}"
BAIDU_PUSH_TOKEN="${BAIDU_PUSH_TOKEN:-}"
# 百度推送接口的 site 参数需为已验证域名（不含协议），与站长平台示例 URL 不同
BAIDU_PUSH_API_SITE="${BAIDU_PUSH_API_SITE:-$(
  python3 -c 'from urllib.parse import urlparse; import sys; u=urlparse(sys.argv[1]); print(u.netloc or sys.argv[1])' "$BAIDU_PUSH_SITE"
)}"

if [[ -z "$BAIDU_PUSH_TOKEN" ]]; then
  echo "跳过百度推送：未设置 BAIDU_PUSH_TOKEN（可复制 deploy/baidu-push.env.example 为 deploy/baidu-push.env）"
  exit 0
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

echo "拉取 sitemap: $BAIDU_PUSH_SITEMAP_URL"
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  curl --noproxy '*' -fsS "$BAIDU_PUSH_SITEMAP_URL" \
  | sed -n 's:.*<loc>\([^<]*\)</loc>.*:\1:p' \
  | sort -u >"$tmpdir/urls-all.txt"

total="$(wc -l <"$tmpdir/urls-all.txt" | tr -d ' ')"
if [[ "$total" -eq 0 ]]; then
  echo "错误：sitemap 中未解析到任何 URL"
  exit 1
fi

echo "共 $total 条 URL，按每批 $BAIDU_PUSH_BATCH_SIZE 条推送至百度..."

split -l "$BAIDU_PUSH_BATCH_SIZE" -d -a 4 "$tmpdir/urls-all.txt" "$tmpdir/batch-"

encoded_site="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$BAIDU_PUSH_API_SITE")"
api_url="http://data.zz.baidu.com/urls?site=${encoded_site}&token=${BAIDU_PUSH_TOKEN}"
echo "推送站点标识: $BAIDU_PUSH_API_SITE"

batch_index=0
pushed=0
for batch_file in "$tmpdir"/batch-*; do
  [[ -f "$batch_file" ]] || continue
  batch_index=$((batch_index + 1))
  batch_count="$(wc -l <"$batch_file" | tr -d ' ')"

  echo "  批次 ${batch_index}: ${batch_count} 条..."
  http_code="$(
    env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
      curl --noproxy '*' -sS \
      -H 'Content-Type:text/plain' \
      --data-binary @"$batch_file" \
      -o "$tmpdir/response.json" \
      -w '%{http_code}' \
      "$api_url"
  )"
  response="$(cat "$tmpdir/response.json")"
  echo "    百度返回 (HTTP ${http_code}): $response"

  if [[ "$http_code" != "200" ]]; then
    if grep -q 'over quota' "$tmpdir/response.json"; then
      echo "  - 已达百度当日推送配额，请次日再运行本脚本，或到站长平台查看剩余额度。"
      break
    fi
    echo "  - 百度推送失败，已停止后续批次。"
    exit 1
  fi

  success_count="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("success", 0))' "$tmpdir/response.json" 2>/dev/null || echo 0)"
  pushed=$((pushed + success_count))
done

echo "百度推送完成：百度确认成功 $pushed 条（sitemap 共 $total 条，超额部分请改日再推）"
