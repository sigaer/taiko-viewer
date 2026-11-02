import test from 'node:test';
import assert from 'node:assert/strict';
import { oidcProviders, safeOidcReturnPath } from '../server/services/oidc/config.ts';

const provider = { enabled: true, id: 'mock', label: 'Mock', issuer: 'https://issuer.example', clientId: 'viewer', redirectUri: 'https://viewer.example/api/account/oidc/mock/callback' };
test('OIDC registry fails closed and requires server configured HTTPS and exact callback routes', () => {
  const config = { oidcEnabled: false, oidcProvidersJson: JSON.stringify([provider]) };
  globalThis.useRuntimeConfig = () => config;
  try {
    assert.deepEqual(oidcProviders(), []);
    config.oidcEnabled = true;
    assert.equal(oidcProviders()[0].issuer, provider.issuer);
    config.oidcEnabled = 1; config.oidcProvidersJson = [provider];
    assert.equal(oidcProviders()[0].issuer, provider.issuer, 'Nitro-parsed runtime environment values');
    for (const changes of [{ issuer: 'http://issuer.example' }, { redirectUri: 'http://viewer.example/api/account/oidc/mock/callback' }, { redirectUri: provider.redirectUri + '?next=x' }, { redirectUri: 'https://viewer.example/callback' }, { scopes: ['email'] }, { id: '../other' }, { id: ['mock'] }, { clientSecret: 42 }, { endpointOrigins: ['https://issuer.example/path'] }, { tokenEndpointAuthMethod: 'client_secret_basic' }]) {
      config.oidcProvidersJson = JSON.stringify([{ ...provider, ...changes }]);
      assert.throws(() => oidcProviders());
    }
    config.oidcProvidersJson = JSON.stringify([provider, { ...provider, id: 'second' }]);
    assert.throws(() => oidcProviders());
    config.oidcProvidersJson = JSON.stringify([{ ...provider, enabled: false }]);
    assert.deepEqual(oidcProviders(), []);
  } finally { delete globalThis.useRuntimeConfig; }
});

test('OIDC return locations reject external URLs and browser/proxy reinterpretation', () => {
  for (const path of ['//evil.example', 'https://evil.example', '/\\evil.example', '/%5cevil.example', '/%2f%2fevil.example', '/%252f%252fevil.example', '/%2525255cevil.example', '/a/..//evil.example', '/%00', '/%0d%0aLocation:evil', '/api/account/auth/logout', '/%61pi/account/auth/logout', '/ja/api/x', '/bad%']) {
    assert.equal(safeOidcReturnPath(path), '/account/profile', path);
  }
  for (const path of ['/songs/123?level=4', '/ja/account/profile', '/forum#threads']) assert.equal(safeOidcReturnPath(path), path);
});
