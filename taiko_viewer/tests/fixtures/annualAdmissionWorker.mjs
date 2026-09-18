import { appendFile } from 'node:fs/promises';
import { AnnualAdmission } from '../../server/services/account/annual-summary/admission.ts';
const [root,key,delay]=process.argv.slice(2);
await new AnnualAdmission(root,10000,10).run('renderer',key,5000,async()=>{
 await appendFile(root+'/executions',JSON.stringify({phase:'start',key})+'\n');
 await new Promise(r=>setTimeout(r,Number(delay)));
 await appendFile(root+'/executions',JSON.stringify({phase:'end',key})+'\n');
 return {ok:true};
});
