import type { Pool } from 'mysql2/promise';
import { resolve } from 'node:path';
import { getAccountDbNativeConfig } from '../../utils/account-db';
import type { getRuntimePaths } from '../runtime-paths.ts';
export function capturedWorkerEnvironment(db:Pool,paths:ReturnType<typeof getRuntimePaths>):NodeJS.ProcessEnv{
  const config=getAccountDbNativeConfig(db),env:NodeJS.ProcessEnv={};
  for(const key of ['PATH','HOME','LANG','LC_ALL','TZ','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE',
    'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy','TAIKO_SYNC_RECEIVER_NAME','HIROBA_CRED_KEY','HIROBA_SYNC_LEVELS']){
    if(process.env[key]!==undefined)env[key]=process.env[key];
  }
  return Object.assign(env,{TAIKO_DB_HOST:config.host,TAIKO_DB_PORT:String(config.port),TAIKO_DB_USER:config.user,TAIKO_DB_PASSWORD:config.password,
    TAIKO_DB_NAME:config.database,TAIKO_CENTER_ROOT:paths.repoRoot,TAIKO_RUNTIME_ROOT:paths.repoRoot,TAIKO_OFFLINE_ROOT:paths.repoRoot,TAIKO_RUNTIME_ENV_FILE:'/proc/self/taiko-account-sync-no-env',TAIKO_USERDATA_DIR:paths.userdataDir,
    TAIKO_WAHLAP_CONFIG_PATH:paths.configPath,TAIKO_ACCOUNT_CACHE_DIR:paths.cacheDir,
    TAIKO_HIROBA_TOKEN_DIR:resolve(paths.repoRoot,'secrets','hiroba_tokens'),TAIKO_HIROBA_COOLDOWN_PATH:resolve(paths.repoRoot,'data','hiroba_sync_cooldown.json'),PYTHONDONTWRITEBYTECODE:'1'});
}
