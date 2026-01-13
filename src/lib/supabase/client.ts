// Browser-side Supabase client
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import type { Database } from './types';

let supabaseInstance: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> | null {
	if (!browser) return null;

	if (!supabaseInstance) {
		const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
		const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

		if (!supabaseUrl || !supabaseAnonKey) {
			console.error('Missing Supabase environment variables');
			return null;
		}

		supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
			auth: {
				persistSession: false // We handle our own auth
			},
			realtime: {
				params: {
					eventsPerSecond: 10
				}
			}
		});
	}

	return supabaseInstance;
}

// Convenience export for direct usage
export const supabase = browser ? getSupabase() : null;
