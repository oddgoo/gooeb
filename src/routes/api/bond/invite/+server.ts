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
	let body: { targetCode?: string };
	try {
		body = await request.json();
	} catch {
		error(400, { message: 'Invalid request body' });
	}

	const { targetCode } = body;
	if (!targetCode || typeof targetCode !== 'string') {
		error(400, { message: 'Target code is required' });
	}

	// Can't invite yourself
	if (targetCode.toUpperCase() === myCode.toUpperCase()) {
		error(400, { message: "You can't bond with yourself!" });
	}

	// Find target guest
	const target = await getGuestByCode(targetCode);
	if (!target) {
		error(404, { message: 'No guest found with that code. Are they registered?' });
	}

	// Check if there's already a pending/accepted bond between these two
	const { data: existingBondData } = await supabase
		.from('bonds')
		.select('id, status, guest_a_id, guest_b_id')
		.or(`and(guest_a_id.eq.${me.id},guest_b_id.eq.${target.id}),and(guest_a_id.eq.${target.id},guest_b_id.eq.${me.id})`)
		.in('status', ['pending', 'accepted'])
		.single();

	const existingBond = existingBondData as { id: string; status: string; guest_a_id: string; guest_b_id: string } | null;

	if (existingBond) {
		if (existingBond.status === 'accepted') {
			error(409, { message: 'You already have an active bond with this person!' });
		}

		// If there's a pending invite FROM target TO me, auto-accept it
		// (Both players tapped each other = mutual interest)
		if (existingBond.status === 'pending' && existingBond.guest_b_id === me.id) {
			// Redirect to accept flow - call accept logic inline
			const acceptResponse = await fetch(new URL('/api/bond/accept', request.url).href, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cookie': `gooeb_code=${myCode}`
				},
				body: JSON.stringify({ bondId: existingBond.id })
			});

			if (acceptResponse.ok) {
				return json({
					bondId: existingBond.id,
					targetNickname: target.nickname,
					autoAccepted: true
				});
			}
			// If accept failed, fall through to error
			error(409, { message: 'Failed to auto-accept the existing invite' });
		}

		// I already sent them an invite
		if (existingBond.status === 'pending' && existingBond.guest_a_id === me.id) {
			error(409, { message: 'You already sent them an invite - waiting for their response!' });
		}
	}

	// Check how many completed bonds exist between these two (max 3, one per category)
	const { count: completedCount } = await supabase
		.from('bonds')
		.select('id', { count: 'exact', head: true })
		.or(`and(guest_a_id.eq.${me.id},guest_b_id.eq.${target.id}),and(guest_a_id.eq.${target.id},guest_b_id.eq.${me.id})`)
		.eq('status', 'completed');

	if (completedCount && completedCount >= 3) {
		error(409, { message: "You've completed all 3 bond categories with this person!" });
	}

	// Create the pending bond (guest_a is the initiator)
	const { data: newBond, error: insertError } = await supabase
		.from('bonds')
		.insert({
			event_id: me.event_id,
			guest_a_id: me.id,
			guest_b_id: target.id,
			status: 'pending'
		} as never)
		.select('id')
		.single();

	if (insertError) {
		console.error('Bond creation error:', insertError);
		error(500, { message: 'Failed to create bond invite' });
	}

	return json({
		bondId: (newBond as { id: string }).id,
		targetNickname: target.nickname
	});
};
