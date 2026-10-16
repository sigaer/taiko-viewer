import {apiHandler} from "~/server/services/developer-api-v1/common";
import {revokeGrant} from "~/server/services/developer-api-v1/grants";
export default apiHandler(revokeGrant);
