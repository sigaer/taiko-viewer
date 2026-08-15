import type { InjectionKey, Ref } from "vue";

export const ANNUAL_COVER_STREAM_DURATION_MS = 36_000;
export const ANNUAL_COVER_PHASE_KEY: InjectionKey<Readonly<Ref<number>>> = Symbol("annual-cover-phase");
