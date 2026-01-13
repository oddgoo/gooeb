// Shared bond logic for server-side use
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PromptCategory } from './types';

type BondRow = {
	id: string;
	guest_a_id: string;
	guest_b_id: string;
	status: string;
	event_id: string;
};

/**
 * Accept a pending bond and assign a random prompt
 * Returns the prompt info on success, or throws an error
 */
export async function acceptBond(
	supabase: SupabaseClient<Database>,
	bond: BondRow
): Promise<{ promptId: string; word: string; category: PromptCategory }> {
	// Find categories already used between these two
	const { data: existingBondsData } = await supabase
		.from('bonds')
		.select('prompts(category)')
		.or(
			`and(guest_a_id.eq.${bond.guest_a_id},guest_b_id.eq.${bond.guest_b_id}),and(guest_a_id.eq.${bond.guest_b_id},guest_b_id.eq.${bond.guest_a_id})`
		)
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
		throw new Error('All categories completed with this person!');
	}

	// Pick a random available category
	const selectedCategory = availableCategories[Math.floor(Math.random() * availableCategories.length)];

	// Get a random prompt from that category
	const { data: prompts } = await supabase
		.from('prompts')
		.select('id, word')
		.eq('event_id', bond.event_id)
		.eq('category', selectedCategory)
		.eq('is_active', true);

	if (!prompts || prompts.length === 0) {
		throw new Error('No prompts available for this category');
	}

	const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)] as { id: string; word: string };

	// Update the bond with optimistic locking
	const { error: updateError, count } = await supabase
		.from('bonds')
		.update({
			status: 'accepted',
			prompt_id: selectedPrompt.id,
			accepted_at: new Date().toISOString()
		} as never)
		.eq('id', bond.id)
		.eq('status', 'pending'); // Optimistic lock

	if (updateError || count === 0) {
		throw new Error('Bond was already processed');
	}

	return {
		promptId: selectedPrompt.id,
		word: selectedPrompt.word,
		category: selectedCategory
	};
}
