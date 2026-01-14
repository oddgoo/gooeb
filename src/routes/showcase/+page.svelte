<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import NetworkGraph from '$lib/components/NetworkGraph.svelte';
	import { getSupabase } from '$lib/supabase/client';
	import type { RealtimeChannel } from '@supabase/supabase-js';

	type Guest = {
		id: string;
		nickname: string;
		photo_url: string;
	};

	type Bond = {
		id: string;
		guest_a_id: string;
		guest_b_id: string;
		status: string;
		photo_url: string | null;
		completed_at: string;
		prompt: { word: string; category: string } | null;
		prompt_a: { word: string; category: string } | null;
		prompt_b: { word: string; category: string } | null;
		activity_prompt: { description: string } | null;
	};

	type Stats = {
		totalGuests: number;
		totalBonds: number;
		maxPossibleBonds: number;
		progress: number;
	};

	type LeaderboardEntry = {
		id: string;
		nickname: string;
		photo_url: string;
		bondCount: number;
	};

	let guests = $state<Guest[]>([]);
	let bonds = $state<Bond[]>([]);
	let stats = $state<Stats>({ totalGuests: 0, totalBonds: 0, maxPossibleBonds: 0, progress: 0 });
	let leaderboard = $state<LeaderboardEntry[]>([]);
	let selectedBond = $state<Bond | null>(null);
	let slideshowIndex = $state(0);
	let showConfetti = $state(false);

	let channel: RealtimeChannel | null = null;
	let slideshowInterval: ReturnType<typeof setInterval> | null = null;

	async function loadData() {
		try {
			const response = await fetch('/api/showcase');
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || 'Failed to load showcase data');
			}

			const prevBondCount = bonds.length;

			guests = data.guests;
			bonds = data.bonds;
			stats = data.stats;
			leaderboard = data.leaderboard;

			// Trigger confetti on new bond
			if (prevBondCount > 0 && data.bonds.length > prevBondCount) {
				triggerConfetti();
			}
		} catch (e) {
			console.error('Failed to load showcase data:', e);
		}
	}

	function triggerConfetti() {
		showConfetti = true;
		setTimeout(() => {
			showConfetti = false;
		}, 3000);
	}

	function setupRealtime() {
		if (!browser) return;

		const supabase = getSupabase();
		if (!supabase) return;

		channel = supabase
			.channel('showcase-changes')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'bonds' },
				() => loadData()
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'guests' },
				() => loadData()
			)
			.subscribe();
	}

	function startSlideshow() {
		if (slideshowInterval) clearInterval(slideshowInterval);

		slideshowInterval = setInterval(() => {
			const bondsWithPhotos = bonds.filter((b) => b.photo_url);
			if (bondsWithPhotos.length > 0) {
				slideshowIndex = (slideshowIndex + 1) % bondsWithPhotos.length;
			}
		}, 5000);
	}

	function handleBondClick(bondId: string) {
		const bond = bonds.find((b) => b.id === bondId);
		if (bond) {
			selectedBond = bond;
		}
	}

	function getGuestById(id: string): Guest | undefined {
		return guests.find((g) => g.id === id);
	}

	function getCategoryEmoji(category: string): string {
		switch (category) {
			case 'character': return '👤';
			case 'theme': return '💭';
			case 'place': return '📍';
			default: return '✨';
		}
	}

	onMount(() => {
		loadData();
		setupRealtime();
		startSlideshow();
	});

	onDestroy(() => {
		if (channel) {
			const supabase = getSupabase();
			if (supabase) supabase.removeChannel(channel);
		}
		if (slideshowInterval) clearInterval(slideshowInterval);
	});

	// Slideshow bond
	let currentSlideshowBond = $derived.by(() => {
		const bondsWithPhotos = bonds.filter((b) => b.photo_url);
		return bondsWithPhotos[slideshowIndex] || null;
	});
</script>

<svelte:head>
	<title>The Gooeb - Showcase</title>
</svelte:head>

<!-- Confetti overlay - Y2K colors -->
{#if showConfetti}
	<div class="fixed inset-0 pointer-events-none z-50 overflow-hidden">
		{#each Array(50) as _, i}
			<div
				class="confetti"
				style="
					left: {Math.random() * 100}%;
					animation-delay: {Math.random() * 0.5}s;
					background: {['#FF69B4', '#FFD700', '#00D4AA', '#FF1493', '#87CEEB', '#FFA500'][i % 6]};
				"
			></div>
		{/each}
	</div>
{/if}

<!-- Main showcase layout - 16:9 optimized -->
<div class="min-h-screen p-4 flex flex-col">
	<!-- Header -->
	<div class="text-center mb-4">
		<h1 class="text-4xl font-bold text-y2k-magenta font-['VT323'] tracking-wider drop-shadow-lg"
			style="text-shadow: 2px 2px 0 #FFD700, -1px -1px 0 #00D4AA;">
			THE GOOEB - LIVE BONDS
		</h1>
	</div>

	<!-- Main content grid -->
	<div class="flex-1 grid grid-cols-12 gap-4">
		<!-- Network Graph - Main area -->
		<div class="col-span-8 win-window flex flex-col">
			<div class="win-titlebar">
				<span>Network.exe</span>
			</div>
			<div class="flex-1 p-1">
				<NetworkGraph {guests} {bonds} onBondClick={handleBondClick} />
			</div>
		</div>

		<!-- Right sidebar -->
		<div class="col-span-4 flex flex-col gap-4">
			<!-- Stats -->
			<div class="win-window">
				<div class="win-titlebar">
					<span>Statistics</span>
				</div>
				<div class="p-3 space-y-2">
					<div class="flex justify-between">
						<span>Guests:</span>
						<span class="font-bold">{stats.totalGuests}</span>
					</div>
					<div class="flex justify-between">
						<span>Bonds:</span>
						<span class="font-bold">{stats.totalBonds}</span>
					</div>
					<div class="mt-2">
						<div class="text-sm mb-1">Progress:</div>
						<div class="win-inset h-6 relative overflow-hidden">
							<div
								class="absolute inset-0 bg-gradient-to-r from-y2k-pink to-y2k-magenta transition-all duration-500"
								style="width: {Math.min(stats.progress, 100)}%"
							></div>
							<div class="absolute inset-0 flex items-center justify-center text-xs font-bold text-win-text">
								{stats.progress.toFixed(1)}%
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Leaderboard -->
			<div class="win-window flex-1">
				<div class="win-titlebar">
					<span>Leaderboard</span>
				</div>
				<div class="p-2 overflow-y-auto max-h-[200px]">
					{#if leaderboard.length === 0}
						<div class="text-center text-win-textDisabled py-4">
							No bonds yet
						</div>
					{:else}
						<div class="space-y-1">
							{#each leaderboard as entry, i}
								<div class="win-inset p-1 flex items-center gap-2">
									<span class="w-5 text-center font-bold">
										{#if i === 0}🥇{:else if i === 1}🥈{:else if i === 2}🥉{:else}{i + 1}{/if}
									</span>
									<img
										src={entry.photo_url}
										alt={entry.nickname}
										class="w-6 h-6 object-cover"
									/>
									<span class="flex-1 truncate text-sm">{entry.nickname}</span>
									<span class="font-bold text-y2k-magenta">{entry.bondCount}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Slideshow -->
			<div class="win-window flex-1">
				<div class="win-titlebar">
					<span>Recent Bonds</span>
				</div>
				<div class="p-2">
					{#if currentSlideshowBond}
						{@const guestA = getGuestById(currentSlideshowBond.guest_a_id)}
						{@const guestB = getGuestById(currentSlideshowBond.guest_b_id)}
						<div class="win-inset p-2">
							{#if currentSlideshowBond.photo_url}
								<div class="aspect-square w-full mb-2">
									<img
										src={currentSlideshowBond.photo_url}
										alt="Bond"
										class="w-full h-full object-cover"
									/>
								</div>
							{/if}
							<div class="flex items-center justify-between text-sm">
								<span class="font-bold">{guestA?.nickname || '?'}</span>
								<span>🤝</span>
								<span class="font-bold">{guestB?.nickname || '?'}</span>
							</div>
							{#if currentSlideshowBond.prompt_a || currentSlideshowBond.prompt_b}
								<div class="flex justify-between text-xs mt-1 text-y2k-magenta">
									{#if currentSlideshowBond.prompt_a}
										<span>{getCategoryEmoji(currentSlideshowBond.prompt_a.category)} {currentSlideshowBond.prompt_a.word}</span>
									{/if}
									{#if currentSlideshowBond.prompt_b}
										<span>{getCategoryEmoji(currentSlideshowBond.prompt_b.category)} {currentSlideshowBond.prompt_b.word}</span>
									{/if}
								</div>
							{:else if currentSlideshowBond.prompt}
								<div class="text-center text-xs mt-1 text-y2k-magenta">
									{getCategoryEmoji(currentSlideshowBond.prompt.category)}
									{currentSlideshowBond.prompt.word}
								</div>
							{/if}
						</div>
					{:else}
						<div class="win-inset p-4 text-center text-win-textDisabled">
							<div class="text-2xl mb-2">📸</div>
							<div class="text-sm">Waiting for bonds...</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Bond detail modal -->
{#if selectedBond}
	{@const guestA = getGuestById(selectedBond.guest_a_id)}
	{@const guestB = getGuestById(selectedBond.guest_b_id)}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-40"
		onclick={() => selectedBond = null}
		onkeydown={(e) => e.key === 'Escape' && (selectedBond = null)}
		role="dialog"
		tabindex="-1"
	>
		<div class="win-window max-w-lg w-full mx-4" onclick={(e) => e.stopPropagation()}>
			<div class="win-titlebar">
				<span>Bond Details</span>
				<button class="win-btn px-2 py-0 min-w-0 text-xs" onclick={() => selectedBond = null}>X</button>
			</div>
			<div class="p-4">
				{#if selectedBond.photo_url}
					<div class="aspect-square w-full mb-4 win-inset">
						<img
							src={selectedBond.photo_url}
							alt="Bond"
							class="w-full h-full object-cover"
						/>
					</div>
				{/if}
				<div class="flex items-center justify-around mb-4">
					<div class="text-center">
						<img src={guestA?.photo_url} alt={guestA?.nickname} class="w-16 h-16 object-cover mx-auto win-inset p-1" />
						<div class="font-bold mt-1">{guestA?.nickname}</div>
					</div>
					<div class="text-3xl">🤝</div>
					<div class="text-center">
						<img src={guestB?.photo_url} alt={guestB?.nickname} class="w-16 h-16 object-cover mx-auto win-inset p-1" />
						<div class="font-bold mt-1">{guestB?.nickname}</div>
					</div>
				</div>
				<!-- Dual prompts display -->
				{#if selectedBond.prompt_a || selectedBond.prompt_b}
					<div class="grid grid-cols-2 gap-2 mb-3">
						{#if selectedBond.prompt_a}
							<div class="text-center win-inset p-2">
								<div class="text-xs mb-1">{guestA?.nickname}</div>
								<div class="text-lg font-bold text-y2k-magenta">
									{getCategoryEmoji(selectedBond.prompt_a.category)} {selectedBond.prompt_a.word}
								</div>
							</div>
						{/if}
						{#if selectedBond.prompt_b}
							<div class="text-center win-inset p-2">
								<div class="text-xs mb-1">{guestB?.nickname}</div>
								<div class="text-lg font-bold text-y2k-magenta">
									{getCategoryEmoji(selectedBond.prompt_b.category)} {selectedBond.prompt_b.word}
								</div>
							</div>
						{/if}
					</div>
				{:else if selectedBond.prompt}
					<!-- Legacy single prompt -->
					<div class="text-center win-inset p-3">
						<div class="text-2xl font-bold text-y2k-magenta">
							{getCategoryEmoji(selectedBond.prompt.category)} {selectedBond.prompt.word}
						</div>
						<div class="text-xs mt-1 uppercase">[{selectedBond.prompt.category}]</div>
					</div>
				{/if}
				{#if selectedBond.activity_prompt}
					<div class="text-center bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white p-2 mt-2 rounded">
						<div class="text-xs opacity-80">Activity:</div>
						<div class="font-bold">{selectedBond.activity_prompt.description}</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.confetti {
		position: absolute;
		width: 10px;
		height: 10px;
		top: -10px;
		animation: confetti-fall 3s linear forwards;
	}

	@keyframes confetti-fall {
		0% {
			transform: translateY(0) rotate(0deg);
			opacity: 1;
		}
		100% {
			transform: translateY(100vh) rotate(720deg);
			opacity: 0;
		}
	}
</style>
