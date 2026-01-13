import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
	getTestSupabase,
	createTestGuest,
	cleanupTestGuest,
	createTestBond,
	cleanupTestBond,
	ensureTestData,
	TEST_EVENT_ID
} from './helpers';

describe('Bond Integration Tests', () => {
	let guestA: Awaited<ReturnType<typeof createTestGuest>>;
	let guestB: Awaited<ReturnType<typeof createTestGuest>>;

	beforeAll(async () => {
		// Ensure test event and prompts exist
		await ensureTestData();
	});

	beforeEach(async () => {
		// Create two test guests for each test
		guestA = await createTestGuest();
		guestB = await createTestGuest();
	});

	afterEach(async () => {
		// Clean up test data
		if (guestA) {
			await cleanupTestGuest(guestA.guestId, guestA.maskCodeId);
		}
		if (guestB) {
			await cleanupTestGuest(guestB.guestId, guestB.maskCodeId);
		}
	});

	describe('Bond Creation', () => {
		it('can create a pending bond between two guests', async () => {
			const supabase = getTestSupabase();

			const bondId = await createTestBond(guestA.guestId, guestB.guestId, 'pending');

			// Verify bond exists
			const { data: bond } = await supabase
				.from('bonds')
				.select('*')
				.eq('id', bondId)
				.single();

			expect(bond).toBeTruthy();
			expect(bond?.status).toBe('pending');
			expect(bond?.guest_a_id).toBe(guestA.guestId);
			expect(bond?.guest_b_id).toBe(guestB.guestId);
			expect(bond?.prompt_id).toBeNull();

			await cleanupTestBond(bondId);
		});

		it('can create an accepted bond with prompt', async () => {
			const supabase = getTestSupabase();

			const bondId = await createTestBond(guestA.guestId, guestB.guestId, 'accepted');

			const { data: bond } = await supabase
				.from('bonds')
				.select('*, prompts(word, category)')
				.eq('id', bondId)
				.single();

			expect(bond).toBeTruthy();
			expect(bond?.status).toBe('accepted');
			expect(bond?.prompt_id).toBeTruthy();
			expect(bond?.accepted_at).toBeTruthy();

			await cleanupTestBond(bondId);
		});
	});

	describe('Bond Queries', () => {
		it('can find bonds for a specific guest', async () => {
			const supabase = getTestSupabase();

			// Create a bond
			const bondId = await createTestBond(guestA.guestId, guestB.guestId, 'pending');

			// Query bonds where guest A is initiator
			const { data: bondsAsA } = await supabase
				.from('bonds')
				.select('*')
				.eq('guest_a_id', guestA.guestId);

			expect(bondsAsA).toHaveLength(1);
			expect(bondsAsA?.[0].id).toBe(bondId);

			// Query bonds where guest B is receiver
			const { data: bondsAsB } = await supabase
				.from('bonds')
				.select('*')
				.eq('guest_b_id', guestB.guestId);

			expect(bondsAsB).toHaveLength(1);
			expect(bondsAsB?.[0].id).toBe(bondId);

			await cleanupTestBond(bondId);
		});

		it('can find bonds for either position using OR', async () => {
			const supabase = getTestSupabase();

			// Create bond where A initiates
			const bondId1 = await createTestBond(guestA.guestId, guestB.guestId, 'pending');

			// Create a third guest and a bond where A receives
			const guestC = await createTestGuest();
			const bondId2 = await createTestBond(guestC.guestId, guestA.guestId, 'pending');

			// Query all bonds involving guest A
			const { data: allBondsForA } = await supabase
				.from('bonds')
				.select('*')
				.or(`guest_a_id.eq.${guestA.guestId},guest_b_id.eq.${guestA.guestId}`);

			expect(allBondsForA).toHaveLength(2);

			// Cleanup
			await cleanupTestBond(bondId1);
			await cleanupTestBond(bondId2);
			await cleanupTestGuest(guestC.guestId, guestC.maskCodeId);
		});
	});

	describe('Bond Status Updates', () => {
		it('can accept a pending bond with optimistic locking', async () => {
			const supabase = getTestSupabase();

			const bondId = await createTestBond(guestA.guestId, guestB.guestId, 'pending');

			// Get a prompt
			const { data: prompt } = await supabase
				.from('prompts')
				.select('id')
				.eq('event_id', TEST_EVENT_ID)
				.eq('is_active', true)
				.limit(1)
				.single();

			// Accept with optimistic lock
			const { data: updated, error } = await supabase
				.from('bonds')
				.update({
					status: 'accepted',
					prompt_id: prompt?.id,
					accepted_at: new Date().toISOString()
				})
				.eq('id', bondId)
				.eq('status', 'pending') // Optimistic lock
				.select();

			expect(error).toBeNull();
			expect(updated).toHaveLength(1);

			// Verify status changed
			const { data: bond } = await supabase
				.from('bonds')
				.select('status')
				.eq('id', bondId)
				.single();

			expect(bond?.status).toBe('accepted');

			await cleanupTestBond(bondId);
		});

		it('optimistic lock prevents double-accept', async () => {
			const supabase = getTestSupabase();

			const bondId = await createTestBond(guestA.guestId, guestB.guestId, 'pending');

			// First accept succeeds
			const { data: firstUpdate } = await supabase
				.from('bonds')
				.update({ status: 'accepted' })
				.eq('id', bondId)
				.eq('status', 'pending')
				.select();

			expect(firstUpdate).toHaveLength(1);

			// Second accept fails (already accepted)
			const { data: secondUpdate } = await supabase
				.from('bonds')
				.update({ status: 'accepted' })
				.eq('id', bondId)
				.eq('status', 'pending')
				.select();

			expect(secondUpdate).toHaveLength(0);

			await cleanupTestBond(bondId);
		});

		it('can complete an accepted bond', async () => {
			const supabase = getTestSupabase();

			const bondId = await createTestBond(guestA.guestId, guestB.guestId, 'accepted');

			// Complete the bond
			const { data: updated, error } = await supabase
				.from('bonds')
				.update({
					status: 'completed',
					photo_url: 'https://example.com/bond-photo.jpg',
					completed_at: new Date().toISOString()
				})
				.eq('id', bondId)
				.eq('status', 'accepted')
				.select();

			expect(error).toBeNull();
			expect(updated).toHaveLength(1);

			// Verify
			const { data: bond } = await supabase
				.from('bonds')
				.select('*')
				.eq('id', bondId)
				.single();

			expect(bond?.status).toBe('completed');
			expect(bond?.photo_url).toBe('https://example.com/bond-photo.jpg');
			expect(bond?.completed_at).toBeTruthy();

			await cleanupTestBond(bondId);
		});
	});

	describe('Prompt Categories', () => {
		it('can query prompts by category', async () => {
			const supabase = getTestSupabase();

			const { data: characterPrompts } = await supabase
				.from('prompts')
				.select('*')
				.eq('event_id', TEST_EVENT_ID)
				.eq('category', 'character')
				.eq('is_active', true);

			const { data: themePrompts } = await supabase
				.from('prompts')
				.select('*')
				.eq('event_id', TEST_EVENT_ID)
				.eq('category', 'theme')
				.eq('is_active', true);

			const { data: placePrompts } = await supabase
				.from('prompts')
				.select('*')
				.eq('event_id', TEST_EVENT_ID)
				.eq('category', 'place')
				.eq('is_active', true);

			// Should have prompts in each category (based on seed data)
			expect(characterPrompts?.length).toBeGreaterThan(0);
			expect(themePrompts?.length).toBeGreaterThan(0);
			expect(placePrompts?.length).toBeGreaterThan(0);
		});

		it('can find used categories between two guests', async () => {
			const supabase = getTestSupabase();

			// Create a completed bond with a prompt
			const bondId = await createTestBond(guestA.guestId, guestB.guestId, 'completed');

			// Get the prompt category from this bond
			const { data: bond } = await supabase
				.from('bonds')
				.select('prompts(category)')
				.eq('id', bondId)
				.single();

			const usedCategory = (bond?.prompts as { category: string } | null)?.category;
			expect(usedCategory).toBeTruthy();

			// Query to find all used categories between these two guests
			const { data: existingBonds } = await supabase
				.from('bonds')
				.select('prompts(category)')
				.or(
					`and(guest_a_id.eq.${guestA.guestId},guest_b_id.eq.${guestB.guestId}),` +
					`and(guest_a_id.eq.${guestB.guestId},guest_b_id.eq.${guestA.guestId})`
				)
				.in('status', ['accepted', 'completed']);

			const usedCategories = existingBonds
				?.map((b) => (b.prompts as { category: string } | null)?.category)
				.filter(Boolean);

			expect(usedCategories).toContain(usedCategory);

			await cleanupTestBond(bondId);
		});
	});
});
