import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as vue from 'vue';

for (const name of ['usePlayerGrowth', 'useRecentGrowth']) {
  test(`${name}: SSR does no request; hydration and binding changes each load once`, async () => {
    const source = await readFile(new URL(`../composables/${name}.ts`, import.meta.url), 'utf8');
    const binding = vue.ref({ id: 1 }), enabled = vue.ref(true), user = vue.ref(9);
    const calls = [];
    const globals = { ...vue, useHomeState: () => ({ currentBinding: binding }), useViewerApiFetch: () => async (path, options) => {
      assert.equal(options.retry, 0);
      calls.push(path);
      return { profileId: String(binding.value.id), boundary: {} };
    } };
    const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    Object.assign(globalThis, globals);
    const scopes = [];
    try {
      const instantiate = async server => {
        const code = ts.transpileModule(source.replaceAll('import.meta.server', String(server)), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
        const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
        const scope = vue.effectScope(); scopes.push(scope);
        return { scope, state: scope.run(() => module[name](enabled, user)) };
      };
      const ssr = await instantiate(true);
      await vue.nextTick();
      assert.equal(calls.length, 0);
      assert.equal(ssr.state.pending.value, true);
      await ssr.state.refresh();
      assert.equal(calls.length, 0);
      ssr.scope.stop();
      const client = await instantiate(false);
      await vue.nextTick();
      assert.equal(calls.length, 1);
      assert.equal(client.state.pending.value, false);
      binding.value = { id: 2 };
      await vue.nextTick();
      assert.equal(calls.length, 2);
      enabled.value = false;
      await vue.nextTick();
      assert.equal(calls.length, 2);
      assert.equal(client.state.pending.value, false);
    } finally {
      for (const scope of scopes) scope.stop();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  });
}
