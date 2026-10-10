import type { CanonicalFact, GrowthProjection } from "../../packages/sakura-taiko-contract/src/index.ts";

/** Keep canonical facts unchanged; enforce their owner/binding at the product boundary. */
export function canonicalGrowthProjection<T extends CanonicalFact>(ownerId: string, bindingId: string, facts: T[]): Omit<GrowthProjection, "facts"> & { facts: T[] } {
  if (!ownerId || !bindingId || facts.some(fact => fact.ownerId !== ownerId || fact.bindingId !== bindingId)) {
    throw new Error("Canonical Growth scope mismatch");
  }
  return { ownerId, bindingId, timezone: "Asia/Shanghai", facts, projectionVersion: "viewer-growth-v1" };
}
