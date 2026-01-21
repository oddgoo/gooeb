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

type AcceptBondResult = {
	promptA: { id: string; word: string; category: PromptCategory };
	promptB: { id: string; word: string; category: PromptCategory };
	activityPrompt: { id: string; description: string };
};

/**
 * Accept a pending bond and assign prompts
 * Each player gets a different prompt from a different category
 * Both players share an activity prompt
 * Returns the prompt info on success, or throws an error
 */
export async function acceptBond(
	supabase: SupabaseClient<Database>,
	bond: BondRow
): Promise<AcceptBondResult> {
	// Find categories already used between these two
	const { data: existingBondsData, error: existingError } = await supabase
		.from('bonds')
		.select('prompt_a_id, prompt_b_id, prompts!bonds_prompt_a_id_fkey(category)')
		.or(
			`and(guest_a_id.eq.${bond.guest_a_id},guest_b_id.eq.${bond.guest_b_id}),and(guest_a_id.eq.${bond.guest_b_id},guest_b_id.eq.${bond.guest_a_id})`
		)
		.eq('status', 'completed');

	if (existingError) {
		console.error('Error fetching existing bonds:', existingError);
		throw new Error('Failed to check existing bonds');
	}

	// Collect all used categories from both prompt_a and prompt_b
	const usedCategories = new Set<string>();
	if (existingBondsData) {
		for (const b of existingBondsData as Array<{ prompts: { category: string } | null }>) {
			if (b.prompts?.category) {
				usedCategories.add(b.prompts.category);
			}
		}
	}

	// Determine available categories
	const allCategories: PromptCategory[] = ['character', 'theme', 'place'];
	const availableCategories = allCategories.filter((c) => !usedCategories.has(c));

	if (availableCategories.length < 2) {
		throw new Error('Not enough categories left for bonding with this person!');
	}

	// Shuffle and pick two different categories for each player
	const shuffledCategories = availableCategories.sort(() => Math.random() - 0.5);
	const categoryA = shuffledCategories[0];
	const categoryB = shuffledCategories[1];

	// Get prompts for both categories
	const { data: promptsA, error: promptsAError } = await supabase
		.from('prompts')
		.select('id, word, category')
		.eq('event_id', bond.event_id)
		.eq('category', categoryA)
		.eq('is_active', true);

	if (promptsAError) {
		console.error('Error fetching prompts for category A:', promptsAError);
		throw new Error('Failed to fetch prompts');
	}

	const { data: promptsB, error: promptsBError } = await supabase
		.from('prompts')
		.select('id, word, category')
		.eq('event_id', bond.event_id)
		.eq('category', categoryB)
		.eq('is_active', true);

	if (promptsBError) {
		console.error('Error fetching prompts for category B:', promptsBError);
		throw new Error('Failed to fetch prompts');
	}

	if (!promptsA || promptsA.length === 0) {
		throw new Error(`No prompts available for category: ${categoryA}`);
	}

	if (!promptsB || promptsB.length === 0) {
		throw new Error(`No prompts available for category: ${categoryB}`);
	}

	// Select random prompts from each category
	const selectedPromptA = promptsA[Math.floor(Math.random() * promptsA.length)] as {
		id: string;
		word: string;
		category: PromptCategory;
	};
	const selectedPromptB = promptsB[Math.floor(Math.random() * promptsB.length)] as {
		id: string;
		word: string;
		category: PromptCategory;
	};

	// Get the current phase for the event
	const { data: eventData, error: eventError } = await supabase
		.from('events')
		.select('current_phase_id')
		.eq('id', bond.event_id)
		.single();

	if (eventError) {
		console.error('Error fetching event:', eventError);
		throw new Error('Failed to fetch event');
	}

	const eventWithPhase = eventData as { current_phase_id: string | null } | null;

	let currentPhaseNumber = 1; // Default to phase 1
	if (eventWithPhase?.current_phase_id) {
		const { data: phaseData } = await supabase
			.from('phases')
			.select('phase_number')
			.eq('id', eventWithPhase.current_phase_id)
			.single();
		const phase = phaseData as { phase_number: number } | null;
		if (phase) {
			currentPhaseNumber = phase.phase_number;
		}
	}

	// Get a random activity prompt that's valid for the current phase
	const { data: activityPrompts, error: activityError } = await supabase
		.from('activity_prompts')
		.select('id, description, phase_numbers')
		.eq('event_id', bond.event_id)
		.eq('is_active', true);

	if (activityError) {
		console.error('Error fetching activity prompts:', activityError);
		throw new Error('Failed to fetch activity prompts');
	}

	// Filter activity prompts by current phase
	type ActivityPromptWithPhases = { id: string; description: string; phase_numbers: number[] | null };
	const phaseFilteredPrompts = ((activityPrompts || []) as ActivityPromptWithPhases[]).filter((p) => {
		const phaseNumbers = p.phase_numbers || [1];
		return phaseNumbers.includes(currentPhaseNumber);
	});

	if (phaseFilteredPrompts.length === 0) {
		throw new Error(`No activity prompts available for phase ${currentPhaseNumber}`);
	}

	const selectedActivity = phaseFilteredPrompts[
		Math.floor(Math.random() * phaseFilteredPrompts.length)
	] as {
		id: string;
		description: string;
	};

	// Update the bond with optimistic locking
	const { error: updateError, count } = await supabase
		.from('bonds')
		.update({
			status: 'accepted',
			prompt_a_id: selectedPromptA.id,
			prompt_b_id: selectedPromptB.id,
			activity_prompt_id: selectedActivity.id,
			accepted_at: new Date().toISOString()
		} as never)
		.eq('id', bond.id)
		.eq('status', 'pending'); // Optimistic lock

	if (updateError || count === 0) {
		throw new Error('Bond was already processed');
	}

	return {
		promptA: {
			id: selectedPromptA.id,
			word: selectedPromptA.word,
			category: categoryA
		},
		promptB: {
			id: selectedPromptB.id,
			word: selectedPromptB.word,
			category: categoryB
		},
		activityPrompt: {
			id: selectedActivity.id,
			description: selectedActivity.description
		}
	};
}
