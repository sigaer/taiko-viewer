import {apiHandler} from "~/server/services/developer-api-v1/common";
import {listOwnClients} from "~/server/services/developer-api-v1/grants";
export default apiHandler(listOwnClients);
