import {apiHandler} from '~/server/services/developer-api-v1/common';
import {publicRead} from '~/server/services/developer-api-v1/read';
export default apiHandler(event=>publicRead(event,'aliases'));
