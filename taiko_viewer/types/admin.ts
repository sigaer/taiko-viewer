export type AdminAuthUser = {
  id: number;
  username: string;
  exp: number;
  expiresAt: string;
};

export type AdminAuthPayload = {
  authenticated: boolean;
  user: AdminAuthUser | null;
};

export type AdminMetricSummary = {
  viewerUsers: number;
  taikoBindings: number;
  wahlapBindings: number;
  hirobaBindings: number;
  totalUsers: number;
  totalUploads: number;
  uploads24h: number;
  pagePv24h: number;
  pageUv24h: number;
  homePv24h: number;
  botCommands24h: number;
  botCommands24hByPlatform: {
    qqOfficial: number;
    onebotV11: number;
  };
  recentNewUsers: number;
};

export type AdminHourlyTrendItem = {
  bucket: string;
  label: string;
  pv?: number;
  uv?: number;
  homePv?: number;
  count?: number;
};

export type AdminDailyTrendItem = {
  day: string;
  newUsers: number;
  newBindings: number;
  uploads: number;
  pv: number;
  uv: number;
  homePv: number;
};

export type AdminDashboardPayload = {
  summary: AdminMetricSummary;
  trends: {
    accessHourly: AdminHourlyTrendItem[];
    botHourly: AdminHourlyTrendItem[];
    daily: AdminDailyTrendItem[];
  };
  topCommands: Array<{ name: string; count: number }>;
  taikoCommandStatsSince: string | null;
  backups: Array<{
    name: string;
    path: string;
    category: string;
    createdAt: string;
    size: number;
    manifest: Record<string, unknown> | null;
  }>;
  recentAudits: Array<{
    id: number;
    actorType: string;
    actorId: string;
    actorName: string;
    source: string;
    targetType: string;
    targetKey: string;
    action: string;
    before: unknown;
    after: unknown;
    extra: unknown;
    createdAt: string;
  }>;
};
