import {apiHandler} from "~/server/services/developer-api-v1/common";
import {listGrants} from "~/server/services/developer-api-v1/grants";
export default apiHandler(listGrants);
