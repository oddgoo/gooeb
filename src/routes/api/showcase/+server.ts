import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const supabase = createServerClient();

	// Get all guests with photos
	const { data: guestsData } = await supabase
		.from('guests')
		.select('id, nickname, photo_url')
		.order('created_at', { ascending: true });

	const guests = (guestsData || []) as {
		id: string;
		nickname: string;
		photo_url: string;
	}[];

	// Get all completed bonds with photos
	const { data: bondsData } = await supabase
		.from('bonds')
		.select(`
			id,
			guest_a_id,
			guest_b_id,
			status,
			photo_url,
			completed_at,
			prompt:prompts(word, category)
		`)
		.eq('status', 'completed')
		.order('completed_at', { ascending: false });

	const bonds = (bondsData || []) as {
		id: string;
		guest_a_id: string;
		guest_b_id: string;
		status: string;
		photo_url: string | null;
		completed_at: string;
		prompt: { word: string; category: string } | null;
	}[];

	// Calculate stats
	const totalGuests = guests.length;
	const totalBonds = bonds.length;

	// Max possible bonds (each pair can bond 3 times, one per category)
	// But for simplicity, let's count unique pairs * 3
	const maxPossibleBonds = totalGuests > 1
		? ((totalGuests * (totalGuests - 1)) / 2) * 3
		: 0;

	// Leaderboard: count bonds per guest
	const bondCounts: Record<string, number> = {};
	for (const bond of bonds) {
		bondCounts[bond.guest_a_id] = (bondCounts[bond.guest_a_id] || 0) + 1;
		bondCounts[bond.guest_b_id] = (bondCounts[bond.guest_b_id] || 0) + 1;
	}

	const leaderboard = guests
		.map((guest) => ({
			id: guest.id,
			nickname: guest.nickname,
			photo_url: guest.photo_url,
			bondCount: bondCounts[guest.id] || 0
		}))
		.filter((g) => g.bondCount > 0)
		.sort((a, b) => b.bondCount - a.bondCount)
		.slice(0, 10);

	return json({
		guests,
		bonds,
		stats: {
			totalGuests,
			totalBonds,
			maxPossibleBonds,
			progress: maxPossibleBonds > 0 ? (totalBonds / maxPossibleBonds) * 100 : 0
		},
		leaderboard
	});
};
