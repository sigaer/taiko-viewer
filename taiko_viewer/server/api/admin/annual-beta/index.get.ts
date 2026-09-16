import {setHeader} from 'h3';
import {requireBetaAdmin,betaDashboard} from '~/server/services/annual-beta/admin';
export default defineEventHandler(async event=>{await requireBetaAdmin(event);setHeader(event,'Cache-Control','private, no-store');return betaDashboard();});
