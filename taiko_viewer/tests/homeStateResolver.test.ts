import test from "node:test";
import assert from "node:assert/strict";
import {
  HomeStateResolverError,
  resolveHomeState,
  type HomeAuthPayload,
  type HomeBindingPayload,
  type HomeScoresPayload
} from "../utils/homeState.ts";

const user = { id: 7, username: "tester" };
const binding: HomeBindingPayload["currentBinding"] = {
  id: 11,
  taikoId: "12345678",
  source: "manual",
  isCurrent: true
};

const createRequests = (values: {
  auth?: HomeAuthPayload | (() => Promise<HomeAuthPayload>);
  binding?: HomeBindingPayload | (() => Promise<HomeBindingPayload>);
  scores?: HomeScoresPayload | (() => Promise<HomeScoresPayload>);
}) => {
  const calls: string[] = [];
  const request = <T>(name: string, value: T | (() => Promise<T>)) => async () => {
    calls.push(name);
    return typeof value === "function" ? (value as () => Promise<T>)() : value;
  };
  return {
    calls,
    requests: {
      auth: request("auth", values.auth || { authenticated: false, user: null }),
      binding: request("binding", values.binding || { bindings: [], currentBinding: null }),
      scores: request("scores", values.scores || { total: 0, items: [] })
    }
  };
};

const authenticated = { authenticated: true, user };

test("guest resolves without binding or score requests", async () => {
  const { calls, requests } = createRequests({ auth: { authenticated: false, user: null } });
  const result = await resolveHomeState(requests);
  assert.equal(result.homeState, "guest");
  assert.deepEqual(calls, ["auth"]);
});

test("authenticated user without current binding resolves unbound", async () => {
  const { calls, requests } = createRequests({
    auth: authenticated,
    binding: { bindings: [], currentBinding: null }
  });
  const result = await resolveHomeState(requests);
  assert.equal(result.homeState, "authenticated_unbound");
  assert.deepEqual(calls, ["auth", "binding"]);
});

test("bound user with no effective score resolves bound empty", async () => {
  const { calls, requests } = createRequests({
    auth: authenticated,
    binding: { bindings: [binding], currentBinding: binding },
    scores: { total: 0, items: [] }
  });
  const result = await resolveHomeState(requests);
  assert.equal(result.homeState, "authenticated_bound_empty");
  assert.deepEqual(calls, ["auth", "binding", "scores"]);
});

test("bound user with an effective score resolves ready", async () => {
  const { requests } = createRequests({
    auth: authenticated,
    binding: { bindings: [binding], currentBinding: binding },
    scores: { total: 1, items: [{ highScore: 920000 }] }
  });
  const result = await resolveHomeState(requests);
  assert.equal(result.homeState, "authenticated_ready");
  assert.equal(result.hasScores, true);
});

test("auth failure is an error, not guest", async () => {
  const { requests } = createRequests({
    auth: async () => {
      throw new Error("auth unavailable");
    }
  });
  await assert.rejects(() => resolveHomeState(requests), (error: unknown) => {
    assert.ok(error instanceof HomeStateResolverError);
    assert.equal(error.stage, "auth");
    return true;
  });
});

test("binding failure is an error, not unbound", async () => {
  const { requests } = createRequests({
    auth: authenticated,
    binding: async () => {
      throw new Error("binding unavailable");
    }
  });
  await assert.rejects(() => resolveHomeState(requests), (error: unknown) => {
    assert.ok(error instanceof HomeStateResolverError);
    assert.equal(error.stage, "binding");
    return true;
  });
});

test("score failure is an error, not bound empty", async () => {
  const { requests } = createRequests({
    auth: authenticated,
    binding: { bindings: [binding], currentBinding: binding },
    scores: async () => {
      throw new Error("scores unavailable");
    }
  });
  await assert.rejects(() => resolveHomeState(requests), (error: unknown) => {
    assert.ok(error instanceof HomeStateResolverError);
    assert.equal(error.stage, "scores");
    return true;
  });
});
