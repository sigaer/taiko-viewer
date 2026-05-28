export type SupportTicketCategory = "account" | "sync" | "forum" | "data" | "bug" | "feature" | "other";

export type SupportTicketStatus = "open" | "closed";
export type SupportTicketMailStatus = "pending" | "sent" | "failed";
export type SupportMessageAuthorRole = "user" | "staff";
export type SupportMessageMailStatus = "pending" | "sent" | "failed" | "skipped";

export type SupportTicketUserSummary = {
  id: number;
  username: string;
  email: string;
};

export type SupportTicketMessage = {
  id: number;
  authorRole: SupportMessageAuthorRole;
  authorUserId: number;
  authorUsername?: string;
  content: string;
  mailStatus: SupportMessageMailStatus;
  createdAt: string;
  isInitial?: boolean;
};

export type SupportTicket = {
  id: number;
  title: string;
  category: SupportTicketCategory;
  content: string;
  contact: string | null;
  status: SupportTicketStatus;
  mailStatus: SupportTicketMailStatus;
  hasUnread?: boolean;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type SupportTicketDetail = SupportTicket & {
  messages: SupportTicketMessage[];
  user?: SupportTicketUserSummary;
};

export type SupportTicketListResponse = {
  items: SupportTicket[];
};

export type SupportTicketCreateResponse = {
  ok: true;
  ticket: SupportTicket;
  mailDelivered: boolean;
};

export type SupportReviewTicketSummary = SupportTicket & {
  hasUnread: boolean;
  user: SupportTicketUserSummary;
};

export type SupportReviewDashboard = {
  pending: SupportReviewTicketSummary[];
  history: SupportReviewTicketSummary[];
};

export type SupportStaffReplyResponse = {
  ok: true;
  ticket: SupportTicketDetail;
  mailDelivered: boolean;
};

export type SupportUserMessageResponse = {
  ok: true;
  ticket: SupportTicketDetail;
  mailDelivered: boolean;
};
