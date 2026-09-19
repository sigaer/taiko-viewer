import type { Pool, RowDataPacket } from "mysql2/promise";
import type { PlayerGoal } from "~/types/player-goal";
import type { GrowthFact } from "~/types/player-growth";
import { projectGoalFact } from "~/utils/growthHistory";

const sqlTime = (value: string) => value.replace("T", " ").replace("Z", "");

export async function loadGoalFacts(db: Pick<Pool, "execute">, userId: number, bindingId: number, fromUtc: string, toExclusiveUtc: string): Promise<GrowthFact[]> {
  const [rows] = await db.execute<RowDataPacket[]>(`SELECT g.id,g.goal_data FROM web_player_goals g
    JOIN web_taiko_bindings b ON b.id=g.binding_id AND b.user_id=g.user_id
    JOIN web_user_accounts u ON u.id=g.user_id
    WHERE g.user_id=? AND g.binding_id=? AND g.status='completed' AND g.completed_at>=? AND g.completed_at<?
    ORDER BY g.completed_at,g.id`, [userId, bindingId, sqlTime(fromUtc), sqlTime(toExclusiveUtc)]);
  return rows.map(row => {
    try { return projectGoalFact(userId, bindingId, { ...JSON.parse(String(row.goal_data)), id: String(row.id) } as PlayerGoal); }
    catch { return null; }
  }).filter((fact): fact is GrowthFact => Boolean(fact));
}
