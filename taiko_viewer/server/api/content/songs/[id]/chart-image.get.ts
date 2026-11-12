import { getQuery, sendStream, setHeader } from 'h3';
import { openChartImage } from '~/server/services/content/chartImages';

export default defineEventHandler(async event => {
  const query = getQuery(event);
  const image = await openChartImage(Number(event.context.params?.id), Number(query.difficulty || 4), String(query.side || 'single'));
  setHeader(event, 'Content-Type', 'image/png');
  setHeader(event, 'Content-Length', String(image.size));
  setHeader(event, 'Cache-Control', 'public, max-age=300');
  setHeader(event, 'ETag', image.etag);
  setHeader(event, 'Last-Modified', image.modified.toUTCString());
  return sendStream(event, image.file.createReadStream({ autoClose: true }));
});
