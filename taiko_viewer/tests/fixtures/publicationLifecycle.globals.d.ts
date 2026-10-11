import type { NitroPlugin } from "nitropack/types";
declare global {
  function useRuntimeConfig(): Record<string, unknown>;
  function defineNitroPlugin(plugin: NitroPlugin): NitroPlugin;
  interface ImportMeta { prerender: boolean; }
}
