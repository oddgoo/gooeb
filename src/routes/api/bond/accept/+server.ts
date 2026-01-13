import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import { acceptBond } from '$lib/supabase/bonds';
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
		.select('id, guest_a_id, guest_b_id, status, event_id')
		.eq('id', bondId)
		.single();

	const bond = bondData as {
		id: string;
		guest_a_id: string;
		guest_b_id: string;
		status: string;
		event_id: string;
	} | null;

	if (!bond) {
		error(404, { message: 'Bond not found' });
	}

	if (bond.guest_b_id !== me.id) {
		error(403, { message: 'You cannot accept this bond invite' });
	}

	if (bond.status !== 'pending') {
		error(409, { message: 'This bond is no longer pending' });
	}

	try {
		const prompt = await acceptBond(supabase, bond);
		return json({ success: true, prompt });
	} catch (e) {
		error(409, { message: e instanceof Error ? e.message : 'Failed to accept bond' });
	}
};
