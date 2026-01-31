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
	let showTeams = $state(false);
	let previousCompletedBondIds = $state<Set<string>>(new Set());
	let networkGraphRef: { fitAll: () => void } | undefined;

	let channel: RealtimeChannel | null = null;
	let slideshowInterval: ReturnType<typeof setInterval> | null = null;
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let confettiTimeout: ReturnType<typeof setTimeout> | null = null;
	let announcementTimeout: ReturnType<typeof setTimeout> | null = null;

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

			console.log('loadData:', {
				totalBonds: data.bonds.length,
				completedBonds: currentCompletedBonds.length,
				previousCompletedSize: previousCompletedBondIds.size,
				newCompletedBonds: newCompletedBonds.length,
				willAnnounce: previousCompletedBondIds.size > 0 && newCompletedBonds.length > 0
			});

			guests = data.guests;
			bonds = data.bonds;
			stats = data.stats;
			leaderboard = data.leaderboard;

			// Trigger confetti and announcements for all new completed bonds
			if (previousCompletedBondIds.size > 0 && newCompletedBonds.length > 0) {
				console.log('Triggering announcements for:', newCompletedBonds.map((b: Bond) => b.id));
				triggerConfetti();
				// Queue all new bonds for announcement
				queueAnnouncements(newCompletedBonds);
			}

			previousCompletedBondIds = currentCompletedIds;
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
				console.log('Realtime subscription status:', status);
				if (err) console.error('Realtime error:', err);

				// If realtime fails, fall back to polling
				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					console.log('Realtime failed, starting polling fallback');
					startPolling();
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
		// Polling disabled - realtime is working. Uncomment if needed as fallback:
		// startPolling();
	});

	onDestroy(() => {
		if (channel) {
			const supabase = getSupabase();
			if (supabase) supabase.removeChannel(channel);
		}
		if (slideshowInterval) clearInterval(slideshowInterval);
		if (pollInterval) clearInterval(pollInterval);
		if (confettiTimeout) clearTimeout(confettiTimeout);
		if (announcementTimeout) clearTimeout(announcementTimeout);
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
					<span class="text-xs ml-2 opacity-70">+{announcementQueue.length} more</span>
				{/if}
			</div>
			<div class="flex items-center gap-6">
				<!-- Guest A -->
				<div class="text-center">
					<img
						src={guestA?.photo_url}
						alt={guestA?.nickname}
						class="w-24 h-24 object-cover win-inset p-1 mx-auto ring-4 ring-y2k-pink shadow-[0_0_15px_rgba(255,105,180,0.6)]"
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
						class="w-24 h-24 object-cover win-inset p-1 mx-auto ring-4 ring-y2k-pink shadow-[0_0_15px_rgba(255,105,180,0.6)]"
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
		<h1 class="text-3xl font-bold text-y2k-magenta font-['VT323'] tracking-wider drop-shadow-lg"
			style="text-shadow: 2px 2px 0 #FFD700, -1px -1px 0 #00D4AA;">
			MEGA MIND MELD IMAGINARIUM - LIVE
		</h1>
		{#if hasTeams}
			<button
				class="win-btn px-3 py-1 text-sm"
				class:bg-gradient-to-r={showTeams}
				class:from-y2k-cyan={showTeams}
				class:to-y2k-pink={showTeams}
				class:text-white={showTeams}
				onclick={() => showTeams = !showTeams}
			>
				{showTeams ? 'Network' : 'Teams'}
			</button>
		{/if}
	</div>

	<!-- Main content grid - fills remaining space -->
	{#if showTeams}
		<!-- Teams View -->
		<div class="flex-1 min-h-0 overflow-y-auto p-2">
			<div class="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
				{#each teams as team}
					<div class="win-window flex flex-col">
						<div class="win-titlebar">
							<span class="text-lg">{team.emoji}</span>
							<span class="text-sm font-bold ml-2">{team.totalPoints} pts</span>
						</div>
						<div class="p-2 space-y-1">
							{#each team.members as member}
								<div class="win-inset p-1 flex items-center gap-2">
									<img
										src={member.photo_url}
										alt={member.nickname}
										class="w-6 h-6 object-cover"
									/>
									<span class="flex-1 truncate text-sm">{member.nickname}</span>
									<span class="text-xs font-bold text-y2k-magenta">{member.points}</span>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
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
						class="win-btn px-2 py-0.5 text-xs"
						onclick={() => { networkGraphRef?.fitAll(); highlightedGuestId = null; }}
						title="Zoom to fit all"
					>Fit All</button>
					<div class="flex items-center gap-1">
						<input
							type="text"
							placeholder="Search guest..."
							bind:value={searchQuery}
							class="px-2 py-0.5 text-xs w-32 bg-white border border-win-borderDark text-win-text"
						/>
						{#if searchQuery}
							<button
								class="win-btn px-1 py-0 min-w-0 text-xs"
								onclick={() => { searchQuery = ''; highlightedGuestId = null; }}
							>X</button>
						{/if}
					</div>
					<!-- Search dropdown -->
					{#if filteredGuests.length > 0}
						<div class="absolute top-full right-0 mt-1 w-48 bg-win-bg border-2 border-win-borderLight shadow-lg z-50">
							{#each filteredGuests as guest}
								<button
									class="w-full px-2 py-1 text-left text-sm hover:bg-y2k-pink hover:text-white flex items-center gap-2"
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
				<div class="p-2 space-y-1 text-sm">
					<div class="flex justify-between">
						<span>Guests:</span>
						<span class="font-bold">{stats.totalGuests}</span>
					</div>
					<div class="flex justify-between">
						<span>Melds:</span>
						<span class="font-bold">{stats.totalBonds}</span>
					</div>
					<div class="mt-1">
						<div class="text-xs mb-1">Progress: {stats.totalBonds} out of {stats.maxPossibleBonds} Melds</div>
						<div class="win-inset h-5 relative overflow-hidden">
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
									<span class="w-5 text-center font-bold text-sm">
										{#if i === 0}🥇{:else if i === 1}🥈{:else if i === 2}🥉{:else}{i + 1}{/if}
									</span>
									<img
										src={entry.photo_url}
										alt={entry.nickname}
										class="w-5 h-5 object-cover"
									/>
									<span class="flex-1 truncate text-sm">{entry.nickname}</span>
									<span class="font-bold text-y2k-magenta text-sm">{entry.points} pts</span>
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
					<span class="text-xs opacity-70 ml-2">({bondsWithPhotos.length} photos - click to view all)</span>
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
								<div class="flex items-center justify-between text-sm shrink-0">
									<span class="font-bold truncate">{guestA?.nickname || '?'}</span>
									<span>🤝</span>
									<span class="font-bold truncate">{guestB?.nickname || '?'}</span>
								</div>
								{#if currentSlideshowBond.remix_bond_id || (currentSlideshowBond.phase_number && currentSlideshowBond.phase_number >= 2)}
									<div class="text-center text-xs mt-1 shrink-0">
										<span class="bg-teal-500 text-white px-2 py-0.5 rounded font-bold">REMIX</span>
									</div>
								{:else if currentSlideshowBond.prompt_a || currentSlideshowBond.prompt_b}
									<div class="flex justify-between text-xs mt-1 text-y2k-magenta shrink-0">
										{#if currentSlideshowBond.prompt_a}
											<span class="truncate">{getCategoryEmoji(currentSlideshowBond.prompt_a.category)} {currentSlideshowBond.prompt_a.word}</span>
										{/if}
										{#if currentSlideshowBond.prompt_b}
											<span class="truncate">{getCategoryEmoji(currentSlideshowBond.prompt_b.category)} {currentSlideshowBond.prompt_b.word}</span>
										{/if}
									</div>
								{:else if currentSlideshowBond.prompt}
									<div class="text-center text-xs mt-1 text-y2k-magenta shrink-0">
										{getCategoryEmoji(currentSlideshowBond.prompt.category)}
										{currentSlideshowBond.prompt.word}
									</div>
								{/if}
							</div>
						{/key}
					{:else}
						<div class="win-inset p-4 text-center text-win-textDisabled h-full flex flex-col items-center justify-center">
							<div class="text-2xl mb-2">📸</div>
							<div class="text-sm">Waiting for melds...</div>
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
				<button class="win-btn px-2 py-0 min-w-0 text-xs" onclick={() => showGallery = false}>X</button>
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
									<div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs p-1">
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
				{#if selectedBond.remix_bond_id || (selectedBond.phase_number && selectedBond.phase_number >= 2)}
					<div class="text-center bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-3 rounded space-y-2">
						{#if selectedBond.activity_prompt}
							<div class="text-base font-bold">{selectedBond.activity_prompt.activity_category ? activityEmoji(selectedBond.activity_prompt.activity_category) + ' ' : ''}{selectedBond.activity_prompt.description}</div>
						{/if}
						{#if selectedBond.remix_source?.photo_url}
							<div class="text-sm font-bold opacity-90">Remixed from:</div>
							<div class="mx-auto w-32 h-32 win-inset p-1 bg-white/20">
								<img
									src={selectedBond.remix_source.photo_url}
									alt="Source meld"
									class="w-full h-full object-cover"
								/>
							</div>
						{:else}
							<div class="text-sm font-bold">
								<span class="bg-white/20 px-2 py-0.5 rounded">REMIX</span>
							</div>
						{/if}
					</div>
				{:else if selectedBond.activity_prompt}
					<div class="text-center bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white p-3 rounded space-y-2">
						<div class="text-base font-bold">{selectedBond.activity_prompt.activity_category ? activityEmoji(selectedBond.activity_prompt.activity_category) + ' ' : ''}{selectedBond.activity_prompt.description}</div>
						{#if selectedBond.prompt_a && selectedBond.prompt_b}
							<div class="text-sm opacity-90">
								Their words: <strong>{selectedBond.prompt_a.word}</strong> + <strong>{selectedBond.prompt_b.word}</strong>
							</div>
						{:else if selectedBond.prompt}
							<div class="text-sm opacity-90">
								Prompt: <strong>{selectedBond.prompt.word}</strong>
							</div>
						{/if}
					</div>
				{:else if selectedBond.prompt_a && selectedBond.prompt_b}
					<div class="text-center bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white p-3 rounded">
						<div class="text-sm">
							Their words: <strong>{selectedBond.prompt_a.word}</strong> + <strong>{selectedBond.prompt_b.word}</strong>
						</div>
					</div>
				{:else if selectedBond.prompt}
					<div class="text-center bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white p-3 rounded">
						<div class="text-sm">
							Prompt: <strong>{selectedBond.prompt.word}</strong>
						</div>
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
