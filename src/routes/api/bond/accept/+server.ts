import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { RequestHandler } from './$types';
import type { PromptCategory } from '$lib/supabase/types';

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

	// Find categories already used between these two
	const { data: existingBondsData } = await supabase
		.from('bonds')
		.select('prompts(category)')
		.or(`and(guest_a_id.eq.${bond.guest_a_id},guest_b_id.eq.${bond.guest_b_id}),and(guest_a_id.eq.${bond.guest_b_id},guest_b_id.eq.${bond.guest_a_id})`)
		.eq('status', 'completed');

	const existingBonds = existingBondsData as Array<{ prompts: { category: string } | null }> | null;

	const usedCategories = new Set<string>();
	if (existingBonds) {
		for (const b of existingBonds) {
			if (b.prompts?.category) {
				usedCategories.add(b.prompts.category);
			}
		}
	}

	// Determine available categories
	const allCategories: PromptCategory[] = ['character', 'theme', 'place'];
	const availableCategories = allCategories.filter((c) => !usedCategories.has(c));

	if (availableCategories.length === 0) {
		error(409, { message: 'All categories completed with this person!' });
	}

	// Pick a random available category
	const selectedCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];

	// Get a random prompt from that category
	const { data: prompts } = await supabase
		.from('prompts')
		.select('id')
		.eq('event_id', bond.event_id)
		.eq('category', selectedCategory)
		.eq('is_active', true);

	if (!prompts || prompts.length === 0) {
		error(500, { message: 'No prompts available for this category' });
	}

	const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)] as { id: string };

	// Update the bond with optimistic locking
	const { error: updateError, count } = await supabase
		.from('bonds')
		.update({
			status: 'accepted',
			prompt_id: selectedPrompt.id,
			accepted_at: new Date().toISOString()
		} as never)
		.eq('id', bondId)
		.eq('status', 'pending'); // Optimistic lock

	if (updateError || count === 0) {
		error(409, { message: 'Bond was already processed' });
	}

	return json({ success: true });
};
