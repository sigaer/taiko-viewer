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
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/taiko-viewer-deploy.lock}"
BUILD_PID_FILE="${BUILD_PID_FILE:-/tmp/taiko-viewer-nuxt-build.pid}"
CURRENT_BUILD_PID=""
BUILD_ROOT=""
STAGED_OUTPUT="$WEB_DIR/.output.next"
PREVIOUS_OUTPUT="$WEB_DIR/.output.previous"

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

require_singleton() {
  exec 9>"$DEPLOY_LOCK_FILE"
  if ! flock -n 9; then
    echo "另一个 taiko_viewer 部署或构建仍在进行，请稍后再试。"
    if [[ -f "$BUILD_PID_FILE" ]]; then
      echo "  - 当前记录的构建 PID: $(cat "$BUILD_PID_FILE" 2>/dev/null || echo unknown)"
    fi
    exit 1
  fi
}

clear_build_pidfile() {
  local expected_pid="${1:-}"
  if [[ ! -f "$BUILD_PID_FILE" ]]; then
    return 0
  fi

  if [[ -z "$expected_pid" ]]; then
    rm -f "$BUILD_PID_FILE"
    return 0
  fi

  local recorded_pid
  recorded_pid="$(cat "$BUILD_PID_FILE" 2>/dev/null || true)"
  if [[ "$recorded_pid" == "$expected_pid" ]]; then
    rm -f "$BUILD_PID_FILE"
  fi
}

cleanup_current_build() {
  if [[ -z "$CURRENT_BUILD_PID" ]]; then
    return 0
  fi

  cleanup_process_group "$CURRENT_BUILD_PID"
  clear_build_pidfile "$CURRENT_BUILD_PID"
  CURRENT_BUILD_PID=""
}

cleanup_build_root() {
  if [[ -n "$BUILD_ROOT" && -d "$BUILD_ROOT" ]]; then
    rm -rf -- "$BUILD_ROOT"
  fi
  BUILD_ROOT=""
}

handle_signal_exit() {
  cleanup_current_build
  cleanup_build_root
  exit 1
}

cleanup_stale_build() {
  if [[ ! -f "$BUILD_PID_FILE" ]]; then
    return 0
  fi

  local stale_pid
  stale_pid="$(cat "$BUILD_PID_FILE" 2>/dev/null || true)"

  if [[ -z "$stale_pid" ]]; then
    rm -f "$BUILD_PID_FILE"
    return 0
  fi

  if ! kill -0 "$stale_pid" 2>/dev/null; then
    clear_build_pidfile "$stale_pid"
    return 0
  fi

  local stale_cmd
  stale_cmd="$(ps -p "$stale_pid" -o args= 2>/dev/null || true)"

  if [[ "$stale_cmd" != *"$WEB_DIR"* ]] || [[ "$stale_cmd" != *"npm run build"* && "$stale_cmd" != *"nuxt build"* ]]; then
    echo "  - 发现构建 PID 文件指向非预期进程，已仅清理 PID 文件: $stale_pid"
    clear_build_pidfile
    return 0
  fi

  echo "  - 检测到遗留 Nuxt 构建进程，先清理后再继续: PID $stale_pid"
  echo "    $stale_cmd"
  cleanup_process_group "$stale_pid"
  clear_build_pidfile "$stale_pid"
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
  local build_web_dir
  local build_workspace

  BUILD_ROOT="$(mktemp -d /tmp/taiko-viewer-release.XXXXXX)"
  build_workspace="$BUILD_ROOT/workspace"
  mkdir -p "$build_workspace/taiko-forum"
  git archive --format=tar HEAD | tar -xf - -C "$build_workspace/taiko-forum"
  cp -a "$ROOT_DIR/../schemas" "$build_workspace/schemas"
  build_web_dir="$build_workspace/taiko-forum/taiko_viewer"
  ln -s "$WEB_DIR/node_modules" "$build_web_dir/node_modules"
  local build_artifact="$build_web_dir/.output/server/index.mjs"

  build_log="$(mktemp)"
  build_start_epoch="$(date +%s)"
  build_deadline=$((SECONDS + BUILD_TIMEOUT))

  pushd "$build_web_dir" > /dev/null
  export NODE_OPTIONS="--max-old-space-size=4096"

  BUILD_WEB_DIR="$build_web_dir" setsid bash -lc 'cd "$BUILD_WEB_DIR" && npm run build' >"$build_log" 2>&1 &
  build_pid=$!
  CURRENT_BUILD_PID="$build_pid"
  printf '%s\n' "$build_pid" > "$BUILD_PID_FILE"

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
    clear_build_pidfile "$build_pid"
    CURRENT_BUILD_PID=""
    return "$build_exit"
  fi

  rm -f "$build_log"
  clear_build_pidfile "$build_pid"
  CURRENT_BUILD_PID=""
  rm -rf -- "$STAGED_OUTPUT"
  mv "$build_web_dir/.output" "$STAGED_OUTPUT"
  cleanup_build_root
  return 0
}

rollback_viewer_output() {
  echo "  - 健康检查失败，恢复上一份 viewer 构建。"
  run_privileged systemctl stop taiko-viewer || true
  rm -rf -- "$STAGED_OUTPUT"
  if [[ -d "$WEB_DIR/.output" ]]; then
    mv "$WEB_DIR/.output" "$STAGED_OUTPUT"
  fi
  if [[ -d "$PREVIOUS_OUTPUT" ]]; then
    mv "$PREVIOUS_OUTPUT" "$WEB_DIR/.output"
    run_privileged systemctl start taiko-viewer
    wait_for_url "http://127.0.0.1:3100/titles" "回滚后的本地 SSR" || true
  fi
}

activate_viewer_output() {
  if [[ ! -f "$STAGED_OUTPUT/server/index.mjs" ]]; then
    echo "  - 待发布构建不完整: $STAGED_OUTPUT"
    return 1
  fi
  run_privileged systemctl stop taiko-viewer
  rm -rf -- "$PREVIOUS_OUTPUT"
  if [[ -d "$WEB_DIR/.output" ]]; then
    mv "$WEB_DIR/.output" "$PREVIOUS_OUTPUT"
  fi
  mv "$STAGED_OUTPUT" "$WEB_DIR/.output"
  run_privileged systemctl start taiko-viewer
}

trap 'cleanup_current_build; cleanup_build_root' EXIT
trap handle_signal_exit HUP INT TERM

require_singleton
cleanup_stale_build

cd "$ROOT_DIR"

echo "[1/5] 验证并推送已提交代码..."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "  - 存在未提交的跟踪文件。部署脚本不会自动暂存，请先按范围提交。"
  git status --short
  exit 1
fi
HEAD_SUBJECT="$(git log -1 --pretty=%s)"
if [[ "$HEAD_SUBJECT" != "$COMMIT_MESSAGE" ]]; then
  echo "  - 参数必须与 HEAD 提交信息完全一致。"
  echo "    HEAD: $HEAD_SUBJECT"
  exit 1
fi
APP_VERSION="$(node -p "require('$WEB_DIR/package.json').version")"
if [[ "$COMMIT_MESSAGE" != "$APP_VERSION "* ]]; then
  echo "  - 提交信息必须以当前 viewer 版本开头: $APP_VERSION"
  exit 1
fi
UNTRACKED_FILES="$(git ls-files --others --exclude-standard)"
if [[ -n "$UNTRACKED_FILES" ]]; then
  echo "  - 以下未跟踪文件不会被暂存或打入发布构建："
  sed 's/^/    /' <<<"$UNTRACKED_FILES"
fi
git fetch "$REMOTE" "$BRANCH"
REMOTE_HEAD="$(git rev-parse "$REMOTE/$BRANCH")"
if ! git merge-base --is-ancestor "$REMOTE_HEAD" HEAD; then
  echo "  - 远端 $BRANCH 已出现当前 HEAD 未包含的新提交，请先 rebase 并重新验证。"
  exit 1
fi
git push "$REMOTE" "HEAD:$BRANCH"

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
  echo "  - 构建失败，未切换线上产物。"
  exit 1
fi

echo "[4/5] 重载服务..."
run_privileged install -m 0644 "$WEB_DIR/deploy/taiko-sync-receiver.service" /etc/systemd/system/taiko-sync-receiver.service
run_privileged install -m 0644 "$WEB_DIR/deploy/taiko-viewer.service" /etc/systemd/system/taiko-viewer.service
run_privileged systemctl daemon-reload
run_privileged nginx -t
run_privileged systemctl reload nginx
activate_viewer_output
run_privileged systemctl restart taiko-sync-receiver
run_privileged systemctl disable --now taiko-forum || true

echo "[5/5] 健康检查..."
if ! wait_for_url "http://127.0.0.1:3100/titles" "本地 SSR" ||
   ! wait_for_url "http://127.0.0.1:3102/health" "本地 Sakura bot 接收器" ||
   ! wait_for_url "https://viewer.sakura-bot.cn/titles" "viewer 站点"; then
  rollback_viewer_output
  exit 1
fi
run_privileged systemctl is-active taiko-viewer taiko-sync-receiver

echo "[可选] 百度普通收录主动推送..."
if [[ -x "$ROOT_DIR/scripts/baidu_push_urls.sh" ]]; then
  "$ROOT_DIR/scripts/baidu_push_urls.sh" || echo "  - 百度推送失败或未配置，不影响站点部署。"
else
  echo "  - 未找到 scripts/baidu_push_urls.sh，跳过。"
fi

echo "部署完成: 代码已推送并发布到 viewer.sakura-bot.cn"
