// Explicit policy backfill only. No DDL, bootstrap, score read or key output.
import mysql from 'mysql2/promise';
import {grantApprovedDeveloperScores} from '../server/infrastructure/account/approved-developer-scores.ts';
const deadline=setTimeout(()=>process.exit(1),45000);
const db=mysql.createPool({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT||3306),user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME,connectionLimit:2,timezone:'Z'});
try{
 const [[actual]]=await db.query<mysql.RowDataPacket[]>('SELECT DATABASE() name');
 const production=process.argv.includes('--production');
 if(production?(actual!.name!=='taiko'||process.env.TAIKO_ALLOW_APPROVED_DEVELOPER_BACKFILL!=='1'):(!actual!.name.endsWith('_test')||process.env.TAIKO_ALLOW_TEST_DB_MUTATION!=='1'))throw new Error('Mutation not authorized');
 const operator=process.env.TAIKO_OPERATOR_USER_ID;if(!operator||!/^\d+$/.test(operator))throw new Error('Operator required');
 const [tokens]=await db.query<mysql.RowDataPacket[]>(`SELECT t.id FROM web_developer_tokens t JOIN web_developer_applications app ON app.id=t.application_id AND app.user_id=t.user_id JOIN web_user_accounts a ON a.id=t.user_id WHERE t.status='active' AND t.revoked_at IS NULL AND app.status='approved' AND a.email_verified=1 ORDER BY t.id LIMIT 501`);
 if(tokens.length>500)throw new Error('Backfill bound exceeded');
 const receipts=[];
 for(const token of tokens){const connection=await db.getConnection();try{await connection.beginTransaction();receipts.push(await grantApprovedDeveloperScores(connection,token.id,operator));await connection.commit();}catch(error){await connection.rollback();throw error;}finally{connection.release();}}
 console.log(JSON.stringify({status:'PASS',database:actual!.name,receipts,ddlStatements:0,scoreRowsRead:0}));
}finally{await db.end();clearTimeout(deadline);}
