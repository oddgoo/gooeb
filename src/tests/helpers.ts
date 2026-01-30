// Test helpers for integration tests
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load .env file for tests
config();

export type TestDatabase = {
	// Simplified types for testing
	public: {
		Tables: {
			events: { Row: { id: string; name: string; slug: string; is_active: boolean } };
			mask_codes: { Row: { id: string; event_id: string; code: string; is_claimed: boolean } };
			guests: { Row: { id: string; event_id: string; mask_code_id: string; nickname: string; photo_url: string } };
			prompts: { Row: { id: string; event_id: string; word: string; category: string; is_active: boolean } };
			bonds: { Row: { id: string; event_id: string; guest_a_id: string; guest_b_id: string; prompt_id: string | null; status: string; photo_url: string | null } };
		};
	};
};

let supabase: SupabaseClient | null = null;

export function getTestSupabase(): SupabaseClient {
	if (!supabase) {
		const url = process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
		const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

		if (!url || !key) {
			throw new Error('Missing Supabase test environment variables. Make sure .env is configured.');
		}

		supabase = createClient(url, key, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});
	}

	return supabase;
}

// Test data constants
export const TEST_EVENT_ID = '00000000-0000-0000-0000-000000000001';

// Ensure test event and prompts exist
let initialized = false;
export async function ensureTestData(): Promise<void> {
	if (initialized) return;

	const supabase = getTestSupabase();

	// Create test event if it doesn't exist
	const { data: existingEvent } = await supabase
		.from('events')
		.select('id')
		.eq('id', TEST_EVENT_ID)
		.single();

	if (!existingEvent) {
		const { error: eventError } = await supabase.from('events').insert({
			id: TEST_EVENT_ID,
			name: 'Test Party',
			slug: 'test',
			is_active: true
		});
		if (eventError) {
			console.error('Failed to create test event:', eventError);
			throw eventError;
		}
	}

	// Create test prompts if none exist
	const { data: existingPrompts } = await supabase
		.from('prompts')
		.select('id')
		.eq('event_id', TEST_EVENT_ID)
		.limit(1);

	if (!existingPrompts || existingPrompts.length === 0) {
		const prompts = [
			{ event_id: TEST_EVENT_ID, word: 'Pirate', category: 'character', is_active: true },
			{ event_id: TEST_EVENT_ID, word: 'Robot', category: 'character', is_active: true },
			{ event_id: TEST_EVENT_ID, word: 'Chaos', category: 'theme', is_active: true },
			{ event_id: TEST_EVENT_ID, word: 'Love', category: 'theme', is_active: true },
			{ event_id: TEST_EVENT_ID, word: 'Moon', category: 'place', is_active: true },
			{ event_id: TEST_EVENT_ID, word: 'Disco', category: 'place', is_active: true },
		];

		const { error: promptError } = await supabase.from('prompts').insert(prompts);
		if (promptError) {
			console.error('Failed to create test prompts:', promptError);
			throw promptError;
		}
	}

	initialized = true;
}

// Generate unique test codes to avoid conflicts
export function generateTestCode(): string {
	return Math.floor(100 + Math.random() * 900).toString();
}

// Create a test guest and return their details
export async function createTestGuest(code?: string): Promise<{
	guestId: string;
	maskCodeId: string;
	code: string;
	nickname: string;
}> {
	const supabase = getTestSupabase();
	const testCode = code || generateTestCode();
	const nickname = `TestUser_${testCode}`;
	const guestId = crypto.randomUUID();
	const maskCodeId = crypto.randomUUID();

	// Create mask code
	await supabase.from('mask_codes').insert({
		id: maskCodeId,
		event_id: TEST_EVENT_ID,
		code: testCode,
		is_claimed: true
	});

	// Create guest
	await supabase.from('guests').insert({
		id: guestId,
		event_id: TEST_EVENT_ID,
		mask_code_id: maskCodeId,
		nickname,
		photo_url: 'https://example.com/test.jpg',
		auth_token: crypto.randomUUID()
	});

	return { guestId, maskCodeId, code: testCode, nickname };
}

// Clean up test data
export async function cleanupTestGuest(guestId: string, maskCodeId: string): Promise<void> {
	const supabase = getTestSupabase();

	// Delete bonds involving this guest
	await supabase.from('bonds').delete().or(`guest_a_id.eq.${guestId},guest_b_id.eq.${guestId}`);

	// Delete guest
	await supabase.from('guests').delete().eq('id', guestId);

	// Delete mask code
	await supabase.from('mask_codes').delete().eq('id', maskCodeId);
}

// Create a bond between two guests
export async function createTestBond(
	guestAId: string,
	guestBId: string,
	status: 'pending' | 'accepted' | 'completed' = 'pending'
): Promise<string> {
	const supabase = getTestSupabase();
	const bondId = crypto.randomUUID();

	// Get a prompt if status is accepted or completed
	let promptId: string | null = null;
	if (status !== 'pending') {
		const { data: prompt } = await supabase
			.from('prompts')
			.select('id')
			.eq('event_id', TEST_EVENT_ID)
			.eq('is_active', true)
			.limit(1)
			.single();
		promptId = prompt?.id || null;
	}

	await supabase.from('bonds').insert({
		id: bondId,
		event_id: TEST_EVENT_ID,
		guest_a_id: guestAId,
		guest_b_id: guestBId,
		status,
		prompt_id: promptId,
		initiated_at: new Date().toISOString(),
		accepted_at: status !== 'pending' ? new Date().toISOString() : null,
		completed_at: status === 'completed' ? new Date().toISOString() : null
	});

	return bondId;
}

// Clean up a test bond
export async function cleanupTestBond(bondId: string): Promise<void> {
	const supabase = getTestSupabase();
	await supabase.from('bonds').delete().eq('id', bondId);
}
