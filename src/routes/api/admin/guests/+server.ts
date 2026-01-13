import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

// Check if user is admin
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

// GET /api/admin/guests - List all guests
export const GET: RequestHandler = async ({ cookies }) => {
	await requireAdmin(cookies);

	const supabase = createServerClient();

	const { data: guests } = await supabase
		.from('guests')
		.select('id, nickname, photo_url, is_admin, created_at, mask_codes(code)')
		.order('created_at', { ascending: false });

	return json({ guests: guests || [] });
};

// DELETE /api/admin/guests - Delete a guest
export const DELETE: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { guestId } = await request.json();

	if (!guestId) {
		error(400, { message: 'Guest ID required' });
	}

	const supabase = createServerClient();

	// Delete bonds involving this guest
	await supabase.from('bonds').delete().or(`guest_a_id.eq.${guestId},guest_b_id.eq.${guestId}`);

	// Delete the guest
	const { error: deleteError } = await supabase.from('guests').delete().eq('id', guestId);

	if (deleteError) {
		error(500, { message: 'Failed to delete guest' });
	}

	return json({ success: true });
};
