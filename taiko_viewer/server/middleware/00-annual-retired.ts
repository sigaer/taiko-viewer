import { getRequestURL, setResponseHeader, setResponseStatus } from 'h3';
import { isRetiredAnnualPath } from '../utils/annual-retirement';

export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname;
  if (!isRetiredAnnualPath(path)) return;
  setResponseStatus(event, 410, 'Gone');
  setResponseHeader(event, 'Cache-Control', 'no-store');
  if (path.startsWith('/api/')) {
    return { statusCode: 410, code: 'ANNUAL_REPORT_RETIRED', message: '年度报告已结束' };
  }
  const ja = path.startsWith('/ja/');
  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8');
  return `<!doctype html><html lang="${ja ? 'ja' : 'zh-CN'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ja ? '年度レポートは終了しました' : '年度报告已结束'}</title><main><h1>${ja ? '年度レポートの提供は終了しました。' : '年度报告已结束'}</h1><a href="${ja ? '/ja' : '/'}">${ja ? 'ホームへ' : '返回首页'}</a></main></html>`;
});
