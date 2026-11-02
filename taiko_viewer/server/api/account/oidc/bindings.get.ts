import { defineEventHandler } from "h3";
import { oidcBindingStatus } from "../../../services/oidc/service";
export default defineEventHandler(oidcBindingStatus);
