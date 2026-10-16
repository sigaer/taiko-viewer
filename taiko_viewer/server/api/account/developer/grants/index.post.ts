import {apiHandler} from "~/server/services/developer-api-v1/common";
import {issueGrant} from "~/server/services/developer-api-v1/grants";
export default apiHandler(issueGrant);
