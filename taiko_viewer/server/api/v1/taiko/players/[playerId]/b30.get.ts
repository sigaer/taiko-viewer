import {getRouterParam} from 'h3';
import {apiHandler,conditional} from '~/server/services/developer-api-v1/common';
import {privateAnalysis} from '~/server/services/developer-api-v1/analytics';
export default apiHandler(async event=>conditional(event,await privateAnalysis(event,'b30',String(getRouterParam(event,'playerId')||'')),true));
