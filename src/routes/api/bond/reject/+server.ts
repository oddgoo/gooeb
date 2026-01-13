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

	// Get the bond and verify it's pending and I'm the recipient
	const { data: bondData } = await supabase
		.from('bonds')
		.select('id, guest_b_id, status')
		.eq('id', bondId)
		.single();

	const bond = bondData as { id: string; guest_b_id: string; status: string } | null;

	if (!bond) {
		error(404, { message: 'Bond not found' });
	}

	if (bond.guest_b_id !== me.id) {
		error(403, { message: 'You cannot reject this bond invite' });
	}

	if (bond.status !== 'pending') {
		error(409, { message: 'This bond is no longer pending' });
	}

	// Update status to rejected
	const { error: updateError } = await supabase
		.from('bonds')
		.update({ status: 'rejected' } as never)
		.eq('id', bondId)
		.eq('status', 'pending');

	if (updateError) {
		error(500, { message: 'Failed to reject bond' });
	}

	return json({ success: true });
};
