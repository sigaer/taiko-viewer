// Run with node --env-file=<private env> --experimental-transform-types.
// Raw invites are written exactly once to an exclusive 0600 CSV, never stdout.
import fs from 'node:fs/promises';import mysql from 'mysql2/promise';
import {createBetaInvite} from '../server/services/annual-beta/core.ts';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return i<0?[x,true]:[x.slice(0,i),x.slice(i+1)];}));
const count=Number(args['--count']||0);const cohort=String(args['--cohort']||'');const out=String(args['--out']||'');const expiry=new Date(String(args['--expires']||''));
if(!Number.isInteger(count)||count<1||count>50||!['wave1','wave2'].includes(cohort)||!out.startsWith('/var/tmp/annual-beta-invites-')||!Number.isFinite(expiry.getTime())||expiry<=new Date())throw Error('Required: --count=1..50 --cohort=wave1|wave2 --expires=ISO --out=/var/tmp/annual-beta-invites-...csv');
const db=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME});
let file;let created=0;
try{const [rows]=await db.query('SELECT DATABASE() AS name');const test=String(rows[0].name).endsWith('_test');if(test?process.env.TAIKO_ALLOW_TEST_DB_MUTATION!=='1':args['--production']!==true)throw Error('Explicit database mutation opt-in required');file=await fs.open(out,'wx',0o600);await file.write('code,cohort,expires_at\n');for(let i=0;i<count;i++){const invite=await createBetaInvite(db,cohort,expiry);await file.write(`${invite.code},${invite.cohort},${invite.expires_at}\n`);await file.sync();created++;}console.log(JSON.stringify({cohort,count:created,csv:out}));}catch(error){console.error('Invite batch stopped; preserve the private CSV for already-created invitations.',{created});process.exitCode=1;}finally{await file?.close();await db.end();}
