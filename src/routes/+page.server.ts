import { redirect } from '@sveltejs/kit';
import { validateAuth } from '$lib/supabase/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	// If user is already authenticated, redirect to bond page
	const guest = await validateAuth(cookies);

	if (guest) {
		redirect(303, '/bond');
	}

	// Not authenticated - show landing page
	return {};
};
