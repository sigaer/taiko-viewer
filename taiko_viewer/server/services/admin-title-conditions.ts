import { createError } from 'h3';
import type { TitleCatalogItem, TitlesPagePayload } from '../../types/content.ts';
import type { AdminTitleConditionItem, AdminTitleConditionsPayload } from '../../types/admin-title.ts';
import { normalizeTitleCondition } from './content/titleDetails.ts';

type Actor = { id: number; username: string };
type Ports = {
  official: () => Promise<TitlesPagePayload>;
  local: () => Promise<TitleCatalogItem[]>;
  get: (id: number) => Promise<TitleCatalogItem>;
  update: (id: number, condition: string) => Promise<unknown>;
  add: (row: Omit<TitleCatalogItem, 'id'>) => Promise<unknown>;
  audit: (actor: Actor, before: unknown, after: unknown) => Promise<unknown>;
};
const identity = (row: Pick<TitleCatalogItem, 'name' | 'rarity'>) =>
  JSON.stringify([row.name.normalize('NFKC').replace(/\s+/gu, ' ').trim(), row.rarity]);
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const conflict = () => createError({ statusCode: 409, statusMessage: '称号资料已变化，请刷新后重新编辑' });
const saving = new Set<number>();

export function createTitleConditionManager(ports: Ports) {
  async function audit(actor: Actor, before: unknown, after: unknown) {
    try { await ports.audit(actor, before, after); }
    catch { throw createError({ statusCode: 503, statusMessage: '条件已保存，但日志写入失败，请刷新核对' }); }
  }
  async function catalog() {
    const [official, local] = await Promise.all([ports.official(), ports.local()]);
    const groups = new Map<string, TitleCatalogItem[]>();
    for (const row of local) {
      const key = identity(row);
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    const items: AdminTitleConditionItem[] = official.titles.map(row => {
      const matches = groups.get(identity(row)) || [];
      const details = matches.length === 1 ? matches[0] : null;
      return {
        ...row, condition: normalizeTitleCondition(details?.condition) || normalizeTitleCondition(row.condition),
        songIds: details?.songIds.length ? details.songIds : row.songIds,
        localId: details?.id ?? null, localCondition: details ? normalizeTitleCondition(details.condition) : null,
        officialCondition: normalizeTitleCondition(row.condition), ambiguous: matches.length > 1
      };
    });
    return { items, official };
  }
  return {
    async list(query: { keyword?: unknown; page?: unknown; pageSize?: unknown; missing?: unknown }): Promise<AdminTitleConditionsPayload> {
      const { items } = await catalog();
      const keyword = String(query.keyword || '').normalize('NFKC').toLowerCase().trim().slice(0, 200);
      const filtered = items.filter(row =>
        (query.missing !== '1' || !row.condition) &&
        (!keyword || [row.name, row.condition, String(row.id)].some(value => value.normalize('NFKC').toLowerCase().includes(keyword))));
      const pageSize = Math.min(100, Math.max(10, Math.floor(Number(query.pageSize) || 20)));
      const page = Math.min(Math.max(1, Math.ceil(filtered.length / pageSize)), Math.max(1, Math.floor(Number(query.page) || 1)));
      return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize };
    },
    async save(actor: Actor, input: Record<string, unknown>) {
      if (!positiveId(input.officialTitleId) || typeof input.condition !== 'string' ||
          [...input.condition].length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input.condition) ||
          !(input.expectedLocalId === null || positiveId(input.expectedLocalId)) ||
          !(input.expectedLocalCondition === null || typeof input.expectedLocalCondition === 'string')) {
        throw createError({ statusCode: 400, statusMessage: '称号或条件无效，条件最多 1000 个字符' });
      }
      const id = input.officialTitleId;
      if (saving.has(id)) throw conflict();
      saving.add(id);
      try {
        const { items, official } = await catalog();
        const item = items.find(row => row.id === id);
        if (!item) throw createError({ statusCode: 404, statusMessage: '官方称号不存在' });
        if (item.ambiguous || item.localId !== input.expectedLocalId || item.localCondition !== input.expectedLocalCondition) throw conflict();
        const condition = normalizeTitleCondition(input.condition);
        if (item.localId !== null) {
          const before = await ports.get(item.localId);
          if (before.id !== item.localId || identity(before) !== identity(item) || normalizeTitleCondition(before.condition) !== item.localCondition) throw conflict();
          if (before.condition === condition) return { item, changed: false };
          // Patch only the condition: name, plate, song associations and local row ID stay intact.
          await ports.update(item.localId, condition);
          const after = await ports.get(item.localId);
          if (after.id !== before.id || identity(after) !== identity(before) || after.condition !== condition ||
              JSON.stringify(after.songIds) !== JSON.stringify(before.songIds)) {
            throw createError({ statusCode: 502, statusMessage: '保存结果核对失败，请刷新称号资料' });
          }
          await audit(actor, before, after);
        } else {
          if (!condition || condition === item.officialCondition) return { item, changed: false };
          const source = official.titles.find(row => row.id === id)!;
          await ports.add({ name: source.name, rarity: source.rarity, condition, songIds: source.songIds });
          const matches = (await ports.local()).filter(row => identity(row) === identity(item));
          if (matches.length !== 1 || matches[0].condition !== condition) {
            throw createError({ statusCode: 502, statusMessage: '新增资料核对失败，请刷新称号资料' });
          }
          await audit(actor, null, matches[0]);
        }
        return { item: (await catalog()).items.find(row => row.id === id)!, changed: true };
      } finally { saving.delete(id); }
    }
  };
}
