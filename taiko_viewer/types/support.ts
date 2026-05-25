export type SupportTicketCategory = "account" | "sync" | "forum" | "data" | "bug" | "feature" | "other";

export type SupportTicketStatus = "open" | "closed";
export type SupportTicketMailStatus = "pending" | "sent" | "failed";

export type SupportTicket = {
  id: number;
  title: string;
  category: SupportTicketCategory;
  content: string;
  contact: string | null;
  status: SupportTicketStatus;
  mailStatus: SupportTicketMailStatus;
  createdAt: string;
  updatedAt: string;
};

export type SupportTicketListResponse = {
  items: SupportTicket[];
};

export type SupportTicketCreateResponse = {
  ok: true;
  ticket: SupportTicket;
  mailDelivered: boolean;
};
