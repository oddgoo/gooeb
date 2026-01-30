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

// GET /api/admin/points - List all ledger entries
export const GET: RequestHandler = async ({ cookies }) => {
	await requireAdmin(cookies);
	const supabase = createServerClient();

	const { data, error: queryError } = await supabase
		.from('point_ledger' as any)
		.select('id, guest_id, points, reason, created_at, guest:guests!point_ledger_guest_id_fkey(nickname)')
		.order('created_at', { ascending: false });

	if (queryError) {
		console.error('Point ledger query error:', queryError);
		error(500, { message: 'Failed to fetch point ledger' });
	}

	return json({ entries: data || [] });
};

// POST /api/admin/points - Create a ledger entry
export const POST: RequestHandler = async ({ cookies, request }) => {
	const admin = await requireAdmin(cookies);
	const supabase = createServerClient();

	const { guest_id, points, reason } = await request.json();

	if (!guest_id || typeof points !== 'number' || points === 0) {
		error(400, { message: 'guest_id and non-zero points are required' });
	}

	const { error: insertError } = await supabase
		.from('point_ledger' as any)
		.insert({
			event_id: admin.event_id,
			guest_id,
			points,
			reason: reason || '',
			created_by: admin.id
		} as never);

	if (insertError) {
		console.error('Point ledger insert error:', insertError);
		error(500, { message: 'Failed to create ledger entry' });
	}

	return json({ success: true });
};

// DELETE /api/admin/points - Remove a ledger entry
export const DELETE: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);
	const supabase = createServerClient();

	const { entryId } = await request.json();

	if (!entryId) {
		error(400, { message: 'entryId is required' });
	}

	const { error: deleteError } = await supabase
		.from('point_ledger' as any)
		.delete()
		.eq('id', entryId);

	if (deleteError) {
		console.error('Point ledger delete error:', deleteError);
		error(500, { message: 'Failed to delete ledger entry' });
	}

	return json({ success: true });
};
