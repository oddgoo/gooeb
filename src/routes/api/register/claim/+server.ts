import { json, error } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const supabase = createServerClient();

	let body: { code?: string; maskCodeId?: string };

	try {
		body = await request.json();
	} catch {
		error(400, { message: 'Invalid request body' });
	}

	const { code, maskCodeId } = body;

	if (!code || !maskCodeId) {
		error(400, { message: 'Missing code or maskCodeId' });
	}

	// Verify mask code exists and is unclaimed
	const { data: maskCode, error: mcError } = await supabase
		.from('mask_codes')
		.select('id, is_claimed')
		.eq('id', maskCodeId)
		.single();

	const mc = maskCode as { id: string; is_claimed: boolean } | null;

	if (mcError || !mc) {
		error(404, { message: 'Invalid mask code' });
	}

	if (mc.is_claimed) {
		error(409, { message: 'This code has already been claimed' });
	}

	// Claim the mask code with optimistic locking
	const { error: claimError, count: claimCount } = await supabase
		.from('mask_codes')
		.update({
			is_claimed: true,
			claimed_at: new Date().toISOString()
		} as never)
		.eq('id', maskCodeId)
		.eq('is_claimed', false);

	if (claimError || claimCount === 0) {
		error(409, { message: 'This code was just claimed by someone else.' });
	}

	const upperCode = code.toUpperCase();

	// Set code cookie
	cookies.set('gooeb_code', upperCode, {
		path: '/',
		maxAge: 60 * 60 * 24 * 7,
		httpOnly: false,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production'
	});

	return json({ code: upperCode });
};
