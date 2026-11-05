import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalViewerSubject, projectViewerOidcClaims as project, findViewerOidcAccount as findAccount, OURTAIKO_IDENTITY_ISSUER
} from "../server/services/reverse-oidc/account.ts";

const projectViewerOidcClaims = (row, scope) => project(row, scope, "OurTaiko");
const findViewerOidcAccount = (db, sub) => findAccount(db, sub, "OurTaiko");

test("OIDC subject is the canonical SQL decimal string, including ids above JS safe integer", () => {
  for (const value of ["1", "1996075848453", "9007199254740993", "18446744073709551615"]) {
    assert.equal(canonicalViewerSubject(value), value);
  }
  for (const bad of [null, 1, 9007199254740993n, "", "0", "01", "-1", "1.0", "1e3", " 1", "1\n", "18446744073709551616"]) {
    assert.equal(canonicalViewerSubject(bad), null);
  }
});

test("scopes never leak email outside email consent, or unverified email", () => {
  const row = { id: "9007199254740993", username: "viewer_user", email: "person@example.test", email_verified: 1 };
  assert.deepEqual(projectViewerOidcClaims(row, "openid"), { sub:row.id });
  assert.deepEqual(projectViewerOidcClaims(row, "openid profile"), { sub:row.id, preferred_username:"viewer_user" });
  assert.deepEqual(projectViewerOidcClaims(row, "openid email"), { sub:row.id, email:"person@example.test", email_verified:true });
  assert.deepEqual(projectViewerOidcClaims({ ...row, email_verified:0 }, "openid email"), { sub:row.id, email_verified:false });
  assert.deepEqual(projectViewerOidcClaims({ ...row, email:"invalid" }, "openid email"), { sub:row.id, email_verified:false });
});

test("findAccount accepts only an exact DB CAST decimal, not a rounded JS ID", async () => {
  let calls = 0;
  const account = {id:"9007199254740993",username:"player",email:"u@example.test",email_verified:1};
  const db = { async execute(sql,args){
    calls++;
    assert.match(sql,/CAST\(a.id AS CHAR\)/);
    assert.deepEqual(args,[OURTAIKO_IDENTITY_ISSUER,account.id]);
    assert.match(sql,/i.user_id=a.id AND i.issuer=\?/);
    assert.doesNotMatch(sql,/remote_link_status\s*=/);
    return [[account],[]];
  }};
  assert.equal(await findViewerOidcAccount(db, 9007199254740993n),undefined);
  assert.equal(calls,0);
  const found = await findViewerOidcAccount(db,account.id);
  assert.equal(found.accountId,account.id);
  assert.deepEqual(await found.claims("id_token","openid"),{sub:account.id});
  assert.equal(calls,1);
  const wrong = { execute:async()=>[[{...account,id:"9007199254740992"}],[]] };
  assert.equal(await findViewerOidcAccount(wrong,account.id),undefined);
});


test("OurTaiko mapping is a profile-scoped local collision hint for the registered client only", async () => {
  const row = {id:"9007199254740993",username:"viewer",email:"v@example.test",email_verified:1,
    ourtaiko_subject:"0123456789abcdef0123456789abcdef"};
  assert.equal(projectViewerOidcClaims(row,"openid profile").ourtaiko_sub,row.ourtaiko_subject);
  for (const scope of ["openid", "openid email"]) assert.equal(Object.hasOwn(projectViewerOidcClaims(row,scope),"ourtaiko_sub"),false);
  for (const mapping of [undefined,null]) assert.equal(Object.hasOwn(projectViewerOidcClaims({...row,ourtaiko_subject:mapping},"openid profile"),"ourtaiko_sub"),false);
  for (const bad of ["", "ABCDEF0123456789abcdef0123456789ab", "invalid", "0123456789abcdef0123456789abcdef\n"]) assert.throws(()=>projectViewerOidcClaims({...row,ourtaiko_subject:bad},"openid profile"),/Invalid OurTaiko/);
  for (const flag of [0,"1","true",true,null]) assert.equal(projectViewerOidcClaims({...row,email_verified:flag},"openid email").email_verified,false);
  assert.deepEqual(project(row,"openid profile email","another-client"),{sub:row.id});
  let called=false;
  assert.equal(await findAccount({execute:async()=>{called=true;}},row.id,"another-client"),undefined);
  assert.equal(called,false);
});
