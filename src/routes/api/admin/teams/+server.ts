import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import { TEAM_EMOJIS } from '$lib/utils/teamEmojis';
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

function shuffle<T>(array: T[]): T[] {
	const arr = [...array];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

// POST /api/admin/teams - Generate teams
export const POST: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const body = await request.json().catch(() => {
		throw error(400, { message: 'Invalid request body' });
	}) as { teamSize?: number };

	const { teamSize = 4 } = body;

	if (teamSize < 2 || teamSize > 20) {
		throw error(400, { message: 'Team size must be between 2 and 20' });
	}

	const supabase = createServerClient();

	// Fetch all guests
	const { data: guests, error: queryError } = await supabase
		.from('guests')
		.select('id, nickname')
		.order('created_at', { ascending: true });

	if (queryError) {
		console.error('Teams query error:', queryError);
		throw error(500, { message: 'Failed to load guests' });
	}

	if (!guests || guests.length === 0) {
		throw error(400, { message: 'No guests found' });
	}

	// Shuffle guests and chunk into teams
	const shuffled = shuffle(guests);
	const teams: { emoji: string; members: { id: string; nickname: string }[] }[] = [];
	const availableEmojis = shuffle(TEAM_EMOJIS);

	for (let i = 0; i < shuffled.length; i += teamSize) {
		const chunk = shuffled.slice(i, i + teamSize);
		const teamIndex = Math.floor(i / teamSize);
		const emoji = availableEmojis[teamIndex % availableEmojis.length];
		teams.push({ emoji, members: chunk });
	}

	// Update each guest's team_emoji
	for (const team of teams) {
		const guestIds = team.members.map((m) => m.id);
		const { error: updateError } = await (supabase
			.from('guests') as any)
			.update({ team_emoji: team.emoji })
			.in('id', guestIds);

		if (updateError) {
			console.error('Team update error:', updateError);
			throw error(500, { message: 'Failed to assign teams' });
		}
	}

	return json({
		teams: teams.map((t) => ({
			emoji: t.emoji,
			members: t.members.map((m) => m.nickname)
		}))
	});
};

// DELETE /api/admin/teams - Clear all teams
export const DELETE: RequestHandler = async ({ cookies }) => {
	await requireAdmin(cookies);

	const supabase = createServerClient();

	const { error: updateError } = await (supabase
		.from('guests') as any)
		.update({ team_emoji: null })
		.not('team_emoji', 'is', null);

	if (updateError) {
		console.error('Clear teams error:', updateError);
		throw error(500, { message: 'Failed to clear teams' });
	}

	return json({ success: true });
};
