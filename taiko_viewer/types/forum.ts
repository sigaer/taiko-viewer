export const FORUM_THREAD_TYPES = [
  "discussion",
  "guide",
  "achievement",
  "official",
] as const;
export const FORUM_THREAD_SORTS = ["latest", "hot", "featured"] as const;
export const FORUM_NOTIFICATION_TYPES = [
  "reply",
  "mention",
  "like",
  "system",
] as const;
export const FORUM_ROLES = ["user", "moderator", "admin"] as const;

export type ForumThreadType = (typeof FORUM_THREAD_TYPES)[number];
export type ForumThreadSort = (typeof FORUM_THREAD_SORTS)[number];
export type ForumNotificationType = (typeof FORUM_NOTIFICATION_TYPES)[number];
export type ForumRole = (typeof FORUM_ROLES)[number];

export type ForumContentBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "image";
      imageUrl: string;
      alt?: string;
      caption?: string;
    };

export type ForumSectionSeed = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  accentColor: string;
  sortOrder: number;
};

export type ForumSection = ForumSectionSeed & {
  id: number;
  threadCount: number;
  postCount: number;
  featuredThreadCount: number;
};

export type ForumUserBadge = {
  id: number;
  username: string;
  avatarUrl: string;
  role: ForumRole;
  roleLabel: string;
  taikoIdMasked: string;
  verifiedTitle: string | null;
  verifiedTitleplateId: number | null;
};

export type ForumThreadCard = {
  id: number;
  section: Pick<ForumSection, "id" | "slug" | "name" | "icon" | "accentColor">;
  author: ForumUserBadge;
  threadType: ForumThreadType;
  title: string;
  summary: string;
  coverImageUrl: string;
  tags: string[];
  song: {
    id: number;
    title: string;
    titleJp: string;
    coverUrl: string;
    category: string;
    difficultyType: number | null;
    difficultyLabel: string;
    level: number | null;
  } | null;
  status: "published" | "hidden";
  isPinned: boolean;
  isFeatured: boolean;
  isLocked: boolean;
  likeCount: number;
  replyCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  latestPostAt: string;
  viewerHasLiked: boolean;
  viewerHasFavorited: boolean;
};

export type ForumPostReply = {
  id: number;
  parentPostId: number | null;
  rootPostId: number | null;
  bodyText: string;
  contentBlocks: ForumContentBlock[];
  likeCount: number;
  createdAt: string;
  author: ForumUserBadge;
  viewerHasLiked: boolean;
  isBlockedAuthor: boolean;
};

export type ForumPostFloor = {
  id: number;
  floorNo: number;
  bodyText: string;
  contentBlocks: ForumContentBlock[];
  likeCount: number;
  createdAt: string;
  author: ForumUserBadge;
  viewerHasLiked: boolean;
  isBlockedAuthor: boolean;
  replies: ForumPostReply[];
};

export type ForumThreadDetail = ForumThreadCard & {
  contentBlocks: ForumContentBlock[];
  posts: ForumPostFloor[];
};

export type ForumPreferences = {
  recordHistoryEnabled: boolean;
};

export type ForumMeSummary = {
  user: {
    id: number;
    username: string;
    email: string;
    avatarUrl: string;
  };
  forumBadge: ForumUserBadge;
  currentBinding: {
    id: number;
    taikoId: string;
    isCurrent: boolean;
    verifiedTitle: string | null;
    verifiedTitleplateId: number | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  pendingBinding: {
    taikoId: string;
    originalTitle: string;
    originalTitleplateId: number;
    expiresAt: string;
  } | null;
  verificationStatus: {
    emailVerified: boolean;
    taikoVerified: boolean;
  };
  unreadNotificationCount: number;
  myDonUrl: string | null;
  stats: {
    threadCount: number;
    repliedThreadCount: number;
    favoriteCount: number;
    historyCount: number;
    followerCount: number;
    followingCount: number;
    blockedCount: number;
  };
  preferences: ForumPreferences;
};

export type ForumUserProfile = {
  user: ForumUserBadge;
  relationship: {
    isSelf: boolean;
    isFollowing: boolean;
    isFollowedBy: boolean;
    isBlocked: boolean;
    isBlockedBy: boolean;
  };
  stats: {
    threadCount: number;
    followerCount: number;
    followingCount: number;
  };
  latestThreads: ForumThreadCard[];
};

export type ForumRelationshipItem = {
  user: ForumUserBadge;
  createdAt: string;
  mutualFollow: boolean;
};

export type ForumNotification = {
  id: number;
  type: ForumNotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  threadId: number | null;
  postId: number | null;
  actor: ForumUserBadge | null;
};

export type ForumHomePayload = {
  sections: ForumSection[];
  featuredThreads: ForumThreadCard[];
  hotThreads: ForumThreadCard[];
  latestGuides: ForumThreadCard[];
  announcements: ForumThreadCard[];
  leaderboard: Array<{
    author: ForumUserBadge;
    threadCount: number;
    likeCount: number;
  }>;
  currentUser: ForumUserBadge | null;
  unreadNotificationCount: number;
  highlightedTags: string[];
};

export const FORUM_SECTION_SEEDS: ForumSectionSeed[] = [
  {
    slug: "official",
    name: "官方公告",
    description: "版本更新、站务公告与论坛活动通知。",
    icon: "megaphone",
    accentColor: "#d84a34",
    sortOrder: 10,
  },
  {
    slug: "events",
    name: "活动赛事",
    description: "线下比赛、官方活动、限定曲与企划讨论。",
    icon: "festival",
    accentColor: "#f08a24",
    sortOrder: 20,
  },
  {
    slug: "beginner-help",
    name: "新手问答",
    description: "设备、鼓棒、玩法入门与常见问题集中区。",
    icon: "lifebuoy",
    accentColor: "#3f97d1",
    sortOrder: 30,
  },
  {
    slug: "score-guides",
    name: "谱面攻略",
    description: "难点拆解、手法讨论、配速练习和谱面分析。",
    icon: "drum",
    accentColor: "#eb5d3c",
    sortOrder: 40,
  },
  {
    slug: "dojo",
    name: "段位道场",
    description: "段位配曲、练习路线、稳定率与过段记录。",
    icon: "badge",
    accentColor: "#d19b2f",
    sortOrder: 50,
  },
  {
    slug: "achievements",
    name: "晒分战报",
    description: "全良、金冠、初见成绩与冲分复盘记录。",
    icon: "trophy",
    accentColor: "#dc5432",
    sortOrder: 60,
  },
  {
    slug: "arcade",
    name: "同城机厅",
    description: "机厅环境、鼓况反馈、同城交流与约鼓闲聊。",
    icon: "pin",
    accentColor: "#3b7ca8",
    sortOrder: 70,
  },
  {
    slug: "general",
    name: "闲聊杂谈",
    description: "日常闲聊、曲目感想、年度回顾与社区杂谈。",
    icon: "spark",
    accentColor: "#3f97d1",
    sortOrder: 80,
  },
  {
    slug: "creative",
    name: "同名二创",
    description: "绘画、视频、音乐、同人创作与其它二次创作。",
    icon: "spark",
    accentColor: "#c75d88",
    sortOrder: 90,
  },
];
