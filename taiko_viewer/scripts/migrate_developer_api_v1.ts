/** Explicit isolated migration only; future production activation needs separate approval. */
import mysql from 'mysql2/promise';
import {realpath} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {DEVELOPER_API_V1_TABLES} from '../server/infrastructure/developer-api-v1/schema.ts';
if(!process.argv.includes('--apply')){console.log(DEVELOPER_API_V1_TABLES.join(';\n')+';');process.exit(0);}
if(process.env.TAIKO_ALLOW_TEST_DB_MUTATION!=='1')throw new Error('Explicit mutation opt-in required');
if(process.env.TAIKO_DB_HOST!=='127.0.0.1'||!/^\w+_test$/.test(process.env.TAIKO_DB_NAME||'')||Number(process.env.TAIKO_DB_PORT)<=1024||Number(process.env.TAIKO_DB_PORT)===3306)throw new Error('Explicit owned test connection required');
const scratch=await realpath(process.env.QA_RUN_TMPDIR||'');
if(scratch!==resolve(await realpath(process.env.QA_RUN_DIR||''),'scratch')||!/^sql-[a-zA-Z0-9]+\/mysql$/.test(relative(scratch,await realpath(process.env.TAIKO_TEST_MYSQL_DATADIR||''))))throw new Error('Owned QA datadir required');
const db=await mysql.createConnection({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME});
try{
 const [[row]]=await db.query<any>('SELECT DATABASE() name,@@datadir datadir');
 if(!row.name.endsWith('_test')||row.name!==process.env.TAIKO_DB_NAME||await realpath(row.datadir)!==await realpath(process.env.TAIKO_TEST_MYSQL_DATADIR||''))throw new Error('Independent test database required');
 for(const sql of DEVELOPER_API_V1_TABLES)await db.execute(sql);
 console.log(JSON.stringify({migration:'developer-api-v1',database:row.name,statements:DEVELOPER_API_V1_TABLES.length,status:'PASS'}));
}finally{await db.end();}
