import { json, error } from '@sveltejs/kit';
import { getGuestByCode } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	let body: { code?: string };

	try {
		body = await request.json();
	} catch {
		error(400, { message: 'Invalid request body' });
	}

	const { code } = body;

	if (!code || typeof code !== 'string' || !/^[0-9]{4}$/.test(code)) {
		error(400, { message: 'Invalid code format' });
	}

	const upperCode = code.toUpperCase();

	// Verify the code is claimed and has a guest
	const guest = await getGuestByCode(upperCode);

	if (!guest) {
		error(404, { message: 'No guest found for this code' });
	}

	// Set the cookie (same as registration endpoint)
	cookies.set('gooeb_code', upperCode, {
		path: '/',
		maxAge: 60 * 60 * 24 * 7, // 1 week
		httpOnly: false, // Allow JS access for client-side checks
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production'
	});

	return json({
		success: true,
		code: upperCode,
		guestId: guest.id
	});
};
