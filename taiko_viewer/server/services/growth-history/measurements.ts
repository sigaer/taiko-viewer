import type { Pool, RowDataPacket } from "mysql2/promise";
import type { GrowthMeasurement, GrowthMeasurementDimensions, PlayerGrowthState } from "~/types/player-growth";
import type { PlayerRatingDimension } from "~/types/recommendation-intelligence";
import { GROWTH_ALGORITHM_VERSION, GROWTH_MEASUREMENT_VERSION } from "./constants.ts";
import { GROWTH_DIMENSION_ORDER } from "../../../utils/playerGrowth.ts";

const sqlTime = (value: string) => value.replace("T", " ").replace("Z", "");
const finite = (value: unknown): number | null => value === null || value === undefined || value === "" || typeof value === "boolean" ? null : Number.isFinite(Number(value)) ? Number(value) : null;

export const measurementFocus = (state: PlayerGrowthState): GrowthMeasurement["focus"] => {
  if (state.dataSufficiency === "insufficient") return "insufficient-data";
  if (state.dataSufficiency === "limited") return "limited";
  if (!state.priorityDimension || state.tiedDimensions.length === GROWTH_DIMENSION_ORDER.length) return "balanced";
  return state.priorityDimension;
};

export const measurementDimensions = (state: PlayerGrowthState, rawDimensions: PlayerRatingDimension[] = state.skills): GrowthMeasurementDimensions => Object.fromEntries(
  GROWTH_DIMENSION_ORDER.map(key => [key, finite(rawDimensions.find(item => item.key === key)?.value)])
) as GrowthMeasurementDimensions;

export async function upsertGrowthMeasurement(db: Pick<Pool, "execute">, input: {
  userId: number;
  bindingId: number;
  scoreRevision: string;
  capturedAt: string;
  modelRevision: string;
  playerState: PlayerGrowthState;
  rawDimensions?: PlayerRatingDimension[];
}) {
  const dimensions = measurementDimensions(input.playerState, input.rawDimensions);
  const [result] = await db.execute<any>(`INSERT IGNORE INTO web_growth_measurements
    (user_id,binding_id,score_revision,measurement_version,algorithm_version,model_revision,rating,dimensions_json,focus,sample_count,availability_state,captured_at)
    SELECT ?,b.id,?,?,?,?,?,?,?,?,?,?
      FROM web_taiko_bindings b
      JOIN web_user_accounts u ON u.id=b.user_id
     WHERE b.id=? AND b.user_id=?`, [
    input.userId,
    input.scoreRevision,
    GROWTH_MEASUREMENT_VERSION,
    GROWTH_ALGORITHM_VERSION,
    input.modelRevision,
    finite(input.playerState.overallRating),
    JSON.stringify(dimensions),
    measurementFocus(input.playerState),
    Math.max(0, Math.floor(Number(input.playerState.sampleCount) || 0)),
    input.playerState.dataSufficiency,
    sqlTime(input.capturedAt),
    input.bindingId,
    input.userId
  ]);
  return { created: Number(result.affectedRows || 0) === 1 };
}

const parseDimensions = (value: unknown): GrowthMeasurementDimensions => {
  let source: Record<string, unknown> = {};
  try { source = JSON.parse(String(value || "{}")); } catch { source = {}; }
  return Object.fromEntries(GROWTH_DIMENSION_ORDER.map(key => [key, finite(source[key])])) as GrowthMeasurementDimensions;
};

export async function readGrowthMeasurements(db: Pick<Pool, "execute">, userId: number, bindingId: number, fromUtc: string, toExclusiveUtc: string): Promise<GrowthMeasurement[]> {
  const [rows] = await db.execute<RowDataPacket[]>(`SELECT m.*,DATE_FORMAT(m.captured_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS captured_at_iso FROM web_growth_measurements m
    JOIN web_taiko_bindings b ON b.id=m.binding_id AND b.user_id=m.user_id
    JOIN web_user_accounts u ON u.id=m.user_id
    WHERE m.user_id=? AND m.binding_id=? AND m.captured_at>=? AND m.captured_at<?
    ORDER BY m.captured_at,m.id`, [userId, bindingId, sqlTime(fromUtc), sqlTime(toExclusiveUtc)]);
  return rows.map(row => ({
    ownerId: String(row.user_id),
    bindingId: String(row.binding_id),
    capturedAt: new Date(String(row.captured_at_iso)).toISOString(),
    scoreRevision: String(row.score_revision),
    measurementVersion: Number(row.measurement_version),
    algorithmVersion: String(row.algorithm_version),
    modelRevision: row.model_revision ? String(row.model_revision) : null,
    rating: finite(row.rating),
    dimensions: parseDimensions(row.dimensions_json),
    focus: String(row.focus) as GrowthMeasurement["focus"],
    sampleCount: Number(row.sample_count || 0),
    availabilityState: String(row.availability_state) as GrowthMeasurement["availabilityState"]
  }));
}

export async function deleteMeasurementsForBinding(db: Pick<Pool, "execute">, bindingId: number) {
  await db.execute("DELETE FROM web_growth_measurements WHERE binding_id=?", [bindingId]);
}

export async function deleteMeasurementsForUser(db: Pick<Pool, "execute">, userId: number) {
  await db.execute(`DELETE m FROM web_growth_measurements m
    LEFT JOIN web_taiko_bindings b ON b.id=m.binding_id
    WHERE m.user_id=? OR b.user_id=?`, [userId, userId]);
}
