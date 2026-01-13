import { json, error } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const supabase = createServerClient();

	let body: {
		nickname?: string;
		photoDataUrl?: string;
		maskCodeId?: string;
		eventId?: string;
		code?: string; // The 4-digit mask code
	};

	try {
		body = await request.json();
	} catch {
		error(400, { message: 'Invalid request body' });
	}

	const { nickname, photoDataUrl, maskCodeId, eventId, code } = body;

	// Validate inputs
	if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
		error(400, { message: 'Nickname is required' });
	}

	if (nickname.length > 20) {
		error(400, { message: 'Nickname must be 20 characters or less' });
	}

	if (!photoDataUrl || typeof photoDataUrl !== 'string' || !photoDataUrl.startsWith('data:image')) {
		error(400, { message: 'Valid photo is required' });
	}

	if (!maskCodeId || !eventId || !code) {
		error(400, { message: 'Missing registration context' });
	}

	// Verify mask code is still available (race condition check)
	const { data: maskCodeData, error: codeError } = await supabase
		.from('mask_codes')
		.select('id, is_claimed, event_id')
		.eq('id', maskCodeId)
		.single();

	const maskCode = maskCodeData as { id: string; is_claimed: boolean; event_id: string } | null;

	if (codeError || !maskCode) {
		error(404, { message: 'Invalid mask code' });
	}

	if (maskCode.is_claimed) {
		error(409, { message: 'This code has already been claimed' });
	}

	if (maskCode.event_id !== eventId) {
		error(400, { message: 'Event mismatch' });
	}

	// Generate auth token
	const authToken = uuidv4();
	const guestId = uuidv4();

	// Extract base64 data from data URL
	const base64Match = photoDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
	if (!base64Match) {
		error(400, { message: 'Invalid photo format' });
	}

	const [, imageType, base64Data] = base64Match;
	const photoBuffer = Buffer.from(base64Data, 'base64');

	// Check file size (max 2MB)
	if (photoBuffer.length > 2 * 1024 * 1024) {
		error(400, { message: 'Photo is too large. Please try a smaller image.' });
	}

	const photoPath = `guests/${guestId}.${imageType === 'jpeg' ? 'jpg' : imageType}`;

	// Upload photo to Supabase Storage
	const { error: uploadError } = await supabase.storage.from('photos').upload(photoPath, photoBuffer, {
		contentType: `image/${imageType}`,
		upsert: false
	});

	if (uploadError) {
		console.error('Photo upload error:', uploadError);
		error(500, { message: 'Failed to upload photo. Please try again.' });
	}

	// Get public URL for the photo
	const {
		data: { publicUrl }
	} = supabase.storage.from('photos').getPublicUrl(photoPath);

	// Claim the mask code with optimistic locking
	const { error: claimError, count: claimCount } = await supabase
		.from('mask_codes')
		.update({
			is_claimed: true,
			claimed_at: new Date().toISOString()
		} as never) // Type assertion for Supabase
		.eq('id', maskCodeId)
		.eq('is_claimed', false); // Optimistic lock

	if (claimError || claimCount === 0) {
		// Rollback: delete uploaded photo
		await supabase.storage.from('photos').remove([photoPath]);
		error(409, { message: 'This code was just claimed by someone else. Please get a new code.' });
	}

	// Create guest record
	const { error: guestError } = await supabase.from('guests').insert({
		id: guestId,
		event_id: eventId,
		mask_code_id: maskCodeId,
		nickname: nickname.trim(),
		photo_url: publicUrl,
		auth_token: authToken
	} as never); // Type assertion for Supabase

	if (guestError) {
		console.error('Guest creation error:', guestError);

		// Rollback: unclaim code and delete photo
		await supabase
			.from('mask_codes')
			.update({ is_claimed: false, claimed_at: null } as never)
			.eq('id', maskCodeId);
		await supabase.storage.from('photos').remove([photoPath]);

		error(500, { message: 'Failed to create your profile. Please try again.' });
	}

	// Set code cookie for server-side auth
	cookies.set('gooeb_code', code.toUpperCase(), {
		path: '/',
		maxAge: 60 * 60 * 24 * 7, // 1 week
		httpOnly: false, // Allow JS access for client-side checks
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production'
	});

	return json({
		guestId,
		code: code.toUpperCase()
	});
};
