#!/usr/bin/env bash
# Sourced by the standard deployment script while its deployment lock is held.

verify_viewer_ci_revision() {
  local expected="$1"
  git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
  if [[ "$(git rev-parse refs/remotes/origin/main)" != "$expected" ]]; then
    echo "main 已前进，拒绝部署过期的 CI 提交: $expected" >&2
    return 1
  fi
  if [[ "$(git rev-parse HEAD)" != "$expected" ]] ||
     [[ "$(git symbolic-ref --short -q HEAD)" != main ]] ||
     ! git diff --quiet || ! git diff --cached --quiet; then
    echo "部署源码已变化，拒绝激活构建。请先检查并提交生产目录修改。" >&2
    return 1
  fi
}

prepare_viewer_ci() {
  local expected="$1"
  if [[ ! "$expected" =~ ^[0-9a-f]{40}$ ]]; then
    echo "必须提供完整的测试提交 SHA。" >&2
    return 1
  fi
  if [[ "$(git symbolic-ref --short -q HEAD)" != main ]] ||
     ! git diff --quiet || ! git diff --cached --quiet; then
    echo "生产目录必须位于干净的 main；请先验证并提交称号关系等跟踪文件。" >&2
    return 1
  fi
  git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
  if [[ "$(git rev-parse refs/remotes/origin/main)" != "$expected" ]]; then
    echo "请求的提交不是当前 main，拒绝部署: $expected" >&2
    return 1
  fi
  if ! git merge-base --is-ancestor HEAD "$expected"; then
    echo "生产分支存在未发布提交或分叉，无法安全快进。" >&2
    return 1
  fi
  git merge --ff-only "$expected"
  verify_viewer_ci_revision "$expected"
}
