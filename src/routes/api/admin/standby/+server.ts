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

// GET /api/admin/standby - Get standby mode state
export const GET: RequestHandler = async ({ cookies }) => {
	await requireAdmin(cookies);

	const supabase = createServerClient();

	const { data: events } = await supabase
		.from('events')
		.select('id, standby_mode')
		.eq('is_active', true)
		.limit(1);

	const activeEvent = (events as { id: string; standby_mode: boolean }[] | null)?.[0];

	return json({
		standby_mode: activeEvent?.standby_mode ?? false
	});
};

// PATCH /api/admin/standby - Toggle standby mode
export const PATCH: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { standby_mode } = await request.json();

	const supabase = createServerClient();

	// Get active event
	const { data: events } = await supabase
		.from('events')
		.select('id')
		.eq('is_active', true)
		.limit(1);

	const activeEvent = (events as { id: string }[] | null)?.[0];
	if (!activeEvent) {
		error(404, { message: 'No active event found' });
	}

	const { error: updateError } = await supabase
		.from('events')
		.update({ standby_mode: !!standby_mode } as never)
		.eq('id', activeEvent.id);

	if (updateError) {
		console.error('Update standby mode error:', updateError);
		error(500, { message: 'Failed to update standby mode' });
	}

	return json({ standby_mode: !!standby_mode });
};
