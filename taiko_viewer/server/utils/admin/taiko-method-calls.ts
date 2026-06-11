import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { getAdminManagedPaths } from "./shared";

type TaikoMethodMatcher =
  | { type: "exact"; values: string[] }
  | { type: "prefix"; values: string[] }
  | { type: "suffix"; values: string[] }
  | { type: "affix"; prefixes: string[]; suffixes: string[] };

const PYTHON_MATCHER_SCRIPT = String.raw`
import ast
import json
import re
import sre_parse
import sys

DISPLAY_ELLIPSIS = "…"
MAX_LITERAL_OPTIONS = 32


def resolve_string(expr, scope):
    if isinstance(expr, ast.Constant) and isinstance(expr.value, str):
        return expr.value
    if isinstance(expr, ast.Name):
        return scope.get(expr.id)
    if isinstance(expr, ast.BinOp) and isinstance(expr.op, ast.Add):
        left = resolve_string(expr.left, scope)
        right = resolve_string(expr.right, scope)
        if left is not None and right is not None:
            return left + right
    if isinstance(expr, ast.Call):
        func = expr.func
        if (
            isinstance(func, ast.Attribute)
            and isinstance(func.value, ast.Name)
            and func.value.id == "re"
            and func.attr == "compile"
            and expr.args
        ):
            return resolve_string(expr.args[0], scope)
    if (
        isinstance(expr, ast.Attribute)
        and expr.attr == "pattern"
        and isinstance(expr.value, ast.Name)
    ):
        return scope.get(expr.value.id)
    return None


def build_scope(module):
    scope = {}
    for node in module.body:
        if not isinstance(node, ast.Assign):
            continue
        value = resolve_string(node.value, scope)
        if value is None:
            continue
        for target in node.targets:
            if isinstance(target, ast.Name):
                scope[target.id] = value
    return scope


def is_whitespace_literal(char):
    return char.isspace()


def token_is_boundary_anchor(op, value):
    return op == sre_parse.AT and value in {
        sre_parse.AT_BEGINNING,
        sre_parse.AT_BEGINNING_STRING,
        sre_parse.AT_END,
        sre_parse.AT_END_STRING,
    }


def token_is_whitespace(token):
    op, value = token
    if op == sre_parse.LITERAL:
        return is_whitespace_literal(chr(value))
    if op == sre_parse.IN:
        return all(
            item[0] == sre_parse.CATEGORY and item[1] == sre_parse.CATEGORY_SPACE
            for item in value
        )
    if op == sre_parse.MAX_REPEAT:
        _, _, subpattern = value
        return bool(subpattern) and all(token_is_whitespace(item) for item in subpattern)
    if op == sre_parse.SUBPATTERN:
        return all(token_is_whitespace(item) for item in value[-1])
    return False


def combine_options(left, right):
    combined = {f"{prefix}{suffix}" for prefix in left for suffix in right}
    if len(combined) > MAX_LITERAL_OPTIONS:
        return None
    return combined


def literal_options_from_sequence(tokens, allow_optional_dynamic, collapse_boundary_whitespace):
    options = {""}
    for token in tokens:
        part = literal_options_from_token(
            token,
            allow_optional_dynamic=allow_optional_dynamic,
            collapse_boundary_whitespace=collapse_boundary_whitespace,
        )
        if part is None:
            return None
        combined = combine_options(options, part)
        if combined is None:
            return None
        options = combined
    return options


def literal_options_from_token(token, allow_optional_dynamic, collapse_boundary_whitespace):
    op, value = token
    if token_is_boundary_anchor(op, value):
        return {""}
    if op == sre_parse.AT:
        return {""}
    if op == sre_parse.LITERAL:
        char = chr(value)
        if collapse_boundary_whitespace and is_whitespace_literal(char):
            return {""}
        return {char}
    if op == sre_parse.IN:
        if token_is_whitespace(token):
            return {""}
        options = set()
        for item_op, item_value in value:
            if item_op != sre_parse.LITERAL:
                return None
            options.add(chr(item_value))
        return options
    if op == sre_parse.SUBPATTERN:
        return literal_options_from_sequence(
            list(value[-1]),
            allow_optional_dynamic=allow_optional_dynamic,
            collapse_boundary_whitespace=collapse_boundary_whitespace,
        )
    if op == sre_parse.BRANCH:
        branch_options = set()
        for branch in value[1]:
            branch_result = literal_options_from_sequence(
                list(branch),
                allow_optional_dynamic=allow_optional_dynamic,
                collapse_boundary_whitespace=collapse_boundary_whitespace,
            )
            if branch_result is None:
                return None
            branch_options.update(branch_result)
            if len(branch_options) > MAX_LITERAL_OPTIONS:
                return None
        return branch_options
    if op == sre_parse.MAX_REPEAT:
        min_repeat, max_repeat, subpattern = value
        if token_is_whitespace(token):
            return {""}
        child_options = literal_options_from_sequence(
            list(subpattern),
            allow_optional_dynamic=allow_optional_dynamic,
            collapse_boundary_whitespace=collapse_boundary_whitespace,
        )
        if min_repeat == 0 and max_repeat == 1:
            if child_options is None:
                return {""} if allow_optional_dynamic else None
            return child_options | {""}
        if min_repeat == 0 and allow_optional_dynamic:
            return {""}
        if min_repeat == 1 and max_repeat == 1:
            return child_options
        return None
    return None


def boundary_options(tokens, reverse=False):
    options = {""}
    dynamic_seen = False
    iterable = list(reversed(tokens)) if reverse else list(tokens)
    for token in iterable:
        op, value = token
        if token_is_boundary_anchor(op, value):
            continue
        part = literal_options_from_token(
            token,
            allow_optional_dynamic=reverse and options == {""},
            collapse_boundary_whitespace=True,
        )
        if part is None:
            dynamic_seen = True
            break
        combined = combine_options(part, options) if reverse else combine_options(options, part)
        if combined is None:
            dynamic_seen = True
            break
        options = combined
    cleaned = {item.strip() for item in options if item and item.strip()}
    return cleaned, dynamic_seen


def has_substantial_text(text):
    return any(char.isalnum() or "\u4e00" <= char <= "\u9fff" for char in str(text or ""))


def compile_regex_matchers(pattern):
    try:
        tokens = list(sre_parse.parse(pattern))
    except Exception:
        return []

    exact_options = literal_options_from_sequence(
        tokens,
        allow_optional_dynamic=False,
        collapse_boundary_whitespace=False,
    )
    exact_values = sorted({value for value in (exact_options or set()) if has_substantial_text(value)})
    if exact_values:
        return [{"type": "exact", "values": exact_values}]

    prefixes, _ = boundary_options(tokens, reverse=False)
    suffixes, _ = boundary_options(tokens, reverse=True)
    prefixes = sorted({value for value in prefixes if has_substantial_text(value)})
    suffixes = sorted({value for value in suffixes if has_substantial_text(value)})

    if prefixes and suffixes:
        return [{"type": "affix", "prefixes": prefixes, "suffixes": suffixes}]
    if prefixes:
        return [{"type": "prefix", "values": prefixes}]
    if suffixes:
        return [{"type": "suffix", "values": suffixes}]
    return []


def dedupe_matchers(matchers):
    seen = set()
    deduped = []
    for matcher in matchers:
        if matcher["type"] == "affix":
            key = (
                matcher["type"],
                tuple(sorted(matcher["prefixes"])),
                tuple(sorted(matcher["suffixes"])),
            )
        else:
            key = (matcher["type"], tuple(sorted(matcher["values"])))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(matcher)
    return deduped


def main():
    source_path = sys.argv[1]
    source = open(source_path, "r", encoding="utf-8").read()
    module = ast.parse(source, filename=source_path)
    scope = build_scope(module)
    matchers = []

    for node in ast.walk(module):
        if not isinstance(node, ast.Call):
            continue
        if not isinstance(node.func, ast.Name):
            continue
        if node.func.id == "on_fullmatch" and node.args:
            value = resolve_string(node.args[0], scope)
            if value and has_substantial_text(value):
                matchers.append({"type": "exact", "values": [value]})
        if node.func.id == "on_regex" and node.args:
            value = resolve_string(node.args[0], scope)
            if value:
                matchers.extend(compile_regex_matchers(value))

    print(json.dumps(dedupe_matchers(matchers), ensure_ascii=False))


if __name__ == "__main__":
    main()
`;

let taikoMethodMatcherCache: TaikoMethodMatcher[] | null = null;

const normalizeMethodLabel = (value: string) => String(value || "").trim().replace(/^\/+/, "").toLowerCase();

const normalizeMatcher = (matcher: TaikoMethodMatcher): TaikoMethodMatcher => {
  if (matcher.type === "affix") {
    return {
      type: matcher.type,
      prefixes: matcher.prefixes.map(normalizeMethodLabel),
      suffixes: matcher.suffixes.map(normalizeMethodLabel)
    };
  }
  return {
    type: matcher.type,
    values: matcher.values.map(normalizeMethodLabel)
  };
};

const loadTaikoMethodMatchers = (): TaikoMethodMatcher[] => {
  const { repoRoot } = getAdminManagedPaths();
  const taikoPluginPath = resolve(repoRoot, "plugins", "taiko.py");
  try {
    const raw = execFileSync("python3", ["-c", PYTHON_MATCHER_SCRIPT, taikoPluginPath], {
      encoding: "utf-8"
    }).trim();
    const parsed = JSON.parse(raw || "[]") as TaikoMethodMatcher[];
    return parsed.map(normalizeMatcher);
  } catch (error) {
    console.warn("[admin] failed to load taiko command matcher list", error);
    return [];
  }
};

export const getTaikoMethodMatchers = () => {
  if (!taikoMethodMatcherCache) {
    taikoMethodMatcherCache = loadTaikoMethodMatchers();
  }
  return taikoMethodMatcherCache;
};

export const isTaikoMethodDisplay = (displayName: string) => {
  const normalized = normalizeMethodLabel(displayName);
  if (!normalized) return false;
  for (const matcher of getTaikoMethodMatchers()) {
    if (matcher.type === "exact" && matcher.values.includes(normalized)) {
      return true;
    }
    if (matcher.type === "prefix" && matcher.values.some((value) => normalized.startsWith(value))) {
      return true;
    }
    if (matcher.type === "suffix" && matcher.values.some((value) => normalized.endsWith(value))) {
      return true;
    }
    if (
      matcher.type === "affix" &&
      matcher.prefixes.some((prefix) => normalized.startsWith(prefix)) &&
      matcher.suffixes.some((suffix) => normalized.endsWith(suffix))
    ) {
      return true;
    }
  }
  return false;
};
