import { json, error } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase/server';
import { buildLeaderboard, deduplicateBonds, calculateGuestPoints, applyLedgerPoints } from '$lib/scoring';
import type { RequestHandler } from './$types';

type Superlative = {
	id: string;
	emoji: string;
	title: string;
	description: string;
	winner: { nickname: string; photo_url: string | null };
	stat: string;
};

type BondForAwards = {
	guest_a_id: string;
	guest_b_id: string;
	status: string;
	accepted_at: string | null;
	completed_at: string | null;
	phase_number: number;
};

type GuestForAwards = {
	id: string;
	nickname: string;
	photo_url: string;
	team_emoji: string | null;
};

function computeSuperlatives(
	guests: GuestForAwards[],
	bonds: BondForAwards[],
	leaderboard: { id: string; nickname: string; photo_url: string; points: number }[],
	ledgerEntries: { guest_id: string; points: number }[]
): Superlative[] {
	const superlatives: Superlative[] = [];
	const guestMap = new Map(guests.map((g) => [g.id, g]));

	// 1. Mind Meld Champion - highest points
	if (leaderboard.length > 0) {
		const top = leaderboard[0];
		superlatives.push({
			id: 'champion',
			emoji: '👑',
			title: 'Mind Meld Champion',
			description: 'Most points overall',
			winner: { nickname: top.nickname, photo_url: top.photo_url },
			stat: `${top.points} points!`
		});
	}

	// 2. Social Butterfly - most unique partners
	const partnerCounts = new Map<string, Set<string>>();
	for (const bond of bonds) {
		if (!partnerCounts.has(bond.guest_a_id)) partnerCounts.set(bond.guest_a_id, new Set());
		if (!partnerCounts.has(bond.guest_b_id)) partnerCounts.set(bond.guest_b_id, new Set());
		partnerCounts.get(bond.guest_a_id)!.add(bond.guest_b_id);
		partnerCounts.get(bond.guest_b_id)!.add(bond.guest_a_id);
	}
	let maxPartners = 0;
	let butterflyId: string | null = null;
	for (const [guestId, partners] of partnerCounts) {
		if (partners.size > maxPartners) {
			maxPartners = partners.size;
			butterflyId = guestId;
		}
	}
	if (butterflyId && maxPartners > 0) {
		const guest = guestMap.get(butterflyId);
		if (guest) {
			superlatives.push({
				id: 'butterfly',
				emoji: '🦋',
				title: 'Social Butterfly',
				description: 'Most unique connections',
				winner: { nickname: guest.nickname, photo_url: guest.photo_url },
				stat: `${maxPartners} unique connections!`
			});
		}
	}

	// 3. Lightning Melder - fastest avg completion time (min 2 completed)
	const completionTimes = new Map<string, number[]>();
	for (const bond of bonds) {
		if (bond.status !== 'completed' || !bond.accepted_at || !bond.completed_at) continue;
		const duration = new Date(bond.completed_at).getTime() - new Date(bond.accepted_at).getTime();
		if (duration <= 0) continue;
		for (const gid of [bond.guest_a_id, bond.guest_b_id]) {
			if (!completionTimes.has(gid)) completionTimes.set(gid, []);
			completionTimes.get(gid)!.push(duration);
		}
	}
	let fastestAvg = Infinity;
	let speedId: string | null = null;
	for (const [guestId, times] of completionTimes) {
		if (times.length < 2) continue;
		const avg = times.reduce((a, b) => a + b, 0) / times.length;
		if (avg < fastestAvg) {
			fastestAvg = avg;
			speedId = guestId;
		}
	}
	if (speedId && fastestAvg < Infinity) {
		const guest = guestMap.get(speedId);
		if (guest) {
			const avgSeconds = Math.round(fastestAvg / 1000);
			const statText = avgSeconds >= 60
				? `Avg ${Math.round(avgSeconds / 60)} min per meld!`
				: `Avg ${avgSeconds}s per meld!`;
			superlatives.push({
				id: 'speed',
				emoji: '⚡',
				title: 'Lightning Melder',
				description: 'Fastest average completion',
				winner: { nickname: guest.nickname, photo_url: guest.photo_url },
				stat: statText
			});
		}
	}

	// 4. Remix Master - most phase 2 bonds
	const remixCounts = new Map<string, number>();
	for (const bond of bonds) {
		if (bond.phase_number !== 2) continue;
		remixCounts.set(bond.guest_a_id, (remixCounts.get(bond.guest_a_id) ?? 0) + 1);
		remixCounts.set(bond.guest_b_id, (remixCounts.get(bond.guest_b_id) ?? 0) + 1);
	}
	let maxRemixes = 0;
	let remixId: string | null = null;
	for (const [guestId, count] of remixCounts) {
		if (count > maxRemixes) {
			maxRemixes = count;
			remixId = guestId;
		}
	}
	if (remixId && maxRemixes > 0) {
		const guest = guestMap.get(remixId);
		if (guest) {
			superlatives.push({
				id: 'remix',
				emoji: '🎛️',
				title: 'Remix Master',
				description: 'Most remix melds',
				winner: { nickname: guest.nickname, photo_url: guest.photo_url },
				stat: `${maxRemixes} remixes!`
			});
		}
	}

	// 5. Dream Team - team with highest combined points
	const pointsMap = calculateGuestPoints(bonds);
	if (ledgerEntries.length > 0) {
		applyLedgerPoints(pointsMap, ledgerEntries as any);
	}
	const teamPoints = new Map<string, number>();
	for (const guest of guests) {
		if (!guest.team_emoji) continue;
		const pts = pointsMap.get(guest.id)?.totalPoints ?? 0;
		teamPoints.set(guest.team_emoji, (teamPoints.get(guest.team_emoji) ?? 0) + pts);
	}
	let bestTeam: string | null = null;
	let bestTeamPoints = 0;
	for (const [emoji, pts] of teamPoints) {
		if (pts > bestTeamPoints) {
			bestTeamPoints = pts;
			bestTeam = emoji;
		}
	}
	if (bestTeam && bestTeamPoints > 0) {
		superlatives.push({
			id: 'team',
			emoji: '🏆',
			title: 'Dream Team',
			description: 'Highest team score',
			winner: { nickname: bestTeam, photo_url: null },
			stat: `${bestTeamPoints} combined points!`
		});
	}

	return superlatives;
}

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
			remix_bond_id,
			phase_number,
			prompt:prompts!bonds_prompt_id_fkey(word, category),
			prompt_a:prompts!bonds_prompt_a_id_fkey(word, category),
			prompt_b:prompts!bonds_prompt_b_id_fkey(word, category),
			activity_prompt:activity_prompts(description, activity_category)
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
		accepted_at: string | null;
		remix_bond_id: string | null;
		phase_number: number;
		prompt: { word: string; category: string } | null;
		prompt_a: { word: string; category: string } | null;
		prompt_b: { word: string; category: string } | null;
		activity_prompt: { description: string; activity_category: string | null } | null;
	}[];

	// Fetch remix source photos separately (PostgREST can't self-join)
	const remixBondIds = allBonds
		.map((b) => b.remix_bond_id)
		.filter((id): id is string => !!id);

	const remixSourceMap = new Map<string, string | null>();
	if (remixBondIds.length > 0) {
		const { data: sourceBonds } = await supabase
			.from('bonds')
			.select('id, photo_url')
			.in('id', remixBondIds);
		for (const sb of (sourceBonds || []) as { id: string; photo_url: string | null }[]) {
			remixSourceMap.set(sb.id, sb.photo_url);
		}
	}

	// Attach remix_source to bonds
	const allBondsWithSource = allBonds.map((b) => ({
		...b,
		remix_source: b.remix_bond_id
			? { id: b.remix_bond_id, photo_url: remixSourceMap.get(b.remix_bond_id) ?? null }
			: null
	}));

	// Keep only one bond per pair per phase (prefer completed, then earliest)
	const bonds = deduplicateBonds(allBondsWithSource);

	// Fetch all ledger entries for leaderboard scoring
	const { data: ledgerData } = await supabase
		.from('point_ledger' as any)
		.select('id, guest_id, points, reason, created_at');

	const ledgerEntries = (ledgerData || []) as { id: string; guest_id: string; points: number; reason: string; created_at: string }[];

	// Calculate stats
	const totalGuests = guests.length;
	const totalBonds = bonds.length;

	// Max possible bonds: one per unique pair (deduplicated)
	const maxPossibleBonds = totalGuests > 1
		? (totalGuests * (totalGuests - 1)) / 2
		: 0;

	// Leaderboard with points (including manual ledger adjustments)
	const leaderboard = buildLeaderboard(guests, bonds, 10, ledgerEntries);

	// Compute superlatives/awards from existing data
	const superlatives = computeSuperlatives(guests, allBondsWithSource, leaderboard, ledgerEntries);

	return json({
		guests,
		bonds,
		stats: {
			totalGuests,
			totalBonds,
			maxPossibleBonds,
			progress: maxPossibleBonds > 0 ? (totalBonds / maxPossibleBonds) * 100 : 0
		},
		leaderboard,
		superlatives
	});
};
