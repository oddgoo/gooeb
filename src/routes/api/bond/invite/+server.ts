import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import { acceptBond, resolvePhaseNumber } from '$lib/supabase/bonds';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const supabase = createServerClient();

	// Get current user code from cookie
	const myCode = cookies.get('gooeb_code');
	if (!myCode) {
		error(401, { message: 'Not authenticated' });
	}

	// Parse request body first (before any DB calls)
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

	// Can't invite yourself (quick string check before DB calls)
	if (targetCode.toUpperCase() === myCode.toUpperCase()) {
		error(400, { message: "You can't bond with yourself!" });
	}

	// Parallelize both guest lookups for faster response
	const [me, target] = await Promise.all([
		getGuestByCode(myCode),
		getGuestByCode(targetCode)
	]);

	if (!me) {
		error(401, { message: 'Invalid session' });
	}

	if (!target) {
		error(404, { message: 'No guest found with that code. Are they registered?' });
	}

	// Resolve current phase number
	const currentPhaseNumber = await resolvePhaseNumber(supabase, me.event_id);
	const isRemixPhase = currentPhaseNumber >= 2;

	// Check if there's already a pending/accepted bond between these two FOR THIS PHASE
	const { data: existingBondData } = await supabase
		.from('bonds')
		.select('id, status, guest_a_id, guest_b_id, phase_number')
		.or(`and(guest_a_id.eq.${me.id},guest_b_id.eq.${target.id}),and(guest_a_id.eq.${target.id},guest_b_id.eq.${me.id})`)
		.in('status', ['pending', 'accepted'])
		.eq('phase_number', currentPhaseNumber)
		.single();

	const existingBond = existingBondData as { id: string; status: string; guest_a_id: string; guest_b_id: string; phase_number: number } | null;

	if (existingBond) {
		if (existingBond.status === 'accepted') {
			error(409, { message: 'You already have an active bond with this person!' });
		}

		// If there's a pending invite FROM target TO me, auto-accept it
		// (Both players tapped each other = mutual interest)
		if (existingBond.status === 'pending' && existingBond.guest_b_id === me.id) {
			try {
				// Get full bond data for accept function
				const { data: bondData } = await supabase
					.from('bonds')
					.select('id, guest_a_id, guest_b_id, status, event_id')
					.eq('id', existingBond.id)
					.single();

				if (!bondData) {
					error(404, { message: 'Bond not found' });
				}

				const bond = bondData as unknown as { id: string; guest_a_id: string; guest_b_id: string; status: string; event_id: string };

				const prompt = await acceptBond(supabase, bond);

				return json({
					bondId: existingBond.id,
					targetId: target.id,
					targetNickname: target.nickname,
					targetPhoto: target.photo_url,
					autoAccepted: true,
					prompt
				});
			} catch (e) {
				error(409, { message: e instanceof Error ? e.message : 'Failed to auto-accept' });
			}
		}

		// I already sent them an invite
		if (existingBond.status === 'pending' && existingBond.guest_a_id === me.id) {
			error(409, { message: 'You already sent them an invite - waiting for their response!' });
		}
	}

	if (isRemixPhase) {
		// Check if there are any completed source bonds to remix
		const { count: sourceCount } = await supabase
			.from('bonds')
			.select('id', { count: 'exact', head: true })
			.eq('event_id', me.event_id)
			.eq('status', 'completed')
			.eq('phase_number', 1);

		if (!sourceCount || sourceCount === 0) {
			error(409, { message: 'No completed Source melds available to remix yet! Complete some Source melds first.' });
		}

		// Remix phase: max 1 bond per pair (any status)
		const { count: remixCount } = await supabase
			.from('bonds')
			.select('id', { count: 'exact', head: true })
			.or(`and(guest_a_id.eq.${me.id},guest_b_id.eq.${target.id}),and(guest_a_id.eq.${target.id},guest_b_id.eq.${me.id})`)
			.eq('phase_number', currentPhaseNumber)
			.in('status', ['pending', 'accepted', 'completed']);

		if (remixCount && remixCount >= 1) {
			error(409, { message: 'You already have a remix meld with this person!' });
		}
	} else {
		// Source phase: check how many active bonds exist (accepted + completed)
		// This prevents creating invites that will fail at accept time due to category exhaustion
		const { count: activeBondCount } = await supabase
			.from('bonds')
			.select('id', { count: 'exact', head: true })
			.or(`and(guest_a_id.eq.${me.id},guest_b_id.eq.${target.id}),and(guest_a_id.eq.${target.id},guest_b_id.eq.${me.id})`)
			.in('status', ['accepted', 'completed'])
			.eq('phase_number', 1);

		if (activeBondCount && activeBondCount >= 3) {
			error(409, { message: "You've used all 3 bond categories with this person!" });
		}
	}

	// Create the pending bond (guest_a is the initiator)
	const { data: newBond, error: insertError } = await supabase
		.from('bonds')
		.insert({
			event_id: me.event_id,
			guest_a_id: me.id,
			guest_b_id: target.id,
			status: 'pending',
			phase_number: currentPhaseNumber
		} as never)
		.select('id')
		.single();

	if (insertError) {
		console.error('Bond creation error:', insertError);
		error(500, { message: 'Failed to create bond invite' });
	}

	return json({
		bondId: (newBond as { id: string }).id,
		targetId: target.id,
		targetNickname: target.nickname,
		targetPhoto: target.photo_url
	});
};
