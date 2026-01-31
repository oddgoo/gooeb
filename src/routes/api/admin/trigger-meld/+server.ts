import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

async function requireAdmin(cookies: { get: (name: string) => string | undefined }) {
	const code = cookies.get('gooeb_code');
	if (!code) {
		throw error(401, { message: 'Not authenticated' });
	}

	const guest = await getGuestByCode(code);
	if (!guest) {
		throw error(401, { message: 'Invalid session' });
	}

	if (!guest.is_admin) {
		throw error(403, { message: 'Admin access required' });
	}

	return guest;
}

export const POST: RequestHandler = async ({ cookies }) => {
	const admin = await requireAdmin(cookies);
	const supabase = createServerClient();
	const eventId = admin.event_id;

	// Get current phase number
	let currentPhaseNumber = 1;
	const { data: eventData } = await supabase
		.from('events')
		.select('current_phase_id')
		.eq('id', eventId)
		.single();

	const event = eventData as { current_phase_id: string | null } | null;
	if (event?.current_phase_id) {
		const { data: phaseData } = await supabase
			.from('phases')
			.select('phase_number')
			.eq('id', event.current_phase_id)
			.single();
		const phase = phaseData as { phase_number: number } | null;
		if (phase) {
			currentPhaseNumber = phase.phase_number;
		}
	}

	// Get all guests for this event
	const { data: guestsData, error: guestsError } = await supabase
		.from('guests')
		.select('id, nickname, photo_url')
		.eq('event_id', eventId);

	const guests = guestsData as { id: string; nickname: string; photo_url: string }[] | null;
	if (guestsError || !guests || guests.length < 2) {
		throw error(400, { message: 'Need at least 2 guests to trigger a meld' });
	}

	// Get existing completed bonds for this phase to avoid duplicates
	const { data: existingBondsData } = await supabase
		.from('bonds')
		.select('guest_a_id, guest_b_id')
		.eq('event_id', eventId)
		.eq('phase_number', currentPhaseNumber)
		.eq('status', 'completed');

	const existingBonds = (existingBondsData || []) as { guest_a_id: string; guest_b_id: string }[];
	const existingPairs = new Set(
		existingBonds.map((b) => {
			const ids = [b.guest_a_id, b.guest_b_id].sort();
			return `${ids[0]}_${ids[1]}`;
		})
	);

	// Try to find a random pair that doesn't already have a completed bond
	let guestA: { id: string; nickname: string } | null = null;
	let guestB: { id: string; nickname: string } | null = null;
	const shuffled = [...guests].sort(() => Math.random() - 0.5);

	for (let i = 0; i < shuffled.length; i++) {
		for (let j = i + 1; j < shuffled.length; j++) {
			const ids = [shuffled[i].id, shuffled[j].id].sort();
			const pairKey = `${ids[0]}_${ids[1]}`;
			if (!existingPairs.has(pairKey)) {
				guestA = shuffled[i];
				guestB = shuffled[j];
				break;
			}
		}
		if (guestA) break;
	}

	if (!guestA || !guestB) {
		throw error(400, { message: 'All guest pairs already have completed melds for this phase' });
	}

	const now = new Date().toISOString();

	// Create completed bond directly
	const { data: bond, error: bondError } = await supabase
		.from('bonds')
		.insert({
			event_id: eventId,
			guest_a_id: guestA.id,
			guest_b_id: guestB.id,
			status: 'completed',
			phase_number: currentPhaseNumber,
			initiated_at: now,
			accepted_at: now,
			completed_at: now
		} as any)
		.select()
		.single();

	if (bondError || !bond) {
		console.error('Failed to create test meld:', bondError);
		throw error(500, { message: 'Failed to create test meld' });
	}

	return json({
		success: true,
		bond: {
			id: (bond as any).id,
			guestA: guestA.nickname,
			guestB: guestB.nickname
		}
	});
};
