export type AnnualReaction = {
  id: string;
  status: 'published' | 'hidden';
  content: string;
  createdAt: string;
  author: { userId: number; username: string; avatarUrl: string };
};
