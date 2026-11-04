import mysql from 'mysql2/promise';
import { installSchemaModuleLoader } from './schema_module_loader.mjs';
import { PROVIDER_TABLES } from '../server/services/reverse-oidc/adapter.ts';
const flags = new Set(process.argv.slice(2));
if ([...flags].some(flag => !['--apply','--production'].includes(flag))) throw Error('Unknown argument');
const production = flags.has('--production'), apply = flags.has('--apply');
for (const key of ['TAIKO_DB_HOST','TAIKO_DB_USER','TAIKO_DB_NAME']) if (!process.env[key]) throw Error('Explicit database configuration required');
const db = await mysql.createConnection({host:process.env.TAIKO_DB_HOST,port:Number(process.env.TAIKO_DB_PORT || 3306),
  user:process.env.TAIKO_DB_USER,password:process.env.TAIKO_DB_PASSWORD,database:process.env.TAIKO_DB_NAME});
try {
  const [[identity]] = await db.query<any[]>('SELECT DATABASE() name');
  if (production) {
    if (!identity.name || identity.name.endsWith('_test') || identity.name !== process.env.TAIKO_OIDC_EXPECTED_DATABASE) throw Error('Actual production database expectation required');
    if (apply && process.env.TAIKO_ALLOW_OIDC_PRODUCTION_MIGRATION !== '1') throw Error('Explicit production migration opt-in required');
  } else if (!identity.name?.endsWith('_test') || (apply && process.env.TAIKO_ALLOW_TEST_DB_MUTATION !== '1')) throw Error('Isolated test database and mutation opt-in required');
  if (apply) for (const sql of PROVIDER_TABLES) await db.execute(sql);
  const loader = installSchemaModuleLoader();
  try {
    const {schemaRequirement,validateSchemaTables} = await import('../server/utils/account-schema-runtime.ts');
    await validateSchemaTables(db as any,PROVIDER_TABLES.map(schemaRequirement),'oidc-provider');
  } finally { loader.deregister(); }
  console.log(JSON.stringify({mode:production?'production':'test',database:identity.name,action:apply?'apply':'inspect',valid:true}));
} finally { await db.end(); }
