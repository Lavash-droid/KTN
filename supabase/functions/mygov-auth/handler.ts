/**
 * myGov / dövlət vahid girişi (OAuth 2.0 + OpenID Connect) — Supabase sessiyasına körpü.
 *
 * Axın:
 *   1. Tətbiq brauzeri açır:  GET /mygov-auth/start?redirect_to=<tətbiqin ünvanı>
 *   2. Funksiya istifadəçini provayderin giriş səhifəsinə yönləndirir (state + PKCE + nonce).
 *   3. Provayder geri qaytarır:  GET /mygov-auth/callback?code=…&state=…
 *   4. Funksiya kodu tokenə dəyişir (client_secret serverdə qalır), istifadəçinin identifikatorunu
 *      (FİN və s.) götürür, HMAC ilə hash-ləyir, uyğun Supabase istifadəçisini tapır və ya yaradır.
 *   5. Birdəfəlik giriş tokeni (magic link token_hash) yaradıb tətbiqə qaytarır:
 *      <redirect_to>#token_hash=…&type=email
 *   6. Tətbiq `supabase.auth.verifyOtp({ token_hash, type: 'email' })` ilə sessiya alır.
 *
 * Bu fayl yalnız Web API-lərindən (fetch, crypto.subtle, Request/Response) istifadə edir —
 * Deno-da (Edge Function) və Node-da (testlər) eyni işləyir. Supabase-ə bağlı hissələr `Deps`-dədir.
 *
 * Provayderin texniki sənədləri (İRİA / digital.login, ASAN Login) müqavilədən sonra verilir.
 * Bütün ünvanlar, claim adları və autentifikasiya üsulu mühit dəyişənləri ilə tənzimlənir (README.md).
 */

export interface Config {
  providerId: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  issuer?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  /** client_secret_basic (Authorization başlığı) və ya client_secret_post (gövdədə). */
  tokenAuth: 'client_secret_basic' | 'client_secret_post';
  usePkce: boolean;
  /** İstifadəçini unikal təyin edən claim (məs. sub, fin, pin). */
  subjectClaim: string;
  nameClaim?: string;
  callbackUrl: string;
  stateSecret: string;
  idSecret: string;
  /** İcazəli qayıdış ünvanları: "https://app.suru.az" (origin) və ya "suru://" (sxem). */
  allowedRedirects: string[];
  emailDomain: string;
  extraAuthorizeParams: Record<string, string>;
}

export interface Deps {
  fetch: typeof fetch;
  findUser(subjectHash: string): Promise<string | null>;
  findUserByEmail(email: string): Promise<string | null>;
  createUser(email: string, fullName: string): Promise<string>;
  linkIdentity(subjectHash: string, userId: string): Promise<void>;
  updateName(userId: string, fullName: string): Promise<void>;
  getEmail(userId: string): Promise<string>;
  magicLinkHash(email: string): Promise<string>;
  now?: () => number;
}

type Env = (key: string) => string | undefined;

export function loadConfig(env: Env): Config | { error: string } {
  const req = ['MYGOV_CLIENT_ID', 'MYGOV_CLIENT_SECRET', 'MYGOV_STATE_SECRET', 'MYGOV_ID_SECRET', 'MYGOV_ALLOWED_REDIRECTS'];
  const missing = req.filter((k) => !env(k));
  if (!env('MYGOV_ISSUER') && !(env('MYGOV_AUTHORIZE_URL') && env('MYGOV_TOKEN_URL'))) missing.push('MYGOV_ISSUER və ya MYGOV_AUTHORIZE_URL+MYGOV_TOKEN_URL');
  const base = env('SUPABASE_URL');
  if (!env('MYGOV_CALLBACK_URL') && !base) missing.push('SUPABASE_URL');
  if (missing.length) return { error: `myGov girişi konfiqurasiya olunmayıb: ${missing.join(', ')}` };
  if ((env('MYGOV_STATE_SECRET') ?? '').length < 32 || (env('MYGOV_ID_SECRET') ?? '').length < 32) {
    return { error: 'MYGOV_STATE_SECRET və MYGOV_ID_SECRET ən azı 32 simvol olmalıdır' };
  }
  let extra: Record<string, string> = {};
  try {
    extra = env('MYGOV_EXTRA_AUTHORIZE_PARAMS') ? JSON.parse(env('MYGOV_EXTRA_AUTHORIZE_PARAMS')!) : {};
  } catch {
    return { error: 'MYGOV_EXTRA_AUTHORIZE_PARAMS düzgün JSON deyil' };
  }
  return {
    providerId: env('MYGOV_PROVIDER_ID') ?? 'mygov',
    clientId: env('MYGOV_CLIENT_ID')!,
    clientSecret: env('MYGOV_CLIENT_SECRET')!,
    scope: env('MYGOV_SCOPE') ?? 'openid profile',
    issuer: env('MYGOV_ISSUER')?.replace(/\/+$/, ''),
    authorizeUrl: env('MYGOV_AUTHORIZE_URL'),
    tokenUrl: env('MYGOV_TOKEN_URL'),
    userinfoUrl: env('MYGOV_USERINFO_URL'),
    tokenAuth: env('MYGOV_TOKEN_AUTH') === 'client_secret_post' ? 'client_secret_post' : 'client_secret_basic',
    usePkce: env('MYGOV_PKCE') !== 'false',
    subjectClaim: env('MYGOV_SUBJECT_CLAIM') ?? 'sub',
    nameClaim: env('MYGOV_NAME_CLAIM'),
    callbackUrl: env('MYGOV_CALLBACK_URL') ?? `${base!.replace(/\/+$/, '')}/functions/v1/mygov-auth/callback`,
    stateSecret: env('MYGOV_STATE_SECRET')!,
    idSecret: env('MYGOV_ID_SECRET')!,
    allowedRedirects: env('MYGOV_ALLOWED_REDIRECTS')!.split(',').map((s) => s.trim()).filter(Boolean),
    emailDomain: env('MYGOV_EMAIL_DOMAIN') ?? 'mygov.suru.az',
    extraAuthorizeParams: extra,
  };
}

/* ---------- kriptoqrafiya köməkçiləri ---------- */
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
const randomB64 = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));

async function aesKey(secret: string) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('suru-state:' + secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** state — şifrələnmiş və autentifikasiya olunmuş (AES-GCM): qayıdış ünvanı, PKCE verifier, nonce, müddət. */
async function sealState(secret: string, data: object): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), enc.encode(JSON.stringify(data))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64url(out);
}
async function openState<T>(secret: string, state: string): Promise<T | null> {
  try {
    const raw = fromB64url(state);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await aesKey(secret), raw.slice(12));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    return null;
  }
}

export async function hashSubject(secret: string, provider: string, subject: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${provider}:${subject.trim()}`)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length < 2) throw new Error('id_token formatı yanlışdır');
  return JSON.parse(dec.decode(fromB64url(parts[1])));
}

/* ---------- qayıdış ünvanının yoxlanması (açıq yönləndirmə və token oğurluğunun qarşısı) ---------- */
export function isAllowedRedirect(target: string, allowed: string[]): boolean {
  let u: URL;
  try {
    u = new URL(target);
  } catch {
    return false;
  }
  return allowed.some((entry) => {
    if (/^[a-z][a-z0-9+.-]*:\/\/$/i.test(entry)) return u.protocol === entry.slice(0, -2).toLowerCase();
    try {
      return new URL(entry).origin === u.origin;
    } catch {
      return false;
    }
  });
}

/* ---------- OIDC endpoint-ləri ---------- */
interface Endpoints {
  authorize: string;
  token: string;
  userinfo?: string;
}
let discoveryCache: { issuer: string; at: number; ep: Endpoints } | null = null;

async function endpoints(cfg: Config, f: typeof fetch): Promise<Endpoints> {
  if (cfg.authorizeUrl && cfg.tokenUrl) return { authorize: cfg.authorizeUrl, token: cfg.tokenUrl, userinfo: cfg.userinfoUrl };
  if (discoveryCache && discoveryCache.issuer === cfg.issuer && Date.now() - discoveryCache.at < 3600_000) return discoveryCache.ep;
  const res = await f(`${cfg.issuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`discovery ${res.status}`);
  const d = await res.json();
  const ep = { authorize: cfg.authorizeUrl ?? d.authorization_endpoint, token: cfg.tokenUrl ?? d.token_endpoint, userinfo: cfg.userinfoUrl ?? d.userinfo_endpoint };
  discoveryCache = { issuer: cfg.issuer!, at: Date.now(), ep };
  return ep;
}

/* ---------- cavablar ---------- */
const STATE_TTL_MS = 10 * 60 * 1000;

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
function withFragment(base: string, params: Record<string, string>): string {
  const u = base.split('#')[0];
  return `${u}#${new URLSearchParams(params).toString()}`;
}
function plain(status: number, text: string): Response {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

interface StateData {
  r: string; // redirect_to
  v?: string; // PKCE verifier
  n: string; // nonce
  e: number; // bitmə vaxtı (ms)
}

export async function handle(req: Request, cfg: Config, deps: Deps): Promise<Response> {
  const url = new URL(req.url);
  const now = deps.now ?? Date.now;

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  /* 1. Başlanğıc */
  if (url.pathname.endsWith('/start')) {
    const target = url.searchParams.get('redirect_to') ?? '';
    if (!isAllowedRedirect(target, cfg.allowedRedirects)) return plain(400, 'redirect_to icazəli deyil');
    let ep: Endpoints;
    try {
      ep = await endpoints(cfg, deps.fetch);
    } catch {
      return redirect(withFragment(target, { error: 'provider_unavailable' }));
    }
    const nonce = randomB64(16);
    const verifier = cfg.usePkce ? randomB64(32) : undefined;
    const state = await sealState(cfg.stateSecret, { r: target, v: verifier, n: nonce, e: now() + STATE_TTL_MS } satisfies StateData);
    const p = new URLSearchParams({
      response_type: 'code',
      client_id: cfg.clientId,
      redirect_uri: cfg.callbackUrl,
      scope: cfg.scope,
      state,
      nonce,
      ...cfg.extraAuthorizeParams,
    });
    if (verifier) {
      const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))));
      p.set('code_challenge', challenge);
      p.set('code_challenge_method', 'S256');
    }
    return redirect(`${ep.authorize}${ep.authorize.includes('?') ? '&' : '?'}${p.toString()}`);
  }

  /* 2. Provayderdən qayıdış */
  if (url.pathname.endsWith('/callback')) {
    const st = await openState<StateData>(cfg.stateSecret, url.searchParams.get('state') ?? '');
    if (!st || !isAllowedRedirect(st.r, cfg.allowedRedirects)) return plain(400, 'state etibarsızdır');
    const back = (params: Record<string, string>) => redirect(withFragment(st.r, params));
    if (st.e < now()) return back({ error: 'expired', error_description: 'Giriş müddəti bitdi, yenidən cəhd edin' });
    const provErr = url.searchParams.get('error');
    if (provErr) return back({ error: provErr === 'access_denied' ? 'access_denied' : 'provider_error', error_description: url.searchParams.get('error_description') ?? '' });
    const code = url.searchParams.get('code');
    if (!code) return back({ error: 'provider_error', error_description: 'code yoxdur' });

    try {
      const ep = await endpoints(cfg, deps.fetch);
      // Kodun tokenə dəyişdirilməsi — client_secret yalnız serverdədir.
      const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.callbackUrl });
      if (st.v) body.set('code_verifier', st.v);
      const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
      if (cfg.tokenAuth === 'client_secret_basic') {
        headers.Authorization = 'Basic ' + btoa(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`);
      } else {
        body.set('client_id', cfg.clientId);
        body.set('client_secret', cfg.clientSecret);
      }
      const tr = await deps.fetch(ep.token, { method: 'POST', headers, body });
      if (!tr.ok) throw new Error(`token ${tr.status}`);
      const tok = (await tr.json()) as { id_token?: string; access_token?: string };

      let claims: Record<string, unknown> = {};
      if (tok.id_token) {
        // id_token birbaşa token endpoint-dən TLS üzərindən, client autentifikasiyası ilə alınıb —
        // OIDC Core 3.1.3.7(6): bu halda imza yoxlaması əvəzinə TLS server yoxlaması kifayətdir.
        claims = decodeJwtPayload(tok.id_token);
        const aud = claims.aud;
        const audOk = Array.isArray(aud) ? aud.includes(cfg.clientId) : aud === cfg.clientId;
        if (!audOk) throw new Error('id_token aud uyğun deyil');
        if (typeof claims.exp === 'number' && claims.exp * 1000 < now()) throw new Error('id_token vaxtı keçib');
        if (cfg.issuer && claims.iss && String(claims.iss).replace(/\/+$/, '') !== cfg.issuer) throw new Error('id_token iss uyğun deyil');
        if (claims.nonce !== undefined && claims.nonce !== st.n) throw new Error('nonce uyğun deyil');
      }
      if (ep.userinfo && tok.access_token) {
        const ui = await deps.fetch(ep.userinfo, { headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json' } });
        if (!ui.ok) throw new Error(`userinfo ${ui.status}`);
        const info = (await ui.json()) as Record<string, unknown>;
        if (claims.sub !== undefined && info.sub !== undefined && info.sub !== claims.sub) throw new Error('userinfo sub uyğun deyil');
        claims = { ...claims, ...info };
      }

      const subject = claims[cfg.subjectClaim];
      if (subject === undefined || subject === null || String(subject).trim() === '') throw new Error(`"${cfg.subjectClaim}" claim-i yoxdur`);
      const fullName = String(
        (cfg.nameClaim && claims[cfg.nameClaim]) ||
          claims.name ||
          [claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
          '',
      ).trim();

      const subjectHash = await hashSubject(cfg.idSecret, cfg.providerId, String(subject));
      let userId = await deps.findUser(subjectHash);
      let email: string;
      if (userId) {
        email = await deps.getEmail(userId);
        if (fullName) await deps.updateName(userId, fullName);
      } else {
        email = `${cfg.providerId}-${subjectHash.slice(0, 32)}@${cfg.emailDomain}`;
        userId = (await deps.findUserByEmail(email)) ?? (await deps.createUser(email, fullName));
        await deps.linkIdentity(subjectHash, userId);
      }
      const tokenHash = await deps.magicLinkHash(email);
      return back({ token_hash: tokenHash, type: 'email' });
    } catch (e) {
      console.error('[mygov-auth]', (e as Error).message);
      return back({ error: 'server_error', error_description: 'Giriş tamamlanmadı' });
    }
  }

  return plain(404, 'Not found');
}
