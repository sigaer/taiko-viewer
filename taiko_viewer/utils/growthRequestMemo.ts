/** Small, invocation-owned cache. Non-string values retain their original semantics. */
export function memoizeGrowthString<T>(derive: (value: unknown) => T, limit = 4096): (value: unknown) => T {
  const values = new Map<string, T>();
  return value => {
    if (typeof value !== 'string') return derive(value);
    if (values.has(value)) return values.get(value)!;
    const result = derive(value);
    if (values.size >= limit) values.delete(values.keys().next().value!);
    values.set(value, result);
    return result;
  };
}
