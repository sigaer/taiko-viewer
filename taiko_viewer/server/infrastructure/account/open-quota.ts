import type {Pool,ResultSetHeader} from 'mysql2/promise';
/** The unique daily key serializes increments and cap decisions in one statement.
 * A fresh insert returns its auto-increment primary key; an increment returns
 * LAST_INSERT_ID(count), and a capped no-op returns 0, even with FOUND_ROWS. */
export async function consumeOpenQuota(db:Pool,subject:string,api:string,day:string,limit:number){
 const [result]=await db.execute<ResultSetHeader>(`INSERT INTO web_taiko_open_api_daily_usage(ip_address,api_name,day_key,request_count)
  VALUES (?,?,?,LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE
  request_count=IF(request_count<?,LAST_INSERT_ID(request_count+1),request_count+LAST_INSERT_ID(0))`,[subject,api,day,limit]);
 const insertId=Number(result.insertId),affected=Number(result.affectedRows);
 if(!Number.isSafeInteger(insertId)||insertId<0)throw new Error('Quota outcome unavailable');
 if(insertId===0&&(affected===0||affected===1))return 0;
 if(insertId>0&&affected===1)return 1;
 if(affected===2&&insertId>=2&&insertId<=limit)return insertId;
 throw new Error('Quota outcome unavailable');
}
