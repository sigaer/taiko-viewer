// Shared known-automation User-Agent rule. Used by log-based traffic statistics
// and by the visit beacon endpoint. No imports so it stays unit-testable.
export const AUTOMATION_UA_PATTERN =
  /(bot|spider|crawl|headless|scan|zgrab|python|curl|wget|go-http-client|httpclient|libredtail|semrush|^node(?:\/|$)|undici|axios|okhttp|postman|phantomjs|slimerjs|puppeteer|playwright|selenium|webdriver|lighthouse|pagespeed|prerender)/i;

export const isAutomationUserAgent = (ua: string) => AUTOMATION_UA_PATTERN.test(ua);
