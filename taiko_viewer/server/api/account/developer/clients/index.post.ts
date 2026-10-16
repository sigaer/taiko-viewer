import {apiHandler} from "~/server/services/developer-api-v1/common";
import {registerClient} from "~/server/services/developer-api-v1/grants";
export default apiHandler(registerClient);
