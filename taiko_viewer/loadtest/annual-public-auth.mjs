import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
export async function checkPublicAuth(c,accounts){
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const results=[];
 try{for(const signedIn of [false,true]){
  const ctx=await browser.newContext({viewport:{width:1280,height:800}});if(signedIn)await ctx.addCookies([{name:'stv_session',value:accounts[0].cookie,url:c.base}]);
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===c.base?r.continue():r.abort());
  const page=await ctx.newPage();
  for(const route of ['/grade','/grade/2023','/grade/2024','/settings','/about','/ja','/ja/settings','/ja/about']){
   const response=await page.goto(c.base+route,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(250);
   const auth=await ctx.request.get(c.base+'/api/account/auth/me').then(r=>r.json());
   if(signedIn)await page.locator('.account-brief').waitFor({state:'visible',timeout:5000}).catch(()=>{});
   const brief=await page.locator('.account-brief').count();
   results.push({route,signedIn,http:response.status(),apiAuthenticated:auth.authenticated,apiUserId:auth.user?.id||null,accountBrief:brief});
  }
  await ctx.close();
 }}finally{await browser.close();}
 await writeFile(`${c.output}/public-auth.json`,JSON.stringify({candidate:c.candidate,results},null,2));
 assert.ok(results.every(r=>r.http===200&&r.apiAuthenticated===r.signedIn&&(!r.signedIn||r.apiUserId===accounts[0].userId)&&Boolean(r.accountBrief)===r.signedIn),JSON.stringify(results));
}
