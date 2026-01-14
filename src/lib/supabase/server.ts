// Server-side Supabase client
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { Database, Guest, MaskCode } from './types';

let serverSupabase: SupabaseClient<Database> | null = null;

export function createServerClient(): SupabaseClient<Database> {
	if (!serverSupabase) {
		const supabaseUrl = env.PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
		const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

		if (!supabaseUrl || !serviceKey) {
			throw new Error('Missing Supabase server environment variables');
		}

		serverSupabase = createClient<Database>(supabaseUrl, serviceKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});
	}

	return serverSupabase;
}

// Guest with their mask code info
export type GuestWithCode = Guest & {
	mask_codes: Pick<MaskCode, 'code'> | null;
};

// Look up a guest by their mask code (single optimized query)
export async function getGuestByCode(code: string): Promise<GuestWithCode | null> {
	const supabase = createServerClient();

	// Single JOIN query instead of two sequential queries
	const { data: guest } = await supabase
		.from('guests')
		.select('*, mask_codes!inner(code)')
		.eq('mask_codes.code', code.toUpperCase())
		.eq('mask_codes.is_claimed', true)
		.single();

	return guest as GuestWithCode | null;
}

// Check if a code is registered (has a guest)
export async function isCodeRegistered(code: string): Promise<boolean> {
	const guest = await getGuestByCode(code);
	return guest !== null;
}

// Validate auth from cookies - returns guest if valid code cookie exists
export async function validateAuth(
	cookies: { get: (name: string) => string | undefined }
): Promise<GuestWithCode | null> {
	const code = cookies.get('gooeb_code');
	if (!code) return null;
	return getGuestByCode(code);
}
