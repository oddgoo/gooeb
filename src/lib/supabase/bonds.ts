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
	promptA: { id: string; word: string; category: PromptCategory } | null;
	promptB: { id: string; word: string; category: PromptCategory } | null;
	activityPrompt: { id: string; description: string };
	remixBondId?: string;
	remixSourcePhoto?: string;
};

/**
 * Resolve the current phase number for an event.
 */
async function resolvePhaseNumber(
	supabase: SupabaseClient<Database>,
	eventId: string
): Promise<number> {
	const { data: eventData, error: eventError } = await supabase
		.from('events')
		.select('current_phase_id')
		.eq('id', eventId)
		.single();

	if (eventError) {
		console.error('Error fetching event:', eventError);
		throw new Error('Failed to fetch event');
	}

	const eventWithPhase = eventData as { current_phase_id: string | null } | null;

	let currentPhaseNumber = 1;
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

	return currentPhaseNumber;
}

export { resolvePhaseNumber };

/**
 * Accept a pending bond and assign prompts.
 * For Source phase (1): assigns word prompts + activity prompt.
 * For Remix phase (2+): assigns activity prompt + random completed Source bond reference, no word prompts.
 */
export async function acceptBond(
	supabase: SupabaseClient<Database>,
	bond: BondRow
): Promise<AcceptBondResult> {
	const currentPhaseNumber = await resolvePhaseNumber(supabase, bond.event_id);

	// Get a random activity prompt that's valid for the current phase
	const { data: activityPrompts, error: activityError } = await supabase
		.from('activity_prompts')
		.select('id, description, phase_numbers, activity_category')
		.eq('event_id', bond.event_id)
		.eq('is_active', true);

	if (activityError) {
		console.error('Error fetching activity prompts:', activityError);
		throw new Error('Failed to fetch activity prompts');
	}

	// Filter activity prompts by current phase
	type ActivityPromptWithPhases = { id: string; description: string; phase_numbers: number[] | null; activity_category: string | null };
	const phaseFilteredPrompts = ((activityPrompts || []) as ActivityPromptWithPhases[]).filter((p) => {
		const phaseNumbers = p.phase_numbers || [1];
		return phaseNumbers.includes(currentPhaseNumber);
	});

	if (phaseFilteredPrompts.length === 0) {
		throw new Error(`No activity prompts available for phase ${currentPhaseNumber}`);
	}

	// Weighted selection: photo activities get ~5% each, others share the rest equally
	const PHOTO_WEIGHT = 0.05;
	const photoPrompts = phaseFilteredPrompts.filter((p) => p.activity_category === 'photo');
	const otherPrompts = phaseFilteredPrompts.filter((p) => p.activity_category !== 'photo');

	const totalPhotoWeight = photoPrompts.length * PHOTO_WEIGHT;
	const remainingWeight = 1 - totalPhotoWeight;
	const otherWeight = otherPrompts.length > 0 ? remainingWeight / otherPrompts.length : 0;

	const weighted: { prompt: ActivityPromptWithPhases; weight: number }[] = [
		...photoPrompts.map((p) => ({ prompt: p, weight: PHOTO_WEIGHT })),
		...otherPrompts.map((p) => ({ prompt: p, weight: otherWeight }))
	];

	const roll = Math.random();
	let cumulative = 0;
	let selectedActivity = weighted[0].prompt;
	for (const entry of weighted) {
		cumulative += entry.weight;
		if (roll < cumulative) {
			selectedActivity = entry.prompt;
			break;
		}
	}

	// --- REMIX PHASE: skip word prompts, pick a random completed Source bond ---
	if (currentPhaseNumber >= 2) {
		// Find all completed Source bonds in this event (include activity_prompt_id for category filtering)
		const { data: sourceBonds, error: sourceError } = await supabase
			.from('bonds')
			.select('id, photo_url, activity_prompt_id')
			.eq('event_id', bond.event_id)
			.eq('status', 'completed')
			.eq('phase_number', 1);

		if (sourceError) {
			console.error('Error fetching source bonds:', sourceError);
			throw new Error('Failed to fetch source bonds for remix');
		}

		const completedSourceBonds = (sourceBonds || []) as { id: string; photo_url: string | null; activity_prompt_id: string | null }[];
		if (completedSourceBonds.length === 0) {
			throw new Error('No completed Source melds available to remix!');
		}

		// Pick a random source bond
		const remixSource = completedSourceBonds[Math.floor(Math.random() * completedSourceBonds.length)];

		// Look up the source bond's activity category so we can avoid same-category remix
		let sourceActivityCategory: string | null = null;
		if (remixSource.activity_prompt_id) {
			const { data: sourceActivityData } = await supabase
				.from('activity_prompts')
				.select('activity_category')
				.eq('id', remixSource.activity_prompt_id)
				.single();
			if (sourceActivityData) {
				sourceActivityCategory = (sourceActivityData as { activity_category: string | null }).activity_category;
			}
		}

		// Filter out activity prompts that match the source bond's category (no drawing-of-drawing, etc.)
		let remixActivityCandidates = phaseFilteredPrompts;
		if (sourceActivityCategory) {
			const filtered = phaseFilteredPrompts.filter((p) => p.activity_category !== sourceActivityCategory);
			if (filtered.length > 0) {
				remixActivityCandidates = filtered;
			}
		}

		// Simple random selection (equal probability)
		const remixSelectedActivity = remixActivityCandidates[Math.floor(Math.random() * remixActivityCandidates.length)];

		// Update the bond with activity + remix reference, no word prompts
		const { error: updateError, count } = await supabase
			.from('bonds')
			.update({
				status: 'accepted',
				prompt_a_id: null,
				prompt_b_id: null,
				activity_prompt_id: remixSelectedActivity.id,
				remix_bond_id: remixSource.id,
				accepted_at: new Date().toISOString()
			} as never)
			.eq('id', bond.id)
			.eq('status', 'pending');

		if (updateError || count === 0) {
			throw new Error('Bond was already processed');
		}

		return {
			promptA: null,
			promptB: null,
			activityPrompt: {
				id: remixSelectedActivity.id,
				description: remixSelectedActivity.description
			},
			remixBondId: remixSource.id,
			remixSourcePhoto: remixSource.photo_url || undefined
		};
	}

	// --- SOURCE PHASE: original logic with word prompts ---
	const needsWordPrompts = selectedActivity.activity_category !== 'photo';

	let selectedPromptA: { id: string; word: string; category: PromptCategory } | null = null;
	let selectedPromptB: { id: string; word: string; category: PromptCategory } | null = null;

	if (needsWordPrompts) {
		// Find categories already used between these two
		const { data: existingBondsData, error: existingError } = await supabase
			.from('bonds')
			.select('prompt_a_id, prompt_b_id, prompts!bonds_prompt_a_id_fkey(category)')
			.or(
				`and(guest_a_id.eq.${bond.guest_a_id},guest_b_id.eq.${bond.guest_b_id}),and(guest_a_id.eq.${bond.guest_b_id},guest_b_id.eq.${bond.guest_a_id})`
			)
			.eq('status', 'completed')
			.eq('phase_number', 1);

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

		const pickA = promptsA[Math.floor(Math.random() * promptsA.length)] as { id: string; word: string; category: PromptCategory };
		const pickB = promptsB[Math.floor(Math.random() * promptsB.length)] as { id: string; word: string; category: PromptCategory };
		selectedPromptA = { id: pickA.id, word: pickA.word, category: categoryA };
		selectedPromptB = { id: pickB.id, word: pickB.word, category: categoryB };
	}

	// Update the bond with optimistic locking
	const { error: updateError, count } = await supabase
		.from('bonds')
		.update({
			status: 'accepted',
			prompt_a_id: selectedPromptA?.id ?? null,
			prompt_b_id: selectedPromptB?.id ?? null,
			activity_prompt_id: selectedActivity.id,
			accepted_at: new Date().toISOString()
		} as never)
		.eq('id', bond.id)
		.eq('status', 'pending'); // Optimistic lock

	if (updateError || count === 0) {
		throw new Error('Bond was already processed');
	}

	return {
		promptA: selectedPromptA,
		promptB: selectedPromptB,
		activityPrompt: {
			id: selectedActivity.id,
			description: selectedActivity.description
		}
	};
}
