// Bonds store with realtime updates
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { getSupabase } from '$lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type BondPartner = {
	id: string;
	nickname: string;
	photo_url: string;
};

export type BondPrompt = {
	id: string;
	word: string;
	category: 'character' | 'theme' | 'place';
};

export type ActivityPrompt = {
	id: string;
	description: string;
};

export type Bond = {
	id: string;
	status: 'pending' | 'accepted' | 'completed';
	isInitiator: boolean;
	partner: BondPartner;
	prompt: BondPrompt | null; // Legacy single prompt
	myPrompt: BondPrompt | null; // My individual prompt
	partnerPrompt: BondPrompt | null; // Partner's individual prompt
	activityPrompt: ActivityPrompt | null; // Shared activity
	photo_url: string | null;
	initiated_at: string;
	accepted_at: string | null;
	completed_at: string | null;
};

type BondsState = {
	bonds: Bond[];
	myId: string | null;
	loading: boolean;
	error: string | null;
};

function createBondsStore() {
	const { subscribe, set, update } = writable<BondsState>({
		bonds: [],
		myId: null,
		loading: false,
		error: null
	});

	let channel: RealtimeChannel | null = null;
	let currentMyId: string | null = null;
	let realtimeSetup = false;
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let visibilityCleanup: (() => void) | null = null;

	// Fetch data only (called by realtime updates)
	async function fetchData() {
		if (!browser) return null;

		try {
			const response = await fetch('/api/bond/list');
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || 'Failed to load bonds');
			}

			currentMyId = data.myId;
			set({
				bonds: data.bonds,
				myId: data.myId,
				loading: false,
				error: null
			});

			return data.myId;
		} catch (e) {
			update((s) => ({
				...s,
				loading: false,
				error: e instanceof Error ? e.message : 'Failed to load bonds'
			}));
			return null;
		}
	}

	// Initial load - fetches data and sets up realtime (only once)
	async function load() {
		if (!browser) return;

		update((s) => ({ ...s, loading: true, error: null }));

		const myId = await fetchData();

		// Set up realtime subscription only once
		if (myId && !realtimeSetup) {
			setupRealtime(myId);
			setupVisibilityHandler();
			startPolling();
		}
	}

	function setupRealtime(myId: string) {
		if (!browser || !myId || realtimeSetup) return;

		const supabase = getSupabase();
		if (!supabase) return;

		realtimeSetup = true;

		// Subscribe to bond changes involving this user
		channel = supabase
			.channel('bonds-changes')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'bonds',
					filter: `guest_a_id=eq.${myId}`
				},
				() => {
					// Reload data only (don't re-setup realtime)
					fetchData();
				}
			)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'bonds',
					filter: `guest_b_id=eq.${myId}`
				},
				() => {
					fetchData();
				}
			)
			.subscribe();
	}

	// Refetch when tab becomes visible (handles background tab issue)
	function setupVisibilityHandler() {
		if (!browser || visibilityCleanup) return;

		const handleVisibilityChange = () => {
			if (!document.hidden && currentMyId) {
				fetchData();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		visibilityCleanup = () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}

	// Polling ensures recipients see invites quickly even if realtime is flaky
	function startPolling() {
		if (!browser || pollInterval) return;

		pollInterval = setInterval(() => {
			// Only poll when tab is visible to avoid wasted requests
			if (!document.hidden && currentMyId) {
				fetchData();
			}
		}, 2000); // Poll every 2 seconds for responsive party experience
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	function cleanup() {
		// Clean up realtime subscription
		const supabase = getSupabase();
		if (channel && supabase) {
			supabase.removeChannel(channel);
			channel = null;
		}
		realtimeSetup = false;

		// Clean up visibility handler
		if (visibilityCleanup) {
			visibilityCleanup();
			visibilityCleanup = null;
		}

		// Clean up polling
		stopPolling();
	}

	return {
		subscribe,
		load,
		cleanup,

		// Optimistically add a pending bond after sending invite
		addPendingBond(bondId: string, partner: BondPartner) {
			update((s) => ({
				...s,
				bonds: [
					{
						id: bondId,
						status: 'pending',
						isInitiator: true,
						partner,
						prompt: null,
						myPrompt: null,
						partnerPrompt: null,
						activityPrompt: null,
						photo_url: null,
						initiated_at: new Date().toISOString(),
						accepted_at: null,
						completed_at: null
					},
					...s.bonds
				]
			}));
		}
	};
}

export const bonds = createBondsStore();

// Derived stores for filtered bond lists
export const pendingIncoming = derived(bonds, ($bonds) =>
	$bonds.bonds.filter((b) => b.status === 'pending' && !b.isInitiator)
);

export const pendingOutgoing = derived(bonds, ($bonds) =>
	$bonds.bonds.filter((b) => b.status === 'pending' && b.isInitiator)
);

export const activeBonds = derived(bonds, ($bonds) =>
	$bonds.bonds.filter((b) => b.status === 'accepted')
);

export const completedBonds = derived(bonds, ($bonds) =>
	$bonds.bonds.filter((b) => b.status === 'completed')
);
