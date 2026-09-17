export const annualEntryTarget = (path: string): "entry" | "report" | null => {
  const normalized = path.replace(/^\/ja(?=\/)/, "").replace(/\/$/, "");
  if (normalized === "/annual") return "entry";
  if (normalized === "/account/version-summary") return "report";
  return null;
};

export const isAnnualMobileBrowser = (userAgent: string, maxTouchPoints = 0) =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
  // iPadOS can request desktop pages using a Macintosh user agent.
  || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
