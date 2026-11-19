// Slice E2: response types of /account/developer and /account/developer/review, moved unchanged from the pages
// (GET /api/account/developer, GET /api/account/developer/review).

export type DeveloperApplication = {
  id: number;
  replyEmail: string;
  reason: string;
  imageUrls: string[];
  status: string;
  reviewNote: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DeveloperToken = {
  id: number;
  tokenMask: string;
  status: string;
  issuedAt: string;
  lastUsedAt: string;
  revokedAt: string;
};

export type DeveloperPayload = {
  canReview: boolean;
  currentApplication: DeveloperApplication | null;
  history: DeveloperApplication[];
  token: DeveloperToken | null;
};

export type ReviewApplication = {
  id: number;
  replyEmail: string;
  reason: string;
  imageUrls: string[];
  status: string;
  reviewNote: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
  applicant?: {
    id: number;
    username: string;
    email: string;
  };
  reviewer?: {
    id: number;
    username: string;
    email: string;
  } | null;
};

export type ReviewPayload = {
  pending: ReviewApplication[];
  history: ReviewApplication[];
  forbidden?: boolean;
  message?: string;
};
