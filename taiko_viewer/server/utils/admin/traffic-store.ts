import { randomBytes } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { readLogBatch, type LogCursor } from './traffic-log';
import { addRequest, emptyMinute, parseAccessLine, summarizeMinute, TRAFFIC_SOURCE, DAY, MINUTE, REASONS, type TrafficMinute, type Reason } from './traffic-rules';
import { dashboardDayKey } from './dashboard-time';

type State = { salt: string; cursor?: LogCursor; checkedAt?: string; lastLogAt?: string; firstLogAt?: string; backlog?: number; gapAt?: string; malformed?: number };
const sqlTime = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const minuteStart = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;
type StoredMinute = RowDataPacket & { bucket: string; extra_json: string };

export function createTrafficStore(db: Pool, logPath: string, routePatterns: string[]) {
  const routes = routePatterns.map(pattern => new RegExp(pattern));
  if (!routes.length) throw new Error('traffic_page_routes_missing');
  async function ingest(now = Date.now()) {
    const connection = await db.getConnection();
    let locked = false;
    try {
      const [locks] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT('traffic:', LEFT(SHA2(DATABASE(),256),48)), 0) acquired");
      locked = Number(locks[0].acquired) === 1;
      if (!locked) return false;
      await connection.beginTransaction();
      const [states] = await connection.query<RowDataPacket[]>('SELECT state_json FROM web_admin_ingest_state WHERE source_key=?', [TRAFFIC_SOURCE]);
      const state: State = states.length ? JSON.parse(states[0].state_json) : { salt: randomBytes(32).toString('hex') };
      const batch = await readLogBatch(logPath, state.cursor);
      const buckets = new Map<number, TrafficMinute>();
      const cutoff = minuteStart(now - 30 * DAY);
      for (const line of batch.text.split('\n')) {
        if (!line) continue;
        const request = line.length <= 65536 ? parseAccessLine(line) : null;
        if (!request || request.time > now + MINUTE) { state.malformed = (state.malformed || 0) + 1; continue; }
        const iso = new Date(request.time).toISOString();
        if (!state.firstLogAt || iso < state.firstLogAt) state.firstLogAt = iso;
        if (!state.lastLogAt || iso > state.lastLogAt) state.lastLogAt = iso;
        if (request.time < cutoff) continue;
        const minute = minuteStart(request.time);
        let bucket = buckets.get(minute);
        if (!bucket) {
          const [rows] = await connection.query<RowDataPacket[]>("SELECT extra_json FROM web_admin_access_rollups WHERE source_key=? AND granularity='minute' AND bucket_start=?", [TRAFFIC_SOURCE, sqlTime(minute)]);
          bucket = rows.length ? JSON.parse(rows[0].extra_json) : emptyMinute();
          buckets.set(minute, bucket!);
        }
        addRequest(bucket!, request, state.salt, routes);
      }
      for (const [time, bucket] of buckets) {
        const summary = summarizeMinute(bucket);
        await connection.query(`INSERT INTO web_admin_access_rollups
          (source_key,granularity,bucket_start,metric_count,pv_count,uv_count,home_pv_count,extra_json)
          VALUES (?,'minute',?,?,?,?,?,?) ON DUPLICATE KEY UPDATE metric_count=VALUES(metric_count),
          pv_count=VALUES(pv_count),uv_count=VALUES(uv_count),home_pv_count=VALUES(home_pv_count),extra_json=VALUES(extra_json)`,
        [TRAFFIC_SOURCE, sqlTime(time), bucket.raw, summary.pv, summary.ips.size, summary.homePv, JSON.stringify(bucket)]);
      }
      state.cursor = batch.cursor;
      state.checkedAt = new Date(now).toISOString();
      state.backlog = batch.backlog;
      if (batch.gap) state.gapAt = state.checkedAt;
      await connection.query(`INSERT INTO web_admin_ingest_state (source_key,state_json) VALUES (?,?)
        ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)`, [TRAFFIC_SOURCE, JSON.stringify(state)]);
      await connection.query("DELETE FROM web_admin_access_rollups WHERE source_key=? AND bucket_start<? LIMIT 2000", [TRAFFIC_SOURCE, sqlTime(cutoff)]);
      await connection.commit();
      return batch.backlog > 0 && !batch.partialLine;
    } catch (error) { await connection.rollback(); throw error; }
    finally {
      if (locked) await connection.query("SELECT RELEASE_LOCK(CONCAT('traffic:', LEFT(SHA2(DATABASE(),256),48)))").catch(() => {});
      connection.release();
    }
  }

  async function snapshot(now = Date.now()) {
    // A complete-minute window is exact and reproducible, unlike dropping the
    // partial first hour of a rolling 24-hour range.
    const end = minuteStart(now), start = end - DAY;
    const connection = await db.getConnection();
    try {
      await connection.query('SET TRANSACTION READ ONLY');
      await connection.beginTransaction();
      const [states] = await connection.query<RowDataPacket[]>('SELECT state_json FROM web_admin_ingest_state WHERE source_key=?', [TRAFFIC_SOURCE]);
      const state: Partial<State> = states.length ? JSON.parse(states[0].state_json) : {};
      const make = () => ({ pv: 0, homePv: 0, ips: new Set<string>() });
      const hourly = new Map<number, ReturnType<typeof make>>();
      const daily = new Map<string, ReturnType<typeof make>>();
      const currentHour = Math.floor(end / 3600000) * 3600000;
      for (let i = 47; i >= 0; i--) hourly.set(currentHour - i * 3600000, make());
      for (let i = 29; i >= 0; i--) daily.set(dashboardDayKey(new Date(end - i * DAY)), make());
      const summary = { ...make(), raw: 0, suspected: 0, excluded: 0 };
      const reasons: Partial<Record<Reason, number>> = {};
      let cursor = sqlTime(end - 30 * DAY - MINUTE), visitorsRead = 0;
      for (let page = 0; page < 340; page++) {
        const [rows] = await connection.query<StoredMinute[]>(`SELECT DATE_FORMAT(bucket_start,'%Y-%m-%d %H:%i:%s') bucket, extra_json
          FROM web_admin_access_rollups WHERE source_key=? AND granularity='minute' AND bucket_start>? AND bucket_start<?
          ORDER BY bucket_start LIMIT 128`, [TRAFFIC_SOURCE, cursor, sqlTime(end)]);
        if (!rows.length) break;
        for (const row of rows) {
          const bucket: TrafficMinute = JSON.parse(row.extra_json);
          visitorsRead += Object.keys(bucket.visitors).length;
          if (visitorsRead > 200_000) throw new Error('traffic_snapshot_capacity');
          const value = summarizeMinute(bucket);
          const time = Date.parse(row.bucket.replace(' ', 'T') + 'Z');
          const targets = [hourly.get(Math.floor(time / 3600000) * 3600000), daily.get(dashboardDayKey(new Date(time)))];
          if (time >= start) {
            targets.push(summary);
            summary.raw += value.raw; summary.suspected += value.suspected; summary.excluded += value.excluded;
            for (const [reason, count] of Object.entries(value.reasons)) reasons[reason as Reason] = (reasons[reason as Reason] || 0) + count;
          }
          for (const target of targets) if (target) {
            target.pv += value.pv; target.homePv += value.homePv;
            for (const ip of value.ips) target.ips.add(ip);
          }
        }
        cursor = rows[rows.length - 1].bucket;
      }
      await connection.commit();
      const checked = state.checkedAt ? Date.parse(state.checkedAt) : 0;
      const complete24h = !!state.firstLogAt && Date.parse(state.firstLogAt) <= start && !(state.gapAt && Date.parse(state.gapAt) >= start);
      return {
        pagePv24h: summary.pv, pageUv24h: summary.ips.size, homePv24h: summary.homePv,
        hourly: [...hourly].map(([time, v]) => ({ bucket: new Date(time).toISOString(), label: new Date(time + 8 * 3600000).toISOString().slice(5, 16).replace('T', ' '), pv: v.pv, uv: v.ips.size, homePv: v.homePv })),
        daily: [...daily].map(([day, v]) => ({ day, pv: v.pv, uv: v.ips.size, homePv: v.homePv })),
        quality: {
          windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString(),
          checkedAt: state.checkedAt || null, lastLogAt: state.lastLogAt || null, coverageStart: state.firstLogAt || null,
          status: !checked ? 'pending' : now - checked > 120_000 ? 'stale' : state.backlog ? 'backfilling' : 'ready',
          complete24h, gapAt: state.gapAt || null, backlogBytes: state.backlog || 0, malformedLines: state.malformed || 0,
          rawRequests24h: summary.raw, suspected24h: summary.suspected, excluded24h: summary.excluded,
          reasons: Object.entries(REASONS).map(([key, label]) => ({ key, label, count: reasons[key as Reason] || 0 }))
        }
      };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  return { ingest, snapshot };
}
