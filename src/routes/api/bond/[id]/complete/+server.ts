import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const supabase = createServerClient();
	const bondId = params.id;

	// Get current user
	const myCode = cookies.get('gooeb_code');
	if (!myCode) {
		error(401, { message: 'Not authenticated' });
	}

	const me = await getGuestByCode(myCode);
	if (!me) {
		error(401, { message: 'Invalid session' });
	}

	// Parse request body
	let body: { photoDataUrl?: string };
	try {
		body = await request.json();
	} catch {
		error(400, { message: 'Invalid request body' });
	}

	const { photoDataUrl } = body;

	if (!photoDataUrl || typeof photoDataUrl !== 'string' || !photoDataUrl.startsWith('data:image')) {
		error(400, { message: 'Valid photo is required' });
	}

	// Get the bond
	const { data: bondData, error: bondError } = await supabase
		.from('bonds')
		.select('id, status, guest_a_id, guest_b_id')
		.eq('id', bondId)
		.single();

	if (bondError) {
		console.error('Bond query error:', bondError);
	}

	const bond = bondData as {
		id: string;
		status: string;
		guest_a_id: string;
		guest_b_id: string;
	} | null;

	if (!bond) {
		error(404, { message: 'Bond not found' });
	}

	// Verify user is part of this bond
	if (bond.guest_a_id !== me.id && bond.guest_b_id !== me.id) {
		error(403, { message: 'You are not part of this bond' });
	}

	// Bond must be in accepted status to complete
	if (bond.status !== 'accepted') {
		error(400, { message: 'This bond cannot be completed' });
	}

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

	// Include guest ID in path to prevent race conditions when two users complete simultaneously
	const photoPath = `bonds/${bondId}_${me.id}.${imageType === 'jpeg' ? 'jpg' : imageType}`;

	// Upload photo to Supabase Storage
	const { error: uploadError } = await supabase.storage.from('photos').upload(photoPath, photoBuffer, {
		contentType: `image/${imageType}`,
		upsert: true // Allow overwriting in case of retry by same user
	});

	if (uploadError) {
		console.error('Bond photo upload error:', uploadError);
		error(500, { message: 'Failed to upload photo. Please try again.' });
	}

	// Get public URL for the photo
	const {
		data: { publicUrl }
	} = supabase.storage.from('photos').getPublicUrl(photoPath);

	// Update bond to completed with optimistic locking
	const { error: updateError, count: updateCount } = await supabase
		.from('bonds')
		.update({
			status: 'completed',
			photo_url: publicUrl,
			completed_at: new Date().toISOString()
		} as never)
		.eq('id', bondId)
		.eq('status', 'accepted'); // Optimistic lock

	if (updateError || updateCount === 0) {
		// Rollback: delete uploaded photo
		await supabase.storage.from('photos').remove([photoPath]);
		error(409, { message: 'Bond status changed. Please refresh and try again.' });
	}

	return json({
		success: true,
		photoUrl: publicUrl
	});
};
