/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { loader } = require('./issues/load-ts.cjs');

async function discordFlow(issuer) {
  const { default: Discord } = await import('next-auth/providers/discord');
  const nextAuthRequire = createRequire(require.resolve('next-auth'));
  const { Auth, customFetch } = await import(pathToFileURL(nextAuthRequire.resolve('@auth/core')).href);
  let appConfig;
  loader({
    'next-auth': { __esModule: true, default: (config) => { appConfig = config; return {}; } },
    'next-auth/providers/discord': { __esModule: true, default: Discord },
    'next-auth/providers/credentials': { __esModule: true, default: (config) => config },
    '@auth/prisma-adapter': { PrismaAdapter: () => undefined },
    'src/lib/db': { db: {} },
    'src/lib/discord': {},
  })('auth.ts');

  const provider = appConfig.providers
    .map((entry) => typeof entry === 'function' ? entry() : entry)
    .find((entry) => entry.id === 'discord');
  const requests = [];
  const errors = [];
  // Exercise Auth.js itself; token/profile responses and persistence stay in memory.
  const config = {
    ...appConfig,
    adapter: undefined,
    callbacks: {},
    secret: 'discord-callback-regression-test-secret',
    providers: [{
      ...provider,
      options: {
        ...provider.options,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        [customFetch]: async (url, init) => {
          requests.push(String(url));
          if (String(url) === 'https://discord.com/api/oauth2/token') {
            assert.ok(init.body.get('code_verifier'), 'PKCE remains enabled');
            return Response.json({ access_token: 'test-token', token_type: 'Bearer', expires_in: 3600 });
          }
          assert.equal(String(url), 'https://discord.com/api/users/@me');
          return Response.json({
            id: '123456789012345678', username: 'tester', global_name: 'Tester',
            discriminator: '0', avatar: null, email: 'tester@example.com',
          });
        },
      },
    }],
    logger: { error: (error) => errors.push(error), warn() {}, debug() {} },
  };
  const cookies = new Map();
  async function request(path, init = {}) {
    const response = await Auth(new Request(`https://tracker.example/api/auth/${path}`, {
      ...init,
      headers: { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') },
    }), config);
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const equals = pair.indexOf('=');
      cookies.set(pair.slice(0, equals), pair.slice(equals + 1));
    }
    return response;
  }

  const csrfResponse = await request('csrf');
  const { csrfToken } = await csrfResponse.json();
  const signInResponse = await request('signin/discord', {
    method: 'POST', body: new URLSearchParams({ csrfToken }),
  });
  assert.equal(signInResponse.status, 302);
  const authorization = new URL(signInResponse.headers.get('location'));
  assert.equal(authorization.origin, 'https://discord.com');
  assert.equal(authorization.searchParams.get('scope'), 'identify email');
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  const params = new URLSearchParams({ code: 'test-code' });
  if (issuer !== undefined) params.set('iss', issuer);
  const response = await request(`callback/discord?${params}`);
  return { response, requests, errors, cookies };
}

for (const issuer of ['https://discord.com', undefined]) {
  test(`Discord callback signs in ${issuer ? 'with its issuer' : 'without an optional issuer'}`, async () => {
    const { response, requests, errors, cookies } = await discordFlow(issuer);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://tracker.example');
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, [
      'https://discord.com/api/oauth2/token', 'https://discord.com/api/users/@me',
    ]);
    assert.ok(cookies.get('__Secure-authjs.session-token'));
  });
}

test('Discord callback rejects another issuer before exchanging the code', async () => {
  const { response, requests, errors, cookies } = await discordFlow('https://other.example');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://tracker.example/api/auth/error?error=Configuration');
  assert.deepEqual(requests, []);
  assert.equal(errors[0]?.type, 'CallbackRouteError');
  assert.equal(errors[0]?.cause?.expected, 'https://discord.com');
  assert.match(errors[0]?.cause?.err?.message, /unexpected "iss"/);
  assert.equal(cookies.has('__Secure-authjs.session-token'), false);
});
