import {enabled as developerApiEnabled} from '../../../services/developer-api-v1/common';
import {setHeader,type H3Event} from 'h3';
import {captureMyTaikoAdmission} from '../../../services/my-taiko/admission';
import { getCurrentAccountSummary } from "~/server/utils/account";
import { hasAccountAnnualSummaryAccess } from "~/server/services/account/annual-summary/access";
import { getAccountTitlesMap } from "~/server/utils/account-titles";

export default defineEventHandler(async (event:H3Event) => {
  setHeader(event,'cache-control','private, no-store');
  setHeader(event,'vary','Cookie');
  const user = await getCurrentAccountSummary(event);
  const titles = user ? await getAccountTitlesMap([user.id]) : null;
  return {
    authenticated: Boolean(user),
    user: user
      ? { ...user, titles: titles?.get(user.id) || [], annualSummaryAccess: await hasAccountAnnualSummaryAccess(user.id), myTaikoReadModelAccess: Boolean(await captureMyTaikoAdmission(user.id)), developerApiV1Access: await developerApiEnabled() }
      : null
  };
});
