import {getRouterParam} from "h3";
import {apiHandler} from "~/server/services/developer-api-v1/common";
import {privateRead} from "~/server/services/developer-api-v1/read";
export default apiHandler(event=>privateRead(event,"profile",getRouterParam(event,"playerId")||""));
