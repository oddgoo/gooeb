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

export type Bond = {
	id: string;
	status: 'pending' | 'accepted' | 'completed';
	isInitiator: boolean;
	partner: BondPartner;
	prompt: BondPrompt | null;
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

	async function load() {
		if (!browser) return;

		update((s) => ({ ...s, loading: true, error: null }));

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

			// Set up realtime subscription
			setupRealtime(data.myId);
		} catch (e) {
			update((s) => ({
				...s,
				loading: false,
				error: e instanceof Error ? e.message : 'Failed to load bonds'
			}));
		}
	}

	function setupRealtime(myId: string) {
		if (!browser || !myId) return;

		const supabase = getSupabase();
		if (!supabase) return;

		// Clean up existing subscription
		if (channel) {
			supabase.removeChannel(channel);
		}

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
					// Reload all bonds on any change (simpler than partial updates)
					load();
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
					load();
				}
			)
			.subscribe();
	}

	function cleanup() {
		const supabase = getSupabase();
		if (channel && supabase) {
			supabase.removeChannel(channel);
			channel = null;
		}
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
