import {apiHandler} from "~/server/services/developer-api-v1/common";
import {disableClient} from "~/server/services/developer-api-v1/grants";
export default apiHandler(disableClient);
