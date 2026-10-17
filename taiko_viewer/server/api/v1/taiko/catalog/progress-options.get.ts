import {apiHandler} from '~/server/services/developer-api-v1/common';
import {getProgressOptions} from '~/server/services/account/progress';
import {conditional} from '~/server/services/developer-api-v1/common';
export default apiHandler(async event=>conditional(event,{items:await getProgressOptions()}));
