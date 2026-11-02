import { defineEventHandler } from "h3";
import { callbackOidc } from "../../../../services/oidc/service";
export default defineEventHandler(callbackOidc);
