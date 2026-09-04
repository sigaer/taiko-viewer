const OPERATORS = new Set(["ichika", "maru"]);
export const isAnnualReportOperator = (username: string) => OPERATORS.has(String(username || "").trim());
