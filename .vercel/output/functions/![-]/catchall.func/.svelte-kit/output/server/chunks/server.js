import { createClient } from "@supabase/supabase-js";
import { b as private_env } from "./shared-server.js";
let serverSupabase = null;
function createServerClient() {
  if (!serverSupabase) {
    const supabaseUrl = private_env.PUBLIC_SUPABASE_URL || private_env.VITE_SUPABASE_URL;
    const serviceKey = private_env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase server environment variables");
    }
    serverSupabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return serverSupabase;
}
async function getGuestByToken(supabase, authToken) {
  const { data, error } = await supabase.from("guests").select("*, mask_codes(code)").eq("auth_token", authToken).single();
  if (error || !data) return null;
  return data;
}
async function validateAuth(cookies) {
  const authToken = cookies.get("gooeb_auth");
  if (!authToken) return null;
  const supabase = createServerClient();
  return getGuestByToken(supabase, authToken);
}
export {
  createServerClient as c,
  getGuestByToken as g,
  validateAuth as v
};
