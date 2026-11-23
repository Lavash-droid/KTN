/** myGov (OIDC) girişi daxili serverdə: saxta provayderlə uçdan-uca. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { client, setup, type TestEnv } from './helpers.ts';

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
let lastNonce = '';
let fin = '1AB2C3D';

/** Saxta provayder: token və userinfo endpoint-ləri. */
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url === 'https://idp.test/token') {
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.ok(body.get('code_verifier'), 'PKCE verifier göndərilməlidir');
    const idToken = `${b64url({ alg: 'none' })}.${b64url({ iss: 'https://idp.test', aud: 'suru-client', exp: Date.now() / 1000 + 300, nonce: lastNonce, sub: 'x' })}.`;
    return Response.json({ id_token: idToken, access_token: 'at' });
  }
  if (url === 'https://idp.test/userinfo') return Response.json({ sub: 'x', fin, given_name: 'Aysel', family_name: 'Quliyeva' });
  throw new Error(`gözlənilməz sorğu: ${url}`);
}) as typeof fetch;

let env: TestEnv;
before(async () => {
  env = await setup(
    {
      MYGOV_CLIENT_ID: 'suru-client',
      MYGOV_CLIENT_SECRET: 'secret',
      MYGOV_AUTHORIZE_URL: 'https://idp.test/authorize',
      MYGOV_TOKEN_URL: 'https://idp.test/token',
      MYGOV_USERINFO_URL: 'https://idp.test/userinfo',
      MYGOV_STATE_SECRET: 's'.repeat(40),
      MYGOV_ID_SECRET: 'i'.repeat(40),
      MYGOV_ALLOWED_REDIRECTS: 'suru://,https://suru.az',
      MYGOV_SUBJECT_CLAIM: 'fin',
    },
    fakeFetch,
  );
});
after(async () => {
  await env?.close();
});

async function login(): Promise<URLSearchParams> {
  const start = await env.app.request('/auth/mygov/start?redirect_to=' + encodeURIComponent('suru://mygov'));
  assert.equal(start.status, 302);
  const auth = new URL(start.headers.get('location')!);
  assert.equal(auth.origin + auth.pathname, 'https://idp.test/authorize');
  assert.equal(auth.searchParams.get('redirect_uri'), 'https://api.test/auth/mygov/callback');
  lastNonce = auth.searchParams.get('nonce')!;
  const cb = await env.app.request(`/auth/mygov/callback?code=abc&state=${encodeURIComponent(auth.searchParams.get('state')!)}`);
  assert.equal(cb.status, 302);
  const back = cb.headers.get('location')!;
  assert.ok(back.startsWith('suru://mygov#'), back);
  return new URLSearchParams(back.split('#')[1]);
}

test('myGov girişi sessiya verir, ferma sahibin adı ilə yaradılır, FİN saxlanılmır', async () => {
  const p = await login();
  assert.ok(p.get('token'));
  assert.equal(p.get('name'), 'Aysel Quliyeva');
  const api = client(env, p.get('token')!);
  const data = await api('GET', '/farm/data');
  assert.equal(data.status, 200);
  assert.equal(data.json.farm.owner, 'Aysel Quliyeva');
  const me = await api('GET', '/auth/me');
  assert.deepEqual(me.json, { id: p.get('user_id'), email: null, name: 'Aysel Quliyeva', provider: 'mygov' });

  const dump = await env.db.query(`select row_to_json(t)::text as j from (select * from users) t union all select row_to_json(e)::text from external_identities e`);
  assert.ok(!dump.rows.some((r) => r.j.includes(fin)), 'FİN bazada açıq saxlanılmamalıdır');

  // Eyni FİN → eyni hesab; fərqli FİN → yeni hesab
  assert.equal((await login()).get('user_id'), p.get('user_id'));
  fin = '9ZZ9ZZ9';
  assert.notEqual((await login()).get('user_id'), p.get('user_id'));
});

test('icazəsiz qayıdış ünvanı rədd edilir', async () => {
  const r = await env.app.request('/auth/mygov/start?redirect_to=' + encodeURIComponent('https://evil.example'));
  assert.equal(r.status, 400);
});

test('konfiqurasiya olmadan 503', async () => {
  const bare = await setup();
  try {
    assert.equal((await bare.app.request('/auth/mygov/start?redirect_to=suru://x')).status, 503);
  } finally {
    await bare.close();
  }
});
