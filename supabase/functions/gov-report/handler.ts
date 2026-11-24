/**
 * Dövlət hesabatları — EKTİS (Kənd Təsərrüfatı Nazirliyi) və AQTA (Qida Təhlükəsizliyi Agentliyi)
 * sistemlərinə körpü.
 *
 * Marşrutlar:
 *   GET  /gov-report/status  → { agencies: { ektis, aqta }, mygovRequired }  — hansı inteqrasiyalar qoşulub
 *   POST /gov-report/submit  → { agency, farmId, payload }                  — hesabatı quruma göndərir
 *
 * Qurumların API-ləri açıq dərc olunmur — inteqrasiya müqavilə əsasında verilir. Ünvan və açarlar
 * mühit dəyişənləri ilə təyin olunur (README: mobile/docs/GOV-REPORTS.md); açarlar təyin olunmayanda
 * göndəriş 503 `not_configured` qaytarır və tətbiq hesabatı fayl kimi ixrac etməyi təklif edir.
 *
 * Tətbiq neytral formatda (suru-gov-report v1) göndərir; qurumun sxeminə çevirmək lazım olarsa
 * yalnız `toAgencyBody` dəyişdirilir. Fayl yalnız Web API-lərindən istifadə edir (Deno və Node-da işləyir).
 */

export type Agency = 'ektis' | 'aqta';
export const AGENCIES: Agency[] = ['ektis', 'aqta'];

export interface AgencyConfig {
  url: string;
  apiKey: string;
  /** Açarın göndərildiyi başlıq — standart: Authorization. */
  authHeader: string;
  /** Açarın önündəki söz (Bearer, ApiKey…); boş ola bilər. */
  authScheme: string;
}

export interface Config {
  agencies: Partial<Record<Agency, AgencyConfig>>;
  /** Birbaşa göndəriş yalnız myGov ilə təsdiqlənmiş hesablardan (qurum göndərənin şəxsiyyətini tələb edir). */
  requireMygov: boolean;
  mygovProvider: string;
  timeoutMs: number;
}

export interface User {
  id: string;
  provider: string;
  name: string;
}

export interface Deps {
  fetch: typeof fetch;
  /** JWT-ni yoxlayır; etibarsızdırsa null. */
  getUser(jwt: string): Promise<User | null>;
  /** İstifadəçi fermaya yaza bilərmi (sahib, işçi, baytar — "viewer" yox). */
  canWrite(farmId: string, userId: string): Promise<boolean>;
}

type Env = (key: string) => string | undefined;

export function loadConfig(env: Env): Config {
  const agencies: Config['agencies'] = {};
  for (const a of AGENCIES) {
    const p = a.toUpperCase();
    const url = env(`${p}_API_URL`);
    const apiKey = env(`${p}_API_KEY`);
    if (url && apiKey && /^https:\/\//.test(url)) {
      agencies[a] = { url, apiKey, authHeader: env(`${p}_AUTH_HEADER`) || 'Authorization', authScheme: env(`${p}_AUTH_SCHEME`) ?? 'Bearer' };
    }
  }
  return {
    agencies,
    requireMygov: env('GOV_REQUIRE_MYGOV') !== 'false',
    mygovProvider: env('MYGOV_PROVIDER_ID') ?? 'mygov',
    timeoutMs: Number(env('GOV_TIMEOUT_MS')) || 20000,
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
const fail = (status: number, error: string, message?: string) => json({ error, ...(message ? { message } : {}) }, status);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 4 * 1024 * 1024;
const MAX_ITEMS = 20000;

/** Neytral formatı qurumun gözlədiyi gövdəyə çevirir. Qurumun sxemi məlum olanda burada uyğunlaşdırın. */
export function toAgencyBody(agency: Agency, payload: Record<string, unknown>, user: User) {
  return { ...payload, agency, submitter: { name: user.name || null, verifiedBy: user.provider }, source: 'suru' };
}

/** Qurumun cavabından qeydiyyat nömrəsini və statusu çıxarır (müxtəlif adlandırmalara dözümlü). */
export function parseAgencyResponse(body: unknown): { status: 'accepted' | 'sent'; reference: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const ref = b.reference ?? b.referenceNumber ?? b.registrationNumber ?? b.number ?? b.id ?? '';
  const st = String(b.status ?? '').toLowerCase();
  return { status: ['accepted', 'registered', 'ok', 'success', 'qəbul'].includes(st) ? 'accepted' : 'sent', reference: String(ref).slice(0, 120) };
}

export async function handle(req: Request, cfg: Config, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);

  if (req.method === 'GET' && url.pathname.endsWith('/status')) {
    return json({ agencies: { ektis: !!cfg.agencies.ektis, aqta: !!cfg.agencies.aqta }, mygovRequired: cfg.requireMygov });
  }
  if (!(req.method === 'POST' && url.pathname.endsWith('/submit'))) return fail(404, 'not_found');

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const user = jwt ? await deps.getUser(jwt).catch(() => null) : null;
  if (!user) return fail(401, 'unauthorized');

  const raw = await req.text();
  if (raw.length > MAX_BODY) return fail(413, 'bad_request', 'Hesabat çox böyükdür');
  let body: { agency?: unknown; farmId?: unknown; payload?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'bad_request');
  }
  const agency = body.agency as Agency;
  const payload = body.payload as Record<string, unknown> | undefined;
  if (!AGENCIES.includes(agency) || typeof body.farmId !== 'string' || !UUID.test(body.farmId)) return fail(400, 'bad_request');
  if (!payload || typeof payload !== 'object' || payload.format !== 'suru-gov-report' || payload.agency !== agency) return fail(400, 'bad_request');
  const items = payload.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) return fail(400, 'bad_request', 'Hesabatda qeyd yoxdur');

  if (!(await deps.canWrite(body.farmId, user.id).catch(() => false))) return fail(403, 'forbidden');
  if (cfg.requireMygov && user.provider !== cfg.mygovProvider) return fail(403, 'mygov_required');

  const target = cfg.agencies[agency];
  if (!target) return fail(503, 'not_configured');

  let res: Response;
  try {
    res = await deps.fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        [target.authHeader]: target.authScheme ? `${target.authScheme} ${target.apiKey}` : target.apiKey,
        // Təkrar göndərişdə qurum eyni hesabatı iki dəfə qeydə almasın.
        'Idempotency-Key': await idempotencyKey(body.farmId, agency, items),
      },
      body: JSON.stringify(toAgencyBody(agency, payload, user)),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (e) {
    console.error('[gov-report] fetch', agency, (e as Error).message);
    return fail(502, 'agency_unavailable');
  }
  let resBody: unknown = null;
  try {
    resBody = await res.json();
  } catch {
    /* JSON deyil */
  }
  if (res.ok) return json(parseAgencyResponse(resBody));
  if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 403 && res.status !== 429) {
    // Qurum hesabatı rədd edib (məs. bırka tapılmadı) — mesajını istifadəçiyə ötürürük.
    const msg = resBody && typeof resBody === 'object' ? String((resBody as Record<string, unknown>).message ?? (resBody as Record<string, unknown>).error ?? '') : '';
    return fail(422, 'rejected', `${agency.toUpperCase()} hesabatı qəbul etmədi${msg ? ': ' + msg.slice(0, 300) : ''}`);
  }
  console.error('[gov-report] agency status', agency, res.status);
  return fail(502, 'agency_unavailable');
}

/** Eyni ferma + qurum + qeydlər dəsti üçün sabit açar. */
async function idempotencyKey(farmId: string, agency: string, items: unknown[]): Promise<string> {
  const keys = items.map((i) => String((i as { key?: unknown })?.key ?? '')).sort().join(',');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${farmId}|${agency}|${keys}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
