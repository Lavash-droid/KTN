// Supabase Edge Function: EKTİS / AQTA hesabatları. Məntiq: handler.ts. Quraşdırma: mobile/docs/GOV-REPORTS.md.
// JWT yoxlaması həm platformada (verify_jwt), həm də funksiyanın içində aparılır.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, loadConfig, type Deps } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const deps: Deps = {
  fetch,
  async getUser(jwt) {
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      provider: String(data.user.app_metadata?.provider ?? 'email'),
      name: String(data.user.user_metadata?.full_name ?? ''),
    };
  },
  async canWrite(farmId, userId) {
    const { data, error } = await admin.from('farm_members').select('role').eq('farm_id', farmId).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return !!data && data.role !== 'viewer';
  },
};

Deno.serve((req) => handle(req, loadConfig((k) => Deno.env.get(k)), deps));
