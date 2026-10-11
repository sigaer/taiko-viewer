import type { NitroPlugin } from "nitropack/types";
declare global {
  function useRuntimeConfig(): Record<string, unknown> & { public: { guideApiBase?: string; apiBase?: string } };
  const createError: typeof import("h3")["createError"];
  function defineNitroPlugin(plugin: NitroPlugin): NitroPlugin;
  interface ImportMeta { prerender: boolean; }
}
