import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

async function requireAdmin(cookies: { get: (name: string) => string | undefined }) {
	const code = cookies.get('gooeb_code');
	if (!code) {
		error(401, { message: 'Not authenticated' });
	}

	const guest = await getGuestByCode(code);
	if (!guest) {
		error(401, { message: 'Invalid session' });
	}

	if (!guest.is_admin) {
		error(403, { message: 'Admin access required' });
	}

	return guest;
}

// GET /api/admin/bonds - List all bonds
export const GET: RequestHandler = async ({ cookies }) => {
	await requireAdmin(cookies);

	const supabase = createServerClient();

	const { data: bonds } = await supabase
		.from('bonds')
		.select(`
			id,
			status,
			photo_url,
			initiated_at,
			accepted_at,
			completed_at,
			guest_a:guests!bonds_guest_a_id_fkey(id, nickname, photo_url),
			guest_b:guests!bonds_guest_b_id_fkey(id, nickname, photo_url),
			prompt:prompts(word, category)
		`)
		.order('initiated_at', { ascending: false });

	return json({ bonds: bonds || [] });
};

// DELETE /api/admin/bonds - Delete a bond
export const DELETE: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { bondId } = await request.json();

	if (!bondId) {
		error(400, { message: 'Bond ID required' });
	}

	const supabase = createServerClient();

	const { error: deleteError } = await supabase.from('bonds').delete().eq('id', bondId);

	if (deleteError) {
		error(500, { message: 'Failed to delete bond' });
	}

	return json({ success: true });
};
