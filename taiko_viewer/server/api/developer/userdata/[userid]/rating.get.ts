import {getDeveloperAnalysisByUserid} from '~/server/services/account/developer-analytics';
export default defineEventHandler(event=>getDeveloperAnalysisByUserid(event,event.context.params?.userid,'rating'));
