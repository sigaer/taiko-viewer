import type { H3Event } from "h3";

const hasViewerCredentials = (event: H3Event) => Boolean(
  getHeader(event, "cookie") || getHeader(event, "authorization")
);

export const setPrivateNoStore = (event: H3Event) => {
  setHeader(event, "Cache-Control", "private, no-store");
};

export const setAnonymousSWR = (event: H3Event, maxAge = 15, staleWhileRevalidate = 60) => {
  appendHeader(event, "Vary", "Cookie");
  appendHeader(event, "Vary", "Authorization");
  if (hasViewerCredentials(event)) {
    setPrivateNoStore(event);
    return;
  }
  setHeader(
    event,
    "Cache-Control",
    `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  );
};
