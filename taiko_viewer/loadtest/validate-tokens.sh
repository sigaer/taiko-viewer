#!/usr/bin/env bash
set -u

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "${script_dir}/.."
base=${BASE:-http://127.0.0.1:3100}
input=${TOKENS_FILE:-loadtest/tokens.txt}
base=${base%/}

if [[ ! -f "$input" ]]; then echo "tokens file not found: $input" >&2; exit 2; fi
total=valid=invalid=limited=server=other=0
while IFS= read -r token || [[ -n "$token" ]]; do
  token=${token%$'\r'}
  [[ -z "$token" || "$token" == \#* ]] && continue
  total=$((total + 1))
  original=$token
  if [[ "$token" =~ ^https?:// ]]; then
    extracted=$(printf '%s' "$token" | sed -n 's#^.*/annual/share/\([^/?#]*\).*$#\1#p')
    if [[ -n "$extracted" ]]; then token=$extracted; echo "warning: extracted token from URL (${original:0:8}...)" >&2; else echo "warning: token looks like a full URL (${original:0:8}...)" >&2; fi
  elif [[ "$token" != *.* || ${#token} -lt 40 ]]; then
    echo "warning: token looks malformed or short (${token:0:8}...)" >&2
  fi
  status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "${TIMEOUT:-8}" "$base/api/annual/shares/${token}?locale=zh" || printf '000')
  case "$status" in
    200) valid=$((valid + 1));;
    404|410) invalid=$((invalid + 1));;
    429) limited=$((limited + 1));;
    5*) server=$((server + 1));;
    *) other=$((other + 1));;
  esac
  printf '%s... -> %s\n' "${token:0:8}" "$status"
done < "$input"
printf 'total=%d 200=%d 404/410=%d 429=%d 5xx=%d other=%d\n' "$total" "$valid" "$invalid" "$limited" "$server" "$other"
(( valid > 0 ))
