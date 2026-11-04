import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK } from 'jose';
import { installSchemaModuleLoader } from '../scripts/schema_module_loader.mjs';
const loader = installSchemaModuleLoader();
const { createViewerProvider } = await import('../server/services/reverse-oidc/provider.ts');

test('maintained Provider registers only the fixed issuer and confidential code client', async () => {
  const { privateKey } = await generateKeyPair('RS256', {extractable:true});
  const key = {...await exportJWK(privateKey), kid:'isolated-test',use:'sig',alg:'RS256'};
  const provider = createViewerProvider({execute:async()=>[[],[]]},
    {clientSecret:'isolated-test-client-secret-not-production',cookieKeys:['isolated-test-cookie-key-not-production'],jwks:{keys:[key]}});
  assert.equal(provider.issuer,'https://viewer.sakura-bot.cn/oidc');
  const client = await provider.Client.find('OurTaiko');
  assert.deepEqual(client.redirectUris,['https://sso.ourtaiko.org/login/sakura/callback/']);
  assert.deepEqual(client.responseTypes,['code']);
  assert.deepEqual(client.grantTypes,['authorization_code']);
  assert.equal(client.idTokenSignedResponseAlg,'RS256');
  assert.equal(await provider.Client.find('Sakura'),undefined);
});
test.after(()=>loader.deregister());
