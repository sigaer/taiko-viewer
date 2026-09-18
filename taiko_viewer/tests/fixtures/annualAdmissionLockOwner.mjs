import {withHostFileLock} from '../../server/services/account/annual-summary/admission.ts';
await withHostFileLock(process.argv[2],async()=>{process.stdout.write('locked');await new Promise(()=>{});});
