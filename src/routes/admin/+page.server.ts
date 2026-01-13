import { error, redirect } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const code = cookies.get('gooeb_code');

	if (!code) {
		redirect(302, '/');
	}

	const guest = await getGuestByCode(code);

	if (!guest) {
		redirect(302, '/');
	}

	if (!guest.is_admin) {
		error(403, { message: 'Admin access required' });
	}

	// Get the event ID for creating new prompts
	const supabase = createServerClient();
	const { data: eventData } = await supabase
		.from('events')
		.select('id')
		.eq('is_active', true)
		.single();

	const event = eventData as { id: string } | null;

	return {
		guest: {
			id: guest.id,
			nickname: guest.nickname,
			is_admin: guest.is_admin
		},
		eventId: event?.id || null
	};
};
