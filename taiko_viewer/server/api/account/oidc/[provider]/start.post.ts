import { defineEventHandler } from "h3";
import { startOidc } from "../../../../services/oidc/service";
export default defineEventHandler(startOidc);
