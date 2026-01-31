import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

// GET /api/standby - Public endpoint to check standby mode
export const GET: RequestHandler = async () => {
	const supabase = createServerClient();

	const { data: events } = await supabase
		.from('events')
		.select('standby_mode')
		.eq('is_active', true)
		.limit(1);

	const activeEvent = (events as { standby_mode: boolean }[] | null)?.[0];

	return json({
		standby_mode: activeEvent?.standby_mode ?? false
	});
};
