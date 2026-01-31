import { json, error } from '@sveltejs/kit';
import { createServerClient, validateAuth } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const supabase = createServerClient();

	// Validate auth
	const guest = await validateAuth(cookies);
	if (!guest) {
		error(401, { message: 'Not authenticated' });
	}

	let body: {
		nickname?: string;
		intro_text?: string;
		photo?: string | null;
	};

	try {
		body = await request.json();
	} catch {
		error(400, { message: 'Invalid request body' });
	}

	const { nickname, intro_text, photo } = body;

	// Validate nickname
	if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
		error(400, { message: 'Nickname is required' });
	}

	if (nickname.length > 20) {
		error(400, { message: 'Nickname must be 20 characters or less' });
	}

	let photoUrl = guest.photo_url;

	// Handle photo upload if new photo provided
	if (photo && typeof photo === 'string' && photo.startsWith('data:image')) {
		// Extract base64 data from data URL
		const base64Match = photo.match(/^data:image\/(\w+);base64,(.+)$/);
		if (!base64Match) {
			error(400, { message: 'Invalid photo format' });
		}

		const [, imageType, base64Data] = base64Match;
		const photoBuffer = Buffer.from(base64Data, 'base64');

		// Check file size (max 2MB)
		if (photoBuffer.length > 2 * 1024 * 1024) {
			error(400, { message: 'Photo is too large. Please try a smaller image.' });
		}

		const photoPath = `guests/${guest.id}.${imageType === 'jpeg' ? 'jpg' : imageType}`;

		// Upload photo to Supabase Storage (upsert to replace existing)
		const { error: uploadError } = await supabase.storage.from('photos').upload(photoPath, photoBuffer, {
			contentType: `image/${imageType}`,
			upsert: true
		});

		if (uploadError) {
			console.error('Photo upload error:', uploadError);
			error(500, { message: 'Failed to upload photo. Please try again.' });
		}

		// Get public URL for the photo (add timestamp to bust cache)
		const {
			data: { publicUrl }
		} = supabase.storage.from('photos').getPublicUrl(photoPath);

		photoUrl = `${publicUrl}?t=${Date.now()}`;
	}

	// Update guest record
	const { error: updateError } = await supabase
		.from('guests')
		.update({
			nickname: nickname.trim(),
			intro_text: intro_text !== undefined ? (intro_text.trim() || null) : guest.intro_text,
			photo_url: photoUrl
		} as never)
		.eq('id', guest.id);

	if (updateError) {
		console.error('Profile update error:', updateError);
		error(500, { message: 'Failed to update profile. Please try again.' });
	}

	return json({
		success: true,
		nickname: nickname.trim(),
		photo_url: photoUrl
	});
};
