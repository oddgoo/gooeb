<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { getSupabase } from '$lib/supabase/client';
	import { fade } from 'svelte/transition';
	import type { RealtimeChannel } from '@supabase/supabase-js';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	let standbyMode = $state(false);
	let channel: RealtimeChannel | null = null;
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	async function fetchStandby() {
		try {
			const res = await fetch('/api/standby');
			const data = await res.json();
			standbyMode = data.standby_mode;
		} catch (e) {
			console.error('Failed to fetch standby state:', e);
		}
	}

	function setupRealtimeStandby() {
		if (!browser) return;
		const supabase = getSupabase();
		if (!supabase) return;

		channel = supabase
			.channel('standby-events')
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'events' },
				() => {
					fetchStandby();
				}
			)
			.subscribe((status) => {
				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					startPolling();
				}
			});
	}

	function startPolling() {
		if (pollInterval) return;
		pollInterval = setInterval(fetchStandby, 5000);
	}

	onMount(() => {
		fetchStandby();
		setupRealtimeStandby();
		// Fallback polling every 5s
		pollInterval = setInterval(fetchStandby, 5000);
	});

	onDestroy(() => {
		if (channel) {
			const supabase = getSupabase();
			if (supabase) supabase.removeChannel(channel);
		}
		if (pollInterval) clearInterval(pollInterval);
	});
</script>

<div class="min-h-screen bg-gray-50">
	{@render children()}
</div>

{#if standbyMode}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
		style="pointer-events: all;"
		transition:fade={{ duration: 300 }}
	>
		<div class="text-center px-8">
			<div class="text-6xl mb-6 animate-pulse">👀</div>
			<h1
				class="text-4xl font-bold font-['VT323'] tracking-wider text-white mb-4"
				style="text-shadow: 2px 2px 0 #FF69B4, -1px -1px 0 #00D4AA;"
			>
				Heads up!
			</h1>
			<p class="text-2xl text-white/80 font-['VT323']">Look around you</p>
		</div>
	</div>
{/if}
