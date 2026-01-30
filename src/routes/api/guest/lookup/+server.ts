import { json, error } from '@sveltejs/kit';
import { getGuestByCode } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const myCode = cookies.get('gooeb_code');
	if (!myCode) {
		error(401, { message: 'Not authenticated' });
	}

	const code = url.searchParams.get('code');
	if (!code || typeof code !== 'string') {
		error(400, { message: 'Code parameter is required' });
	}

	if (code.toUpperCase() === myCode.toUpperCase()) {
		error(400, { message: "That's your own code!" });
	}

	const guest = await getGuestByCode(code);
	if (!guest) {
		error(404, { message: 'No guest found with that code. Are they registered?' });
	}

	return json({
		id: guest.id,
		nickname: guest.nickname,
		photo_url: guest.photo_url,
		intro_text: guest.intro_text
	});
};
