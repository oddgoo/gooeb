import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const supabase = createServerClient();

	// Get current user from cookie
	const myCode = cookies.get('gooeb_code');
	if (!myCode) {
		error(401, { message: 'Not authenticated' });
	}

	const me = await getGuestByCode(myCode);
	if (!me) {
		error(401, { message: 'Invalid session' });
	}

	// Parse request body
	let body: { bondId?: string };
	try {
		body = await request.json();
	} catch {
		error(400, { message: 'Invalid request body' });
	}

	const { bondId } = body;
	if (!bondId) {
		error(400, { message: 'Bond ID is required' });
	}

	// Get the bond and verify it's accepted and I'm a participant
	const { data: bondData } = await supabase
		.from('bonds')
		.select('id, guest_a_id, guest_b_id, status')
		.eq('id', bondId)
		.single();

	const bond = bondData as { id: string; guest_a_id: string; guest_b_id: string; status: string } | null;

	if (!bond) {
		error(404, { message: 'Meld not found' });
	}

	// Check if user is a participant
	if (bond.guest_a_id !== me.id && bond.guest_b_id !== me.id) {
		error(403, { message: 'You are not part of this meld' });
	}

	// Can only cancel accepted (active) bonds
	if (bond.status !== 'accepted') {
		error(409, { message: 'This meld cannot be cancelled' });
	}

	// Update status to cancelled
	console.log(`[cancel] Guest ${me.id} cancelling bond ${bondId}`);

	const { data: updateData, error: updateError } = await supabase
		.from('bonds')
		.update({ status: 'cancelled' } as never)
		.eq('id', bondId)
		.eq('status', 'accepted')
		.select('id');

	if (updateError) {
		console.error(`[cancel] Update error for bond ${bondId}:`, updateError);
		error(500, { message: 'Failed to cancel meld' });
	}

	if (!updateData || updateData.length === 0) {
		console.warn(`[cancel] No rows updated for bond ${bondId} — status may have already changed`);
		error(409, { message: 'Meld could not be cancelled — it may have already been completed or cancelled' });
	}

	console.log(`[cancel] Bond ${bondId} cancelled successfully`);
	return json({ success: true });
};
