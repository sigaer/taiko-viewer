#!/usr/bin/env bash
# Run only via scripts/memory/run_qa.sh. Dedicated synthetic MySQL, no shared credentials/configuration.
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
node_bin=/www/server/nvm/versions/node/v24.13.0/bin/node
mysql_bin=/www/server/mysql/bin
fixture_dir="${TMPDIR:?QA runner scratch required}/portfolio-mysql"
mkdir -p "$fixture_dir/data"
cleanup() { if [ -n "${fixture_pid:-}" ]; then kill "$fixture_pid" 2>/dev/null || true; wait "$fixture_pid" || true; fi; }
trap cleanup EXIT
"$mysql_bin/mysqld" --no-defaults --initialize-insecure --user=root --datadir="$fixture_dir/data" --log-error="$fixture_dir/initialize.log"
"$mysql_bin/mysqld" --no-defaults --user=root --datadir="$fixture_dir/data" --socket="$fixture_dir/mysql.sock" --pid-file="$fixture_dir/mysql.pid" --skip-networking --mysqlx=OFF --innodb-buffer-pool-size=32M --performance-schema=OFF --log-error="$fixture_dir/server.log" &
fixture_pid=$!
for attempt in {1..150}; do
 if "$mysql_bin/mysqladmin" --no-defaults --socket="$fixture_dir/mysql.sock" -uroot ping >/dev/null 2>&1; then break; fi
 if ! kill -0 "$fixture_pid" 2>/dev/null; then cat "$fixture_dir/server.log"; exit 1; fi
 sleep .2
done
export TAIKO_PORTFOLIO_TEST_SOCKET="$fixture_dir/mysql.sock" TAIKO_ALLOW_TEST_DB_MUTATION=1
"$node_bin" taiko_viewer/node_modules/typescript/bin/tsc -p taiko_viewer/tests/fixtures/portfolio.tsconfig.json
"$node_bin" taiko_viewer/scripts/check_portfolio_types.mjs
"$node_bin" --experimental-strip-types --test --test-concurrency=1 taiko_viewer/tests/goalPortfolioSql.test.ts
