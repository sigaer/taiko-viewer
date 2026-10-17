import { validateAccountSchema, clearAccountSchemaValidation, type AccountSchemaScope } from "./account-schema-runtime";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

let pool: Pool | null = null;
const nativeConfigs = new WeakMap<Pool, Readonly<ReturnType<typeof getDbConfig>>>();

const getDbConfig = () => {
  const runtimeConfig = useRuntimeConfig();
  const config = {
    host: String(runtimeConfig.dbHost || process.env.TAIKO_DB_HOST || "127.0.0.1"),
    port: Number(runtimeConfig.dbPort || process.env.TAIKO_DB_PORT || 3306),
    user: String(runtimeConfig.dbUser || process.env.TAIKO_DB_USER || ""),
    password: String(runtimeConfig.dbPassword || process.env.TAIKO_DB_PASSWORD || ""),
    database: String(runtimeConfig.dbName || process.env.TAIKO_DB_NAME || "taiko")
  };
  if (process.env.NODE_ENV === "production") {
    if (!config.user || !config.password) {
      throw new Error("Account database credentials are not configured");
    }
    if (config.user.toLowerCase() === "root") {
      throw new Error("Account database must use a dedicated non-root user");
    }
  }
  return config;
};

export const assertAccountDbConfiguration = () => {
  getDbConfig();
};

export const getAccountDb = () => {
  if (!pool) {
    const config = getDbConfig();
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit: 10,
      namedPlaceholders: true,
      charset: "utf8mb4"
    });
    nativeConfigs.set(pool, Object.freeze({ ...config }));
  }
  return pool;
};

/** Private worker composition uses the captured pool's credentials. Never
 * re-read globals or expose this configuration in an API response. */
export const getAccountDbNativeConfig = (captured: Pool) => {
  const config = nativeConfigs.get(captured);
  if (!config) throw new Error("Account database is unavailable");
  return config;
};

export const closeAccountDb = async () => {
  const currentPool = pool;
  pool = null;
  clearAccountSchemaValidation(currentPool);
  if (currentPool) await currentPool.end();
};

/** Runtime validation is read-only. Administrative schema changes are explicit. */
export const ensureAccountSchema = (scope: AccountSchemaScope = "legacy") => validateAccountSchema(getAccountDb(), scope);
export type DbRow<T> = T & RowDataPacket;
