import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalViewerSubject, projectViewerOidcClaims, findViewerOidcAccount
} from "../server/services/reverse-oidc/account.ts";

test("OIDC subject is the canonical SQL decimal string, including ids above JS safe integer", () => {
  for (const value of ["1", "1996075848453", "9007199254740993", "18446744073709551615"]) {
    assert.equal(canonicalViewerSubject(value), value);
  }
  for (const bad of [null, 1, 9007199254740993n, "", "0", "01", "-1", "1.0", "1e3", " 1", "18446744073709551616"]) {
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
    assert.match(sql,/CAST\(id AS CHAR\)/);
    assert.deepEqual(args,[account.id]);
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
