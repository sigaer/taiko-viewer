import {enabled as developerApiEnabled} from '../../../services/developer-api-v1/common';
import {setHeader} from 'h3';
import {captureMyTaikoAdmission} from '../../../services/my-taiko/admission';
import { getCurrentAccountSummary } from "~/server/utils/account";
import { hasAccountAnnualSummaryAccess } from "~/server/services/account/annual-summary/access";

export default defineEventHandler(async (event) => {
  setHeader(event,'cache-control','private, no-store');
  setHeader(event,'vary','Cookie');
  const user = await getCurrentAccountSummary(event);
  return {
    authenticated: Boolean(user),
    user: user
      ? { ...user, annualSummaryAccess: await hasAccountAnnualSummaryAccess(user.id), myTaikoReadModelAccess: Boolean(await captureMyTaikoAdmission(user.id)), developerApiV1Access: await developerApiEnabled() }
      : null
  };
});
