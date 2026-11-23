/** Server konfiqurasiyası — yalnız mühit dəyişənlərindən (bax: .env.example). */
import path from 'node:path';

export interface Config {
  port: number;
  databaseUrl: string;
  /** Şəkillərin saxlandığı qovluq: <STORAGE_DIR>/<farm_id>/<fayl>.jpg */
  storageDir: string;
  /** Serverin xaricdən görünən ünvanı (imzalı şəkil URL-ləri üçün), məs. https://api.suru.az */
  publicUrl: string;
  /** İmzalı şəkil URL-ləri üçün gizli açar (≥ 32 simvol). */
  photoSecret: string;
  /** Brauzerdən (veb panel, sayt) sorğuya icazə verilən ünvanlar. */
  corsOrigins: string[];
  /** Reverse proxy (Caddy/nginx) arxasında: müştəri IP-si X-Forwarded-For-dan götürülür. */
  trustProxy: boolean;
  sessionTtlDays: number;
  maxPhotoBytes: number;
  /** Yeni qeydiyyat açıqdır? (false — yalnız mövcud hesablar və myGov) */
  allowSignup: boolean;
  /**
   * Sürət məhdudiyyətləri. Mobil operatorlarda çox abunəçi eyni IP-dən çıxır (CGNAT) —
   * ona görə IP limitləri yüksək, e-poçt üzrə limit isə sərtdir.
   */
  limits: { signupPerIpHour: number; loginPerIp15m: number; loginPerEmail15m: number; leadsPerIp10m: number };
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): Config {
  const missing = ['DATABASE_URL', 'PUBLIC_URL', 'PHOTO_URL_SECRET'].filter((k) => !env[k]);
  if (missing.length) throw new Error(`Mühit dəyişənləri təyin olunmayıb: ${missing.join(', ')}`);
  if (env.PHOTO_URL_SECRET!.length < 32) throw new Error('PHOTO_URL_SECRET ən azı 32 simvol olmalıdır');
  return {
    port: Number(env.PORT ?? 8080),
    databaseUrl: env.DATABASE_URL!,
    storageDir: path.resolve(env.STORAGE_DIR ?? './data/photos'),
    publicUrl: env.PUBLIC_URL!.replace(/\/+$/, ''),
    photoSecret: env.PHOTO_URL_SECRET!,
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    trustProxy: env.TRUST_PROXY === 'true',
    sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 180),
    maxPhotoBytes: Number(env.MAX_PHOTO_MB ?? 5) * 1024 * 1024,
    allowSignup: env.ALLOW_SIGNUP !== 'false',
    limits: {
      signupPerIpHour: Number(env.LIMIT_SIGNUP_PER_IP_HOUR ?? 30),
      loginPerIp15m: Number(env.LIMIT_LOGIN_PER_IP_15M ?? 100),
      loginPerEmail15m: Number(env.LIMIT_LOGIN_PER_EMAIL_15M ?? 10),
      leadsPerIp10m: Number(env.LIMIT_LEADS_PER_IP_10M ?? 5),
    },
  };
}
