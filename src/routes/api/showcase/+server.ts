import { json, error } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase/server';
import { buildLeaderboard, deduplicateBonds } from '$lib/scoring';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const supabase = createServerClient();

	// Get all guests with photos
	const { data: guestsData, error: guestsError } = await supabase
		.from('guests')
		.select('id, nickname, photo_url, team_emoji')
		.order('created_at', { ascending: true });

	if (guestsError) {
		console.error('Showcase guests query error:', guestsError);
		error(500, { message: 'Failed to load guests' });
	}

	const guests = (guestsData || []) as {
		id: string;
		nickname: string;
		photo_url: string;
		team_emoji: string | null;
	}[];

	// Get all accepted and completed bonds (show edges as soon as bond is accepted)
	const { data: bondsData, error: bondsError } = await supabase
		.from('bonds')
		.select(`
			id,
			guest_a_id,
			guest_b_id,
			status,
			photo_url,
			completed_at,
			accepted_at,
			prompt:prompts!bonds_prompt_id_fkey(word, category),
			prompt_a:prompts!bonds_prompt_a_id_fkey(word, category),
			prompt_b:prompts!bonds_prompt_b_id_fkey(word, category),
			activity_prompt:activity_prompts(description)
		`)
		.in('status', ['accepted', 'completed'])
		.order('accepted_at', { ascending: false });

	if (bondsError) {
		console.error('Showcase bonds query error:', bondsError);
		error(500, { message: 'Failed to load bonds' });
	}

	const allBonds = (bondsData || []) as {
		id: string;
		guest_a_id: string;
		guest_b_id: string;
		status: string;
		photo_url: string | null;
		completed_at: string;
		prompt: { word: string; category: string } | null;
		prompt_a: { word: string; category: string } | null;
		prompt_b: { word: string; category: string } | null;
		activity_prompt: { description: string } | null;
	}[];

	// Keep only one bond per pair (prefer completed, then earliest)
	const bonds = deduplicateBonds(allBonds);

	// Calculate stats
	const totalGuests = guests.length;
	const totalBonds = bonds.length;

	// Max possible bonds: one per unique pair (deduplicated)
	const maxPossibleBonds = totalGuests > 1
		? (totalGuests * (totalGuests - 1)) / 2
		: 0;

	// Leaderboard with points
	const leaderboard = buildLeaderboard(guests, bonds);

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
