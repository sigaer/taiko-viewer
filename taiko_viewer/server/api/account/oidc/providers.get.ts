import { defineEventHandler } from "h3";
import { listOidcProviders } from "../../../services/oidc/service";
export default defineEventHandler(listOidcProviders);
