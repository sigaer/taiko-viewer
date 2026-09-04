const OPERATORS = new Set(["sigaer", "maru", "马路maru"]);
export const isAnnualReportOperator = (username: string) => OPERATORS.has(String(username || "").trim());
