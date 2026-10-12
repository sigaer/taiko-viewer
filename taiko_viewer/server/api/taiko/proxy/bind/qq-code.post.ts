import {defineEventHandler,readBody,setHeader} from 'h3';
import {sourceProxyRequest} from '../../../../services/account/source-proxy.ts';
import {runQqMigration} from '../../../../services/account/qq-migration.ts';
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Vary','Authorization, Cookie');
 return sourceProxyRequest(event,'proxy.bind.qq-code',async()=>runQqMigration(event,'issue',await readBody(event)));
});
