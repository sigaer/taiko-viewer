#!/usr/bin/env node
// Empty disposable MySQL only. The existing manualSqlRuntime creates the rest
// of the synthetic schema. This imports no application runtime or .env file.
import assert from 'node:assert/strict';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import mysql from 'mysql2/promise';
import ts from 'typescript';

const tables=['web_user_accounts','web_user_sessions','web_taiko_bindings','web_song_locks'];
const sourceUrl=new URL('../server/utils/account-db.ts',import.meta.url);
function productionStatements(source){
  const ast=ts.createSourceFile('account-db.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const arrays=new Map();
  for(const statement of ast.statements){
    if(!ts.isVariableStatement(statement))continue;
    for(const declaration of statement.declarationList.declarations){
      if(ts.isIdentifier(declaration.name)&&declaration.initializer&&ts.isArrayLiteralExpression(declaration.initializer))
        arrays.set(declaration.name.text,declaration.initializer.elements);
    }
  }
  const literal=node=>ts.isNoSubstitutionTemplateLiteral(node)||ts.isStringLiteral(node)?node.text:null;
  const creates=(arrays.get('CREATE_TABLES')||[]).map(literal).filter(Boolean);
  const result=tables.map(table=>{
    const matches=creates.filter(sql=>sql.startsWith(`CREATE TABLE IF NOT EXISTS ${table} (`));
    assert.equal(matches.length,1,'Production base schema declaration must be unique');
    return {table,sql:matches[0],migration:false};
  });
  const migrations=(arrays.get('MIGRATIONS')||[]).map(literal).filter(sql=>sql?.startsWith('ALTER TABLE web_taiko_bindings '));
  assert.equal(migrations.length,3,'Review changed production binding migrations before bootstrap');
  for(const sql of migrations){
    assert.match(sql,/^ALTER TABLE web_taiko_bindings ADD COLUMN (source|manual_account_id|mydon_showcase_layout) /);
    result.push({table:'web_taiko_bindings',sql,migration:true});
  }
  return result;
}

async function main(){
  assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1','Explicit test mutation opt-in required');
  const database=process.env.TAIKO_DB_NAME;
  assert.match(database||'',/^[A-Za-z0-9_]+_test$/,'An explicit disposable test database is required');
  assert.equal(process.env.TAIKO_DB_HOST,'127.0.0.1','Use the owned loopback test server');
  assert.ok(process.env.TAIKO_DB_USER,'Explicit test database user required');
  const port=Number(process.env.TAIKO_DB_PORT);
  assert.ok(Number.isInteger(port)&&port>1024&&port<=65535&&port!==3306,'Explicit non-production test port required');
  const configured=process.env.TAIKO_TEST_MYSQL_DATADIR;
  assert.ok(configured&&isAbsolute(configured),'Explicit isolated datadir required');
  const datadir=await realpath(configured);
  const run=await realpath(process.env.QA_RUN_DIR||'');const scratch=await realpath(process.env.QA_RUN_TMPDIR||'');
  assert.match(run,/^\/home\/sigaer\/taiko\/qa-vault\/runs\/qa-[0-9a-f]{12}$/);
  assert.equal(scratch,resolve(run,'scratch'),'Scratch must belong to the admitted QA run');
  const beneath=relative(scratch,datadir);
  assert.match(beneath,/^sql-[a-zA-Z0-9]+\/mysql$/,'Datadir must be this QA run own SQL scratch directory');
  const statements=productionStatements(await readFile(sourceUrl,'utf8'));
  const db=await mysql.createConnection({host:'127.0.0.1',port,user:process.env.TAIKO_DB_USER,
    password:process.env.TAIKO_DB_PASSWORD||'',database,connectTimeout:5000,multipleStatements:false});
  async function guard(){
    assert.equal(process.env.TAIKO_ALLOW_TEST_DB_MUTATION,'1');
    const [[row]]=await db.query('SELECT DATABASE() AS name, @@datadir AS datadir');
    assert.match(row.name||'',/_test$/);
    assert.equal(row.name,database);
    assert.equal(resolve(row.datadir),datadir,'Connected server is not the owned isolated datadir');
  }
  try{
    await guard();
    console.log(JSON.stringify({database,guard:'SELECT DATABASE() + isolated datadir + mutation opt-in verified'}));
    for(const statement of statements){
      await guard();
      try{await db.execute(statement.sql);}
      catch(error){if(!statement.migration||error.code!=='ER_DUP_FIELDNAME')throw error;}
    }
    console.log(JSON.stringify({bootstrap:'complete',tables,productionDdl:true,seedRows:0}));
  }finally{await db.end();}
}
main().catch(error=>{
  // SQL/connection diagnostics can include configuration; never print them.
  const code=typeof error?.code==='string'&&/^[A-Z_0-9]+$/.test(error.code)?error.code:'GUARD_OR_SCHEMA_FAILURE';
  console.error(JSON.stringify({bootstrap:'failed',code}));process.exitCode=1;
});
