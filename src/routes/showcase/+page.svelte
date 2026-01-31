<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { fade, scale, fly } from 'svelte/transition';
	import NetworkGraph from '$lib/components/NetworkGraph.svelte';
	import { getSupabase } from '$lib/supabase/client';
	import { activityEmoji } from '$lib/utils/activityEmojis';
	import type { RealtimeChannel } from '@supabase/supabase-js';

	type Guest = {
		id: string;
		nickname: string;
		photo_url: string;
		team_emoji: string | null;
	};

	type Bond = {
		id: string;
		guest_a_id: string;
		guest_b_id: string;
		status: string;
		photo_url: string | null;
		completed_at: string;
		remix_bond_id: string | null;
		phase_number: number;
		prompt: { word: string; category: string } | null;
		prompt_a: { word: string; category: string } | null;
		prompt_b: { word: string; category: string } | null;
		activity_prompt: { description: string; activity_category: string | null } | null;
		remix_source: { id: string; photo_url: string | null } | null;
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
		points: number;
		bondCount: number;
	};

	type Superlative = {
		id: string;
		emoji: string;
		title: string;
		description: string;
		winner: { nickname: string; photo_url: string | null };
		stat: string;
	};

	type ShowcaseView = 'network' | 'teams' | 'awards';

	let guests = $state<Guest[]>([]);
	let bonds = $state<Bond[]>([]);
	let stats = $state<Stats>({ totalGuests: 0, totalBonds: 0, maxPossibleBonds: 0, progress: 0 });
	let leaderboard = $state<LeaderboardEntry[]>([]);
	let selectedBond = $state<Bond | null>(null);
	let slideshowIndex = $state(0);
	let showConfetti = $state(false);
	let showGallery = $state(false);
	let announcementBond = $state<Bond | null>(null);
	let announcementQueue = $state<Bond[]>([]);
	let searchQuery = $state('');
	let highlightedGuestId = $state<string | null>(null);
	let currentView = $state<ShowcaseView>('network');
	let superlatives = $state<Superlative[]>([]);
	let awardIndex = $state(0);
	let awardDirection = $state<1 | -1>(1);
	let previousCompletedBondIds = $state<Set<string>>(new Set());
	let networkGraphRef: { fitAll: () => void } | undefined;

	let standbyMode = $state(false);

	let channel: RealtimeChannel | null = null;
	let standbyChannel: RealtimeChannel | null = null;
	let realtimeConnected = false;
	let slideshowInterval: ReturnType<typeof setInterval> | null = null;
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	let confettiTimeout: ReturnType<typeof setTimeout> | null = null;
	let announcementTimeout: ReturnType<typeof setTimeout> | null = null;
	let initialLoadDone = false;

	async function loadData() {
		try {
			const response = await fetch('/api/showcase');
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || 'Failed to load showcase data');
			}

			// Get current completed bonds
			const currentCompletedBonds = data.bonds.filter((b: Bond) => b.status === 'completed');
			const currentCompletedIds = new Set<string>(currentCompletedBonds.map((b: Bond) => b.id));

			// Detect NEW completed bonds (not seen before as completed)
			const newCompletedBonds = currentCompletedBonds.filter(
				(b: Bond) => !previousCompletedBondIds.has(b.id)
			);

			guests = data.guests;
			bonds = data.bonds;
			stats = data.stats;
			leaderboard = data.leaderboard;
			superlatives = data.superlatives || [];

			// Only trigger announcements after initial load is done
			// This prevents confetti spam when the showcase page is refreshed mid-party
			if (initialLoadDone && newCompletedBonds.length > 0) {
				triggerConfetti();
				queueAnnouncements(newCompletedBonds);
			}

			previousCompletedBondIds = currentCompletedIds;
			initialLoadDone = true;
		} catch (e) {
			console.error('Failed to load showcase data:', e);
		}
	}

	function triggerConfetti() {
		// Clear any existing timeout
		if (confettiTimeout) {
			clearTimeout(confettiTimeout);
		}
		showConfetti = true;
		// Play celebration sound
		try {
			new Audio('/sounds/meld-complete.wav').play();
		} catch {}
		confettiTimeout = setTimeout(() => {
			showConfetti = false;
			confettiTimeout = null;
		}, 3000);
	}

	function queueAnnouncements(bonds: Bond[]) {
		// Add new bonds to the queue
		announcementQueue = [...announcementQueue, ...bonds];
		// Start processing if not already showing one
		if (!announcementBond) {
			showNextAnnouncement();
		}
	}

	function showNextAnnouncement() {
		if (announcementQueue.length === 0) {
			announcementBond = null;
			return;
		}

		// Get next bond from queue
		const nextBond = announcementQueue[0];
		announcementQueue = announcementQueue.slice(1);
		announcementBond = nextBond;

		// Clear any existing timeout
		if (announcementTimeout) {
			clearTimeout(announcementTimeout);
		}

		// Show for 3 seconds, then show next (or clear)
		announcementTimeout = setTimeout(() => {
			announcementTimeout = null;
			showNextAnnouncement();
		}, 3000);
	}

	async function fetchStandby() {
		try {
			const res = await fetch('/api/standby');
			const data = await res.json();
			standbyMode = data.standby_mode;
		} catch (e) {
			console.error('Failed to fetch standby state:', e);
		}
	}

	function setupStandbyRealtime() {
		if (!browser) return;
		const supabase = getSupabase();
		if (!supabase) return;

		standbyChannel = supabase
			.channel('showcase-standby')
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'events' },
				() => {
					fetchStandby();
				}
			)
			.subscribe();
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
				(payload) => {
					console.log('Realtime bonds change:', payload);
					loadData();
				}
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'guests' },
				(payload) => {
					console.log('Realtime guests change:', payload);
					loadData();
				}
			)
			.subscribe((status, err) => {
				if (err) console.error('Realtime error:', err);

				if (status === 'SUBSCRIBED') {
					realtimeConnected = true;
					// Realtime working, stop fallback polling
					if (pollInterval) {
						clearInterval(pollInterval);
						pollInterval = null;
					}
				} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					realtimeConnected = false;
					console.warn('Showcase realtime failed, starting polling fallback');
					startPolling();
				} else if (status === 'CLOSED') {
					realtimeConnected = false;
				}
			});
	}

	function startPolling() {
		if (pollInterval) return; // Already polling
		pollInterval = setInterval(() => {
			loadData();
		}, 3000); // Poll every 3 seconds
	}

	function startSlideshow() {
		if (slideshowInterval) clearInterval(slideshowInterval);

		slideshowInterval = setInterval(() => {
			const photoBonds = bonds.filter((b) => b.photo_url);
			if (photoBonds.length > 0) {
				slideshowIndex = (slideshowIndex + 1) % photoBonds.length;
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
		fetchStandby();
		setupStandbyRealtime();
		if (browser) window.addEventListener('keydown', handleKeydown);
		// Polling disabled - realtime is working. Uncomment if needed as fallback:
		// startPolling();
	});

	onDestroy(() => {
		if (channel) {
			const supabase = getSupabase();
			if (supabase) supabase.removeChannel(channel);
		}
		if (standbyChannel) {
			const supabase = getSupabase();
			if (supabase) supabase.removeChannel(standbyChannel);
		}
		if (slideshowInterval) clearInterval(slideshowInterval);
		if (pollInterval) clearInterval(pollInterval);
		if (confettiTimeout) clearTimeout(confettiTimeout);
		if (announcementTimeout) clearTimeout(announcementTimeout);
		if (browser) window.removeEventListener('keydown', handleKeydown);
	});

	// Bonds with photos for slideshow and gallery
	let bondsWithPhotos = $derived(bonds.filter((b) => b.photo_url));

	// Slideshow bond
	let currentSlideshowBond = $derived.by(() => {
		return bondsWithPhotos[slideshowIndex] || null;
	});

	// Filtered guests for search
	let filteredGuests = $derived.by(() => {
		if (!searchQuery.trim()) return [];
		const query = searchQuery.toLowerCase();
		return guests.filter((g) => g.nickname.toLowerCase().includes(query)).slice(0, 5);
	});

	// Check if any teams exist
	let hasTeams = $derived(guests.some((g) => g.team_emoji));
	let hasAwards = $derived(superlatives.length > 0);

	function navigateAward(dir: 1 | -1) {
		if (superlatives.length === 0) return;
		awardDirection = dir;
		awardIndex = (awardIndex + dir + superlatives.length) % superlatives.length;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (currentView !== 'awards') return;
		if (e.key === 'ArrowRight') navigateAward(1);
		if (e.key === 'ArrowLeft') navigateAward(-1);
	}

	// Teams grouped by emoji
	type TeamData = { emoji: string; members: { id: string; nickname: string; photo_url: string; points: number }[]; totalPoints: number };
	let teams = $derived.by((): TeamData[] => {
		const teamMap = new Map<string, TeamData>();
		for (const g of guests) {
			if (!g.team_emoji) continue;
			if (!teamMap.has(g.team_emoji)) {
				teamMap.set(g.team_emoji, { emoji: g.team_emoji, members: [], totalPoints: 0 });
			}
			const entry = leaderboard.find((l) => l.id === g.id);
			const points = entry?.points ?? 0;
			const team = teamMap.get(g.team_emoji)!;
			team.members.push({ id: g.id, nickname: g.nickname, photo_url: g.photo_url, points });
			team.totalPoints += points;
		}
		return Array.from(teamMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);
	});
</script>

<svelte:head>
	<title>Cuauh's Mind Meld Imaginarium OS - Showcase</title>
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

<!-- New Meld Announcement - slides in from bottom -->
{#if announcementBond}
	{@const guestA = getGuestById(announcementBond.guest_a_id)}
	{@const guestB = getGuestById(announcementBond.guest_b_id)}
	<div
		class="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
		transition:fly={{ y: 100, duration: 400 }}
	>
		<div class="win-window px-8 py-4 shadow-2xl">
			<div class="win-titlebar mb-3">
				<span>NEW MELD!</span>
				{#if announcementQueue.length > 0}
					<span class="text-sm ml-2 opacity-70">+{announcementQueue.length} more</span>
				{/if}
			</div>
			<div class="flex items-center gap-6">
				<!-- Guest A -->
				<div class="text-center">
					<img
						src={guestA?.photo_url}
						alt={guestA?.nickname}
						class="w-24 h-24 object-cover win-inset p-1 bg-transparent mx-auto ring-4 ring-y2k-pink shadow-[0_0_15px_rgba(255,105,180,0.6)]"
					/>
					<div class="text-2xl font-bold mt-2 text-y2k-magenta font-['VT323']">
						{guestA?.nickname || '?'}
					</div>
				</div>
				<!-- Handshake -->
				<div class="text-5xl">🤝</div>
				<!-- Guest B -->
				<div class="text-center">
					<img
						src={guestB?.photo_url}
						alt={guestB?.nickname}
						class="w-24 h-24 object-cover win-inset p-1 bg-transparent mx-auto ring-4 ring-y2k-pink shadow-[0_0_15px_rgba(255,105,180,0.6)]"
					/>
					<div class="text-2xl font-bold mt-2 text-y2k-magenta font-['VT323']">
						{guestB?.nickname || '?'}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Main showcase layout - 16:9 optimized, no scrolling -->
<div class="h-screen p-3 flex flex-col overflow-hidden">
	<!-- Header - compact -->
	<div class="text-center mb-2 shrink-0 flex items-center justify-center gap-4">
		<img src="/gifs/party-2.gif" alt="" class="h-10" />
		<h1 class="text-4xl font-bold text-y2k-magenta font-['VT323'] tracking-wider drop-shadow-lg"
			style="text-shadow: 2px 2px 0 #FFD700, -1px -1px 0 #00D4AA;">
			CUAUH's MEGA MIND MELD IMAGINARIUM - LIVE
		</h1>
		<div class="flex gap-1">
			<button
				class="win-btn px-3 py-1 text-base"
				class:bg-gradient-to-r={currentView === 'network'}
				class:from-y2k-cyan={currentView === 'network'}
				class:to-y2k-pink={currentView === 'network'}
				class:text-white={currentView === 'network'}
				onclick={() => currentView = 'network'}
			>
				Network
			</button>
			{#if hasTeams}
				<button
					class="win-btn px-3 py-1 text-base"
					class:bg-gradient-to-r={currentView === 'teams'}
					class:from-y2k-cyan={currentView === 'teams'}
					class:to-y2k-pink={currentView === 'teams'}
					class:text-white={currentView === 'teams'}
					onclick={() => currentView = 'teams'}
				>
					Teams
				</button>
			{/if}
			{#if hasAwards}
				<button
					class="win-btn px-3 py-1 text-base"
					class:bg-gradient-to-r={currentView === 'awards'}
					class:from-y2k-cyan={currentView === 'awards'}
					class:to-y2k-pink={currentView === 'awards'}
					class:text-white={currentView === 'awards'}
					onclick={() => currentView = 'awards'}
				>
					Awards
				</button>
			{/if}
		</div>
	</div>

	<!-- Main content grid - fills remaining space -->
	{#if currentView === 'teams'}
		<!-- Teams View -->
		<div class="flex-1 min-h-0 overflow-y-auto p-2">
			<div class="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
				{#each teams as team}
					<div class="win-window flex flex-col">
						<div class="win-titlebar">
							<span class="text-xl">{team.emoji}</span>
							<span class="text-base font-bold ml-2">{team.totalPoints} pts</span>
						</div>
						<div class="p-2 space-y-1">
							{#each team.members as member}
								<div class="win-inset p-1 flex items-center gap-2">
									<img
										src={member.photo_url}
										alt={member.nickname}
										class="w-6 h-6 object-cover"
									/>
									<span class="flex-1 truncate text-base">{member.nickname}</span>
									<span class="text-sm font-bold text-y2k-magenta">{member.points}</span>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if currentView === 'awards'}
		<!-- Awards View -->
		<div class="flex-1 min-h-0 flex items-center justify-center relative p-4">
			{#if superlatives.length > 0}
				<!-- Left arrow -->
				<button
					class="absolute left-6 z-10 win-btn px-4 py-3 text-2xl"
					onclick={() => navigateAward(-1)}
					aria-label="Previous award"
				>&larr;</button>
				<!-- Right arrow -->
				<button
					class="absolute right-6 z-10 win-btn px-4 py-3 text-2xl"
					onclick={() => navigateAward(1)}
					aria-label="Next award"
				>&rarr;</button>

				<!-- Award card -->
				{#key superlatives[awardIndex]?.id}
					<div
						class="win-window max-w-md w-full"
						in:fly={{ x: awardDirection * 300, duration: 350 }}
						out:fly={{ x: awardDirection * -300, duration: 350 }}
					>
						<div class="win-titlebar">
							<span>Award Ceremony</span>
							<span class="text-sm opacity-70 ml-2">{awardIndex + 1} / {superlatives.length}</span>
						</div>
						<div class="p-8 flex flex-col items-center text-center space-y-4">
							<!-- Emoji -->
							<div class="text-7xl">{superlatives[awardIndex].emoji}</div>
							<!-- Title -->
							<h2
								class="text-3xl font-bold font-['VT323'] tracking-wide"
								style="background: linear-gradient(135deg, #FFD700, #FFA500); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"
							>
								{superlatives[awardIndex].title}
							</h2>
							<!-- Description -->
							<p class="text-base text-win-textDisabled">{superlatives[awardIndex].description}</p>
							<!-- Winner -->
							<div class="flex flex-col items-center gap-3">
								{#if superlatives[awardIndex].winner.photo_url}
									<img
										src={superlatives[awardIndex].winner.photo_url}
										alt={superlatives[awardIndex].winner.nickname}
										class="w-28 h-28 object-cover win-inset p-1 bg-transparent ring-4 ring-y2k-gold shadow-[0_0_20px_rgba(255,215,0,0.5)]"
									/>
								{:else}
									<!-- Team emoji as avatar -->
									<div class="w-28 h-28 win-inset bg-transparent flex items-center justify-center text-6xl">
										{superlatives[awardIndex].winner.nickname}
									</div>
								{/if}
								<div class="text-2xl font-bold text-y2k-magenta font-['VT323']">
									{superlatives[awardIndex].winner.nickname}
								</div>
							</div>
							<!-- Stat -->
							<div class="bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white px-6 py-2 rounded text-lg font-bold">
								{superlatives[awardIndex].stat}
							</div>
						</div>
					</div>
				{/key}

				<!-- Dot indicators -->
				<div class="absolute bottom-6 flex gap-2">
					{#each superlatives as _, i}
						<button
							class="w-3 h-3 rounded-full transition-all {i === awardIndex ? 'bg-y2k-magenta scale-125' : 'bg-win-borderLight'}"
							onclick={() => { awardDirection = i > awardIndex ? 1 : -1; awardIndex = i; }}
							aria-label="Go to award {i + 1}"
						></button>
					{/each}
				</div>
			{:else}
				<div class="text-center text-win-textDisabled">
					<div class="text-4xl mb-4">🏆</div>
					<div class="text-lg">No awards yet — start melding!</div>
				</div>
			{/if}
		</div>
	{:else}
	<div class="flex-1 grid grid-cols-12 gap-3 min-h-0">
		<!-- Network Graph - Main area -->
		<div class="col-span-8 win-window flex flex-col min-h-0">
			<div class="win-titlebar shrink-0 flex justify-between items-center">
				<span>Network.exe</span>
				<!-- Guest Search + Fit All -->
				<div class="relative flex items-center gap-2">
					<button
						class="win-btn px-2 py-0.5 text-sm"
						onclick={() => { networkGraphRef?.fitAll(); highlightedGuestId = null; }}
						title="Zoom to fit all"
					>Fit All</button>
					<div class="flex items-center gap-1">
						<input
							type="text"
							placeholder="Search guest..."
							bind:value={searchQuery}
							class="px-2 py-0.5 text-sm w-36 bg-white border border-win-borderDark text-win-text"
						/>
						{#if searchQuery}
							<button
								class="win-btn px-1 py-0 min-w-0 text-sm"
								onclick={() => { searchQuery = ''; highlightedGuestId = null; }}
							>X</button>
						{/if}
					</div>
					<!-- Search dropdown -->
					{#if filteredGuests.length > 0}
						<div class="absolute top-full right-0 mt-1 w-48 bg-win-bg border-2 border-win-borderLight shadow-lg z-50">
							{#each filteredGuests as guest}
								<button
									class="w-full px-2 py-1 text-left text-base hover:bg-y2k-pink hover:text-white flex items-center gap-2"
									onclick={() => { console.log('Selecting guest:', guest.id, guest.nickname); highlightedGuestId = guest.id; searchQuery = ''; }}
								>
									<img src={guest.photo_url} alt="" class="w-6 h-6 object-cover" />
									<span class="truncate">{guest.nickname}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
			<div class="flex-1 p-1 min-h-0">
				<NetworkGraph {guests} {bonds} {highlightedGuestId} onBondClick={handleBondClick} bind:this={networkGraphRef} />
			</div>
		</div>

		<!-- Right sidebar - fixed proportions -->
		<div class="col-span-4 flex flex-col gap-3 min-h-0">
			<!-- Stats - fixed height -->
			<div class="win-window shrink-0">
				<div class="win-titlebar">
					<span>Statistics</span>
				</div>
				<div class="p-2 space-y-1 text-base">
					<div class="flex justify-between">
						<span>Guests:</span>
						<span class="font-bold">{stats.totalGuests}</span>
					</div>
					<div class="flex justify-between">
						<span>Melds:</span>
						<span class="font-bold">{stats.totalBonds}</span>
					</div>
					<div class="mt-1">
						<div class="text-sm mb-1">Progress: {stats.totalBonds} out of {stats.maxPossibleBonds} Melds</div>
						<div class="win-inset h-5 relative overflow-hidden">
							<div
								class="absolute inset-0 bg-gradient-to-r from-y2k-pink to-y2k-magenta transition-all duration-500"
								style="width: {Math.min(stats.progress, 100)}%"
							></div>
							<div class="absolute inset-0 flex items-center justify-center text-sm font-bold text-win-text">
								{stats.progress.toFixed(1)}%
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Leaderboard - scrollable -->
			<div class="win-window shrink-0" style="height: 180px;">
				<div class="win-titlebar">
					<span><img src="/gifs/trophy-2.gif" alt="" class="h-5 inline-block mr-1" />Leaderboard</span>
				</div>
				<div class="p-2 h-[calc(100%-28px)] overflow-y-auto">
					{#if leaderboard.length === 0}
						<div class="text-center text-win-textDisabled py-4">
							No melds yet
						</div>
					{:else}
						<div class="space-y-1">
							{#each leaderboard as entry, i}
								<div class="win-inset p-1 flex items-center gap-2">
									<span class="w-6 text-center font-bold text-base">
										{#if i === 0}🥇{:else if i === 1}🥈{:else if i === 2}🥉{:else}{i + 1}{/if}
									</span>
									<img
										src={entry.photo_url}
										alt={entry.nickname}
										class="w-6 h-6 object-cover"
									/>
									<span class="flex-1 truncate text-base">{entry.nickname}</span>
									<span class="font-bold text-y2k-magenta text-base">{entry.points} pts</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Slideshow - takes remaining space, clickable to open gallery -->
			<button
				class="win-window flex-1 flex flex-col min-h-0 text-left cursor-pointer hover:shadow-lg transition-shadow"
				onclick={() => showGallery = true}
			>
				<div class="win-titlebar shrink-0">
					<span>Recent Melds</span>
					<span class="text-sm opacity-70 ml-2">({bondsWithPhotos.length} photos - click to view all)</span>
				</div>
				<div class="flex-1 p-2 min-h-0 overflow-hidden">
					{#if currentSlideshowBond}
						{@const guestA = getGuestById(currentSlideshowBond.guest_a_id)}
						{@const guestB = getGuestById(currentSlideshowBond.guest_b_id)}
						{#key currentSlideshowBond.id}
							<div class="win-inset p-2 h-full flex flex-col" transition:fade={{ duration: 400 }}>
								{#if currentSlideshowBond.photo_url}
									<div class="flex-1 min-h-0 mb-2">
										<img
											src={currentSlideshowBond.photo_url}
											alt="Bond"
											class="w-full h-full object-cover"
										/>
									</div>
								{/if}
								<div class="flex items-center justify-between text-base shrink-0">
									<span class="font-bold truncate">{guestA?.nickname || '?'}</span>
									<span>🤝</span>
									<span class="font-bold truncate">{guestB?.nickname || '?'}</span>
								</div>
								{#if currentSlideshowBond.remix_bond_id || (currentSlideshowBond.phase_number && currentSlideshowBond.phase_number >= 2)}
									<div class="text-center text-sm mt-1 shrink-0">
										<span class="bg-teal-500 text-white px-2 py-0.5 rounded font-bold">REMIX</span>
									</div>
								{:else if currentSlideshowBond.prompt_a || currentSlideshowBond.prompt_b}
									<div class="flex justify-between text-sm mt-1 text-y2k-magenta shrink-0">
										{#if currentSlideshowBond.prompt_a}
											<span class="truncate">{getCategoryEmoji(currentSlideshowBond.prompt_a.category)} {currentSlideshowBond.prompt_a.word}</span>
										{/if}
										{#if currentSlideshowBond.prompt_b}
											<span class="truncate">{getCategoryEmoji(currentSlideshowBond.prompt_b.category)} {currentSlideshowBond.prompt_b.word}</span>
										{/if}
									</div>
								{:else if currentSlideshowBond.prompt}
									<div class="text-center text-sm mt-1 text-y2k-magenta shrink-0">
										{getCategoryEmoji(currentSlideshowBond.prompt.category)}
										{currentSlideshowBond.prompt.word}
									</div>
								{/if}
							</div>
						{/key}
					{:else}
						<div class="win-inset p-4 text-center text-win-textDisabled h-full flex flex-col items-center justify-center">
							<div class="text-2xl mb-2">📸</div>
							<div class="text-base">Waiting for melds...</div>
						</div>
					{/if}
				</div>
			</button>
		</div>
	</div>
	{/if}
</div>

<!-- Gallery modal -->
{#if showGallery}
	<div
		class="fixed inset-0 bg-black/80 flex items-center justify-center z-40"
		onclick={() => showGallery = false}
		onkeydown={(e) => e.key === 'Escape' && (showGallery = false)}
		role="dialog"
		aria-modal="true"
		aria-label="Photo gallery"
		tabindex="-1"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="win-window w-[95vw] h-[90vh] flex flex-col"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
			role="presentation"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div class="win-titlebar shrink-0">
				<span>Meld Gallery - {bondsWithPhotos.length} Photos</span>
				<button class="win-btn px-2 py-0 min-w-0 text-sm" onclick={() => showGallery = false}>X</button>
			</div>
			<div class="flex-1 p-4 overflow-y-auto">
				{#if bondsWithPhotos.length === 0}
					<div class="h-full flex items-center justify-center text-win-textDisabled">
						<div class="text-center">
							<div class="text-4xl mb-4">📸</div>
							<div>No meld photos yet</div>
						</div>
					</div>
				{:else}
					<div class="grid grid-cols-6 gap-3">
						{#each bondsWithPhotos as bond}
							{@const guestA = getGuestById(bond.guest_a_id)}
							{@const guestB = getGuestById(bond.guest_b_id)}
							<button
								class="aspect-square win-inset p-1 cursor-pointer hover:ring-2 hover:ring-y2k-magenta transition-all group"
								onclick={(e) => { e.stopPropagation(); selectedBond = bond; showGallery = false; }}
							>
								<div class="relative w-full h-full">
									<img
										src={bond.photo_url}
										alt="Bond between {guestA?.nickname} and {guestB?.nickname}"
										class="w-full h-full object-cover"
									/>
									<!-- Overlay with names on hover -->
									<div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-sm p-1">
										<span class="truncate w-full text-center font-bold">{guestA?.nickname}</span>
										<span>🤝</span>
										<span class="truncate w-full text-center font-bold">{guestB?.nickname}</span>
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Bond detail modal -->
{#if selectedBond}
	{@const guestA = getGuestById(selectedBond.guest_a_id)}
	{@const guestB = getGuestById(selectedBond.guest_b_id)}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-40"
		onclick={() => selectedBond = null}
		onkeydown={(e) => e.key === 'Escape' && (selectedBond = null)}
		role="dialog"
		aria-modal="true"
		aria-label="Bond details"
		tabindex="-1"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="win-window max-w-lg w-full mx-4"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
			role="presentation"
			transition:scale={{ duration: 200, start: 0.9 }}
		>
			<div class="win-titlebar">
				<span>Meld Details</span>
				<button class="win-btn px-2 py-0 min-w-0 text-sm" onclick={() => selectedBond = null}>X</button>
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
						<img src={guestA?.photo_url} alt={guestA?.nickname} class="w-16 h-16 object-cover mx-auto win-inset p-1 bg-transparent" />
						<div class="font-bold mt-1">{guestA?.nickname}</div>
					</div>
					<div class="text-3xl">🤝</div>
					<div class="text-center">
						<img src={guestB?.photo_url} alt={guestB?.nickname} class="w-16 h-16 object-cover mx-auto win-inset p-1 bg-transparent" />
						<div class="font-bold mt-1">{guestB?.nickname}</div>
					</div>
				</div>
				{#if selectedBond.remix_bond_id || (selectedBond.phase_number && selectedBond.phase_number >= 2)}
					<div class="text-center bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-3 rounded space-y-2">
						{#if selectedBond.activity_prompt}
							<div class="text-lg font-bold">{selectedBond.activity_prompt.activity_category ? activityEmoji(selectedBond.activity_prompt.activity_category) + ' ' : ''}{selectedBond.activity_prompt.description}</div>
						{/if}
						{#if selectedBond.remix_source?.photo_url}
							<div class="text-base font-bold opacity-90">Remixed from:</div>
							<div class="mx-auto w-32 h-32 win-inset p-1 bg-white/20">
								<img
									src={selectedBond.remix_source.photo_url}
									alt="Source meld"
									class="w-full h-full object-cover"
								/>
							</div>
						{:else}
							<div class="text-base font-bold">
								<span class="bg-white/20 px-2 py-0.5 rounded">REMIX</span>
							</div>
						{/if}
					</div>
				{:else if selectedBond.activity_prompt}
					<div class="text-center bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white p-3 rounded space-y-2">
						<div class="text-lg font-bold">{selectedBond.activity_prompt.activity_category ? activityEmoji(selectedBond.activity_prompt.activity_category) + ' ' : ''}{selectedBond.activity_prompt.description}</div>
						{#if selectedBond.prompt_a && selectedBond.prompt_b}
							<div class="text-base opacity-90">
								Their words: <strong>{selectedBond.prompt_a.word}</strong> + <strong>{selectedBond.prompt_b.word}</strong>
							</div>
						{:else if selectedBond.prompt}
							<div class="text-base opacity-90">
								Prompt: <strong>{selectedBond.prompt.word}</strong>
							</div>
						{/if}
					</div>
				{:else if selectedBond.prompt_a && selectedBond.prompt_b}
					<div class="text-center bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white p-3 rounded">
						<div class="text-base">
							Their words: <strong>{selectedBond.prompt_a.word}</strong> + <strong>{selectedBond.prompt_b.word}</strong>
						</div>
					</div>
				{:else if selectedBond.prompt}
					<div class="text-center bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white p-3 rounded">
						<div class="text-base">
							Prompt: <strong>{selectedBond.prompt.word}</strong>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if standbyMode}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
		style="pointer-events: all;"
		transition:fade={{ duration: 300 }}
	>
		<div class="text-center px-8">
			<div class="text-8xl mb-6 animate-pulse">👀</div>
			<h1
				class="text-6xl font-bold font-['VT323'] tracking-wider text-white mb-4"
				style="text-shadow: 2px 2px 0 #FF69B4, -1px -1px 0 #00D4AA;"
			>
				Heads up!
			</h1>
			<p class="text-4xl text-white/80 font-['VT323']">Look around you</p>
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
