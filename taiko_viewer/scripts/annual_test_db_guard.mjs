import assert from "node:assert/strict";

const TEST_DATABASE_SUFFIX = "_test";

const mutationOptedIn = () => process.env.TAIKO_ALLOW_TEST_DB_MUTATION === "1";

const describeDatabase = (value) => String(value || "").trim();

export const assertTestDatabaseMutationAllowed = async (connection) => {
  const [rows] = await connection.query("SELECT DATABASE() AS databaseName, CURRENT_USER() AS currentUser");
  const databaseName = describeDatabase(rows?.[0]?.databaseName);
  const currentUser = describeDatabase(rows?.[0]?.currentUser);
  if (!databaseName.endsWith(TEST_DATABASE_SUFFIX) || !mutationOptedIn()) {
    throw new Error("Refusing mutating DB operation outside an explicitly allowed test database.");
  }
  const [grantRows] = await connection.query("SHOW GRANTS");
  const grants = grantRows.map((row) => String(Object.values(row)[0] || "")).join("\n");
  assert.match(databaseName, /_test$/, "test database name must end with _test");
  assert.ok(currentUser, "test connection user is missing");
  assert.ok(grants.includes("`" + databaseName + "`.*"), "test user must have privileges on the selected test database");
  const unsafeGlobalGrant = grants.split("\n").some((grant) => / ON \*\.\* TO/i.test(grant) && !/^GRANT USAGE ON \*\.\*/i.test(grant));
  assert.equal(unsafeGlobalGrant, false, "test user must not have production or global database privileges");
  assert.doesNotMatch(grants, /SUPER|FILE|PROCESS|CREATE USER|GRANT OPTION/i, "test user has an unsafe privilege");
  return { databaseName, currentUser, grants };
};

export const assertTestDatabaseReadOnly = async (connection) => {
  const [rows] = await connection.query("SELECT DATABASE() AS databaseName, CURRENT_USER() AS currentUser");
  const databaseName = describeDatabase(rows?.[0]?.databaseName);
  if (!databaseName.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error("Refusing destructive/integration DB operation outside test database.");
  }
  return { databaseName, currentUser: describeDatabase(rows?.[0]?.currentUser) };
};

export const assertMutationOptIn = () => {
  if (!mutationOptedIn()) throw new Error("Refusing mutating DB operation outside an explicitly allowed test database.");
};
