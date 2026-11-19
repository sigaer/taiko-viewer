// Scope comparisons never exempt individual components or CSS properties.
export const sameScopeSnapshot = (before, after) => JSON.stringify(before) === JSON.stringify(after);

// Warm only vendor component styles. Loading sample/component CSS in the control could hide a global leak.
export const isProductionEpStylesheet = value => /\/el-[a-z-]+\.[\w-]+\.css$/.test(new URL(value).pathname);
