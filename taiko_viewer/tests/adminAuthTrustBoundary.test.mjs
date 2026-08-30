import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const readProjectFile = (path) => readFile(new URL(path, projectRoot), "utf8");

const readEnvFile = async (path) => {
  try {
    const source = await readFile(path, "utf8");
    return Object.fromEntries(
      source
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
        .filter(Boolean)
        .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, "")])
    );
  } catch {
    return {};
  }
};

const getFreePort = async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const waitForServer = async (url, child) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`viewer exited with ${child.exitCode}`);
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("viewer did not start in time");
};

test("Taiko Admin authorization delegates authenticity to the trusted backend", async (t) => {
  const [authSource, ugcSource] = await Promise.all([
    readProjectFile("server/utils/admin/auth.ts"),
    readProjectFile("server/utils/admin/ugc-auth.ts")
  ]);
  assert.doesNotMatch(authSource, /decodeJwtSegment|parseTaikoAdminToken/);
  assert.match(authSource, /\/taiko\/manage\/auth\/me/);
  assert.match(ugcSource, /requireModerator/);
  const adminRoutes = (await readdir(new URL("server/api/admin", projectRoot), { recursive: true }))
    .filter((path) => path.endsWith(".ts"));
  for (const route of adminRoutes) {
    const source = await readProjectFile(`server/api/admin/${route}`);
    if (!route.startsWith("auth/login") && !route.startsWith("auth/logout")) {
      assert.match(source, /requireTaikoAdminSession|withTaikoAdminToken|requireUgcModerator/);
    }
  }

  const remote = createServer((request, response) => {
    if (request.url !== "/taiko/manage/auth/me") {
      response.writeHead(404).end();
      return;
    }
    const authorization = request.headers.authorization || "";
    if (authorization === "Bearer backend-failure") {
      response.writeHead(500, { "content-type": "application/json" }).end();
      return;
    }
    if (authorization !== "Bearer trusted-isolated-token") {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ code: -1, msg: "token invalid", data: null }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      code: 0,
      msg: "ok",
      data: { id: 1, username: "isolated-admin", exp: Math.floor(Date.now() / 1000) + 3600 }
    }));
  });
  await new Promise((resolve) => remote.listen(0, "127.0.0.1", resolve));
  t.after(() => remote.close());

  const viewerPort = await getFreePort();
  const testEnv = await readEnvFile("/etc/taiko-viewer.env");
  const child = spawn(process.execPath, [".output/server/index.mjs"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: {
      ...process.env,
      ...testEnv,
      NODE_ENV: "test",
      PORT: String(viewerPort),
      TAIKO_ADMIN_API_BASE: `http://127.0.0.1:${remote.address().port}`,
      NUXT_TAIKO_ADMIN_API_BASE: `http://127.0.0.1:${remote.address().port}`
    },
    stdio: "ignore"
  });
  t.after(() => child.kill("SIGTERM"));

  const endpoint = `http://127.0.0.1:${viewerPort}/api/admin/auth/me`;
  await waitForServer(endpoint, child);

  const forged = [
    ["alg:none", "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZCI6OTk5OTk5LCJ1c2VybmFtZSI6ImZvcmdlZCIsImV4cCI6NDAwMDAwMDAwMH0."],
    ["bogus signature", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTk5OTk5LCJ1c2VybmFtZSI6ImZvcmdlZCIsImV4cCI6NDAwMDAwMDAwMH0.bogus"],
    ["random", "not-a-jwt"],
    ["expired", "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJvbGQiLCJleHAiOjF9.bogus"],
    ["missing identity", "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjQwMDAwMDAwMDB9.bogus"]
  ];
  for (const [label, token] of forged) {
    const bearer = await fetch(endpoint, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(bearer.status, 401, `${label} bearer must be rejected`);
    const cookie = await fetch(endpoint, { headers: { cookie: `taiko_admin_session=${token}` } });
    assert.equal(cookie.status, 401, `${label} cookie must be rejected`);
  }

  const valid = await fetch(endpoint, {
    headers: { authorization: "Bearer trusted-isolated-token" }
  });
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).user.username, "isolated-admin");

  const unavailable = await fetch(endpoint, {
    headers: { authorization: "Bearer backend-failure" }
  });
  assert.equal(unavailable.status, 503);
});
