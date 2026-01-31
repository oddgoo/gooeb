import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import { calculateGuestPoints, deduplicateBonds, applyLedgerPoints } from '$lib/scoring';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
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

	// Get all bonds involving this user
	const { data: bonds, error: queryError } = await supabase
		.from('bonds')
		.select(`
			id,
			status,
			guest_a_id,
			guest_b_id,
			initiated_at,
			accepted_at,
			completed_at,
			photo_url,
			remix_bond_id,
			phase_number,
			guest_a:guests!bonds_guest_a_id_fkey(id, nickname, photo_url),
			guest_b:guests!bonds_guest_b_id_fkey(id, nickname, photo_url),
			prompt:prompts!bonds_prompt_id_fkey(id, word, category),
			prompt_a:prompts!bonds_prompt_a_id_fkey(id, word, category),
			prompt_b:prompts!bonds_prompt_b_id_fkey(id, word, category),
			activity_prompt:activity_prompts(id, description, activity_category)
		`)
		.or(`guest_a_id.eq.${me.id},guest_b_id.eq.${me.id}`)
		.in('status', ['pending', 'accepted', 'completed'])
		.order('initiated_at', { ascending: false });

	if (queryError) {
		console.error('Bond list error:', queryError);
		error(500, { message: 'Failed to fetch bonds' });
	}

	// Collect remix_bond_ids and fetch their photos separately (PostgREST can't self-join)
	const remixBondIds = (bonds || [])
		.map((b: any) => b.remix_bond_id)
		.filter((id: string | null): id is string => !!id);

	const remixSourcePhotos = new Map<string, string | null>();
	if (remixBondIds.length > 0) {
		const { data: sourceBonds } = await supabase
			.from('bonds')
			.select('id, photo_url')
			.in('id', remixBondIds);
		for (const sb of (sourceBonds || []) as { id: string; photo_url: string | null }[]) {
			remixSourcePhotos.set(sb.id, sb.photo_url);
		}
	}

	// Transform bonds to include partner info and map prompts correctly
	const transformedBonds = (bonds || []).map((bond: any) => {
		const isInitiator = bond.guest_a_id === me.id;
		const partner = isInitiator ? bond.guest_b : bond.guest_a;

		// Map prompts based on whether user is guest_a or guest_b
		// If user is guest_a, their prompt is prompt_a
		// If user is guest_b, their prompt is prompt_b
		const myPrompt = isInitiator ? bond.prompt_a : bond.prompt_b;
		const partnerPrompt = isInitiator ? bond.prompt_b : bond.prompt_a;

		const isRemix = !!(bond.remix_bond_id || (bond.phase_number && bond.phase_number >= 2));

		return {
			id: bond.id,
			status: bond.status,
			isInitiator,
			partner: {
				id: partner.id,
				nickname: partner.nickname,
				photo_url: partner.photo_url
			},
			prompt: bond.prompt, // Legacy single prompt (backwards compatibility)
			myPrompt: myPrompt || null,
			partnerPrompt: partnerPrompt || null,
			activityPrompt: bond.activity_prompt || null,
			photo_url: bond.photo_url,
			initiated_at: bond.initiated_at,
			accepted_at: bond.accepted_at,
			completed_at: bond.completed_at,
			remixBondId: bond.remix_bond_id || null,
			remixSourcePhoto: bond.remix_bond_id ? (remixSourcePhotos.get(bond.remix_bond_id) ?? null) : null,
			isRemix
		};
	});

	// Fetch ledger entries for this user
	const { data: ledgerEntries } = await supabase
		.from('point_ledger' as any)
		.select('id, guest_id, points, reason, created_at')
		.eq('guest_id', me.id);

	// Calculate points from deduplicated bonds (one per pair per phase, prefer best status)
	const pointsMap = calculateGuestPoints(
		deduplicateBonds(
			(bonds || []).map((b: any) => ({
				guest_a_id: b.guest_a_id,
				guest_b_id: b.guest_b_id,
				status: b.status,
				phase_number: b.phase_number ?? 1
			}))
		)
	);
	if (ledgerEntries && ledgerEntries.length > 0) {
		applyLedgerPoints(pointsMap, ledgerEntries);
	}
	const myPoints = pointsMap.get(me.id)?.totalPoints ?? 0;

	return json({
		myId: me.id,
		myPoints,
		myTeamEmoji: me.team_emoji ?? null,
		bonds: transformedBonds
	});
};
