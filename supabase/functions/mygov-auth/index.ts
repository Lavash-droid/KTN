// Supabase Edge Function: myGov / dövlət vahid girişi. Məntiq: handler.ts. Quraşdırma: README.md.
// Brauzer yönləndirmələri JWT daşımır — funksiya verify_jwt = false ilə yerləşdirilməlidir (supabase/config.toml).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, loadConfig, type Deps } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const provider = () => Deno.env.get('MYGOV_PROVIDER_ID') ?? 'mygov';

const deps: Deps = {
  fetch,
  async findUser(subjectHash) {
    const { data, error } = await admin.rpc('auth_external_user', { p_provider: provider(), p_subject_hash: subjectHash });
    if (error) throw error;
    return (data as string | null) ?? null;
  },
  async findUserByEmail(email) {
    const { data, error } = await admin.rpc('auth_user_id_by_email', { p_email: email });
    if (error) throw error;
    return (data as string | null) ?? null;
  },
  async createUser(email, fullName) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, provider: provider() },
      app_metadata: { provider: provider(), providers: [provider()] },
    });
    if (error || !data.user) throw error ?? new Error('createUser');
    return data.user.id;
  },
  async linkIdentity(subjectHash, userId) {
    const { error } = await admin.rpc('auth_link_external', { p_provider: provider(), p_subject_hash: subjectHash, p_user_id: userId });
    if (error) throw error;
  },
  async updateName(userId, fullName) {
    await admin.auth.admin.updateUserById(userId, { user_metadata: { full_name: fullName, provider: provider() } });
  },
  async getEmail(userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user?.email) throw error ?? new Error('getUserById');
    return data.user.email;
  },
  async magicLinkHash(email) {
    // generateLink e-poçt GÖNDƏRMİR — yalnız birdəfəlik token yaradır.
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (error || !data.properties?.hashed_token) throw error ?? new Error('generateLink');
    return data.properties.hashed_token;
  },
};

Deno.serve(async (req) => {
  const cfg = loadConfig((k) => Deno.env.get(k));
  // Tətbiq giriş ekranında "myGov ilə daxil ol" düyməsini aktiv edib-etməməyi buradan öyrənir.
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/status')) {
    return new Response(JSON.stringify({ configured: !('error' in cfg) }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=60' },
    });
  }
  if ('error' in cfg) {
    console.error('[mygov-auth]', cfg.error);
    return new Response('myGov girişi hələ aktiv deyil', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return handle(req, cfg, deps);
});
