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
WEB_DIR="$ROOT_DIR/taiko_viewer"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
BUILD_TIMEOUT="${BUILD_TIMEOUT:-900}"
HEALTHCHECK_TIMEOUT="${HEALTHCHECK_TIMEOUT:-20}"

run_privileged() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

cleanup_process_group() {
  local group_pid="${1:-}"
  if [[ -z "$group_pid" ]]; then
    return 0
  fi

  if kill -0 "$group_pid" 2>/dev/null; then
    kill -TERM -- "-$group_pid" 2>/dev/null || true
    sleep 2
  fi

  if kill -0 "$group_pid" 2>/dev/null; then
    kill -KILL -- "-$group_pid" 2>/dev/null || true
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local deadline=$((SECONDS + HEALTHCHECK_TIMEOUT))

  while true; do
    if env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
      curl --noproxy '*' --max-time 5 -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi

    if (( SECONDS >= deadline )); then
      echo "  - ${label} 健康检查超时（>${HEALTHCHECK_TIMEOUT}s）: ${url}"
      env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
        curl --noproxy '*' --max-time 5 -fsS "$url" >/dev/null
      return 1
    fi

    sleep 1
  done
}

build_artifact_is_fresh() {
  local artifact_path="$1"
  local start_epoch="$2"

  if [[ ! -f "$artifact_path" ]]; then
    return 1
  fi

  local artifact_epoch
  artifact_epoch="$(stat -c %Y "$artifact_path" 2>/dev/null || echo 0)"
  [[ "$artifact_epoch" -ge "$start_epoch" ]]
}

run_nuxt_build() {
  local build_log
  local build_pid
  local tail_pid
  local build_start_epoch
  local build_deadline
  local build_exit=0
  local build_artifact="$WEB_DIR/.output/server/index.mjs"

  build_log="$(mktemp)"
  build_start_epoch="$(date +%s)"
  build_deadline=$((SECONDS + BUILD_TIMEOUT))

  pushd "$WEB_DIR" > /dev/null
  export NODE_OPTIONS="--max-old-space-size=4096"

  WEB_DIR="$WEB_DIR" setsid bash -lc 'cd "$WEB_DIR" && npm run build' >"$build_log" 2>&1 &
  build_pid=$!

  tail --pid="$build_pid" -n +1 -f "$build_log" &
  tail_pid=$!

  while kill -0 "$build_pid" 2>/dev/null; do
    if grep -q "Build complete!" "$build_log" && build_artifact_is_fresh "$build_artifact" "$build_start_epoch"; then
      sleep 3
      if kill -0 "$build_pid" 2>/dev/null; then
        echo "  - 构建日志已显示完成，但 nuxt 进程未退出，清理残留构建进程后继续部署。"
        cleanup_process_group "$build_pid"
      fi
      break
    fi

    if (( SECONDS >= build_deadline )); then
      echo "  - 构建超时（>${BUILD_TIMEOUT}s），终止构建进程。"
      cleanup_process_group "$build_pid"
      build_exit=124
      break
    fi

    sleep 2
  done

  if [[ "$build_exit" -eq 0 ]]; then
    if wait "$build_pid"; then
      build_exit=0
    else
      build_exit=$?
      if grep -q "Build complete!" "$build_log" && build_artifact_is_fresh "$build_artifact" "$build_start_epoch"; then
        echo "  - 构建产物已生成，忽略挂起后清理导致的非零退出码。"
        build_exit=0
      fi
    fi
  else
    wait "$build_pid" 2>/dev/null || true
  fi

  wait "$tail_pid" 2>/dev/null || true
  popd > /dev/null

  if [[ "$build_exit" -ne 0 ]]; then
    echo "  - 构建失败，最后日志如下："
    tail -n 120 "$build_log"
    rm -f "$build_log"
    return "$build_exit"
  fi

  rm -f "$build_log"
  return 0
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
if git show --name-only --pretty='' HEAD | grep -Eq '^taiko_viewer/(package\.json|package-lock\.json)$'; then
  NEED_NPM_INSTALL=1
fi

if [[ "$NEED_NPM_INSTALL" -eq 1 ]]; then
  (cd "$WEB_DIR" && npm install)
else
  echo "  - 依赖无变化，跳过 npm install。"
fi

echo "[3/5] 构建 Nuxt..."
echo "  - 开始构建，这可能需要 2-5 分钟，请耐心等待..."
if ! run_nuxt_build; then
  BUILD_EXIT=$?
  echo "  - 构建失败 (exit code: $BUILD_EXIT)"
  exit 1
fi

echo "[4/5] 重载服务..."
run_privileged install -m 0644 "$WEB_DIR/deploy/taiko-sync-receiver.service" /etc/systemd/system/taiko-sync-receiver.service
run_privileged install -m 0644 "$WEB_DIR/deploy/taiko-forum.service" /etc/systemd/system/taiko-forum.service
run_privileged install -m 0644 "$WEB_DIR/deploy/taiko-viewer.service" /etc/systemd/system/taiko-viewer.service
run_privileged systemctl daemon-reload
run_privileged nginx -t
run_privileged systemctl reload nginx
run_privileged systemctl restart taiko-forum taiko-viewer taiko-sync-receiver
run_privileged systemctl is-active taiko-forum taiko-viewer taiko-sync-receiver

echo "[5/5] 健康检查..."
wait_for_url "http://127.0.0.1:3101/titles" "本地 SSR"
wait_for_url "http://127.0.0.1:3102/health" "本地 Sakura bot 接收器"
wait_for_url "https://forum.sakura-bot.cn/titles" "线上站点"
wait_for_url "https://viewer.sakura-bot.cn/titles" "viewer 站点"

echo "[可选] 百度普通收录主动推送..."
if [[ -x "$ROOT_DIR/scripts/baidu_push_urls.sh" ]]; then
  "$ROOT_DIR/scripts/baidu_push_urls.sh" || echo "  - 百度推送失败或未配置，不影响站点部署。"
else
  echo "  - 未找到 scripts/baidu_push_urls.sh，跳过。"
fi

echo "部署完成: 代码已推送并发布到 forum.sakura-bot.cn"
