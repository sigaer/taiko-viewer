import type { TitleCatalogItem } from './content.ts';

export type AdminTitleConditionItem = TitleCatalogItem & {
  localId: number | null;
  localCondition: string | null;
  officialCondition: string;
  ambiguous: boolean;
};
export type AdminTitleConditionsPayload = {
  items: AdminTitleConditionItem[];
  total: number;
  page: number;
  pageSize: number;
};
export type AdminTitleConditionInput = {
  officialTitleId: number;
  condition: string;
  expectedLocalId: number | null;
  expectedLocalCondition: string | null;
};
