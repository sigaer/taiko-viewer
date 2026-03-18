#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy_forum_web.sh "<commit_message>"

Example:
  ./scripts/deploy_forum_web.sh "0.9.6 修复称号页滚动并更新称号数据"
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

COMMIT_MESSAGE="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/taiko_frontend_back"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"

run_privileged() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

cd "$ROOT_DIR"

echo "[1/5] 提交并推送代码..."
HAS_CHANGES=0
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  HAS_CHANGES=1
fi

if [[ "$HAS_CHANGES" -eq 1 ]]; then
  git add -A
  if git diff --cached --quiet; then
    echo "  - 没有可提交内容，跳过提交。"
  else
    git commit -m "$COMMIT_MESSAGE"
    git push "$REMOTE" "$BRANCH"
  fi
else
  echo "  - 工作区无变更，跳过提交推送。"
fi

echo "[2/5] 安装依赖（按需）..."
NEED_NPM_INSTALL=0
if [[ ! -d "$WEB_DIR/node_modules" ]]; then
  NEED_NPM_INSTALL=1
fi
if git show --name-only --pretty='' HEAD | grep -Eq '^taiko_frontend_back/(package\.json|package-lock\.json)$'; then
  NEED_NPM_INSTALL=1
fi

if [[ "$NEED_NPM_INSTALL" -eq 1 ]]; then
  (cd "$WEB_DIR" && npm install)
else
  echo "  - 依赖无变化，跳过 npm install。"
fi

echo "[3/5] 构建 Nuxt..."
echo "  - 开始构建，这可能需要 2-5 分钟，请耐心等待..."
pushd "$WEB_DIR" > /dev/null
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
BUILD_EXIT=$?
popd > /dev/null
if [ $BUILD_EXIT -ne 0 ]; then
  echo "  - 构建失败 (exit code: $BUILD_EXIT)"
  exit 1
fi

echo "[4/5] 重载服务..."
run_privileged systemctl daemon-reload
run_privileged nginx -t
run_privileged systemctl reload nginx
run_privileged systemctl restart taiko-forum taiko-viewer
run_privileged systemctl is-active taiko-forum taiko-viewer

echo "[5/5] 健康检查..."
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  curl --noproxy '*' -fsS "http://127.0.0.1:3101/titles" >/dev/null
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  curl --noproxy '*' -fsS "https://forum.sakura-bot.cn/titles" >/dev/null

echo "部署完成: 代码已推送并发布到 forum.sakura-bot.cn"
