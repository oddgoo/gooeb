<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	type Guest = {
		id: string;
		nickname: string;
		photo_url: string;
		is_admin: boolean;
		team_emoji: string | null;
		created_at: string;
		mask_codes: { code: string } | null;
	};

	type Bond = {
		id: string;
		status: string;
		photo_url: string | null;
		initiated_at: string;
		guest_a: { id: string; nickname: string; photo_url: string };
		guest_b: { id: string; nickname: string; photo_url: string };
		prompt: { word: string; category: string } | null;
	};

	type Prompt = {
		id: string;
		word: string;
		category: string;
		is_active: boolean;
		times_used: number;
	};

	type Phase = {
		id: string;
		event_id: string;
		phase_number: number;
		name: string;
	};

	type ActivityPrompt = {
		id: string;
		description: string;
		is_active: boolean;
		times_used: number;
		phase_numbers: number[];
		activity_category: string;
	};

	let pageData = $derived($page.data as { guest: { id: string; nickname: string }; eventId: string | null });

	let activeTab = $state<'guests' | 'bonds' | 'prompts' | 'phases' | 'activities' | 'teams' | 'points'>('guests');
	let guests = $state<Guest[]>([]);
	let bonds = $state<Bond[]>([]);
	let prompts = $state<Prompt[]>([]);
	let phases = $state<Phase[]>([]);
	let currentPhaseId = $state<string | null>(null);
	let activityPrompts = $state<ActivityPrompt[]>([]);
	let loading = $state(false);
	let error = $state('');

	// New prompt form
	let newPromptWord = $state('');
	let newPromptCategory = $state<'character' | 'theme' | 'place'>('character');

	// New activity prompt form
	let newActivityDescription = $state('');
	let newActivityCategory = $state('general');
	let newActivityPhases = $state<number[]>([1]);

	const activityCategories = ['general', 'drawing', 'acting', 'photo', 'music', 'physical'];

	// Teams
	let teamSize = $state(4);
	let currentTeams = $state<{ emoji: string; members: string[] }[]>([]);
	let teamsLoading = $state(false);

	// Points ledger
	type LedgerDisplayEntry = {
		id: string;
		guest_id: string;
		points: number;
		reason: string;
		created_at: string;
		guest: { nickname: string } | null;
	};
	let ledgerEntries = $state<LedgerDisplayEntry[]>([]);
	let selectedGuestId = $state('');
	let pointsReason = $state('');

	// Bulk upload
	let bulkCsvFile = $state<File | null>(null);
	let bulkPhotoFiles = $state<FileList | null>(null);
	let bulkUploading = $state(false);
	let bulkResult = $state<{ created: number; skipped: number; errors: string[] } | null>(null);

	async function loadGuests() {
		loading = true;
		try {
			const res = await fetch('/api/admin/guests');
			const data = await res.json();
			guests = data.guests;
		} catch (e) {
			error = 'Failed to load guests';
		} finally {
			loading = false;
		}
	}

	async function loadBonds() {
		loading = true;
		try {
			const res = await fetch('/api/admin/bonds');
			const data = await res.json();
			bonds = data.bonds;
		} catch (e) {
			error = 'Failed to load melds';
		} finally {
			loading = false;
		}
	}

	async function loadPrompts() {
		loading = true;
		try {
			const res = await fetch('/api/admin/prompts');
			const data = await res.json();
			prompts = data.prompts;
		} catch (e) {
			error = 'Failed to load prompts';
		} finally {
			loading = false;
		}
	}

	async function loadPhases() {
		loading = true;
		try {
			const res = await fetch('/api/admin/phases');
			const data = await res.json();
			phases = data.phases;
			currentPhaseId = data.currentPhaseId;
		} catch (e) {
			error = 'Failed to load phases';
		} finally {
			loading = false;
		}
	}

	async function loadActivityPrompts() {
		loading = true;
		try {
			// Load phases first (needed for the checkboxes)
			const phasesRes = await fetch('/api/admin/phases');
			const phasesData = await phasesRes.json();
			phases = phasesData.phases;
			currentPhaseId = phasesData.currentPhaseId;

			// Then load activity prompts
			const res = await fetch('/api/admin/activity-prompts');
			const data = await res.json();
			activityPrompts = data.activityPrompts;
		} catch (e) {
			error = 'Failed to load activity prompts';
		} finally {
			loading = false;
		}
	}

	async function deleteGuest(guestId: string) {
		if (!confirm('Delete this guest and all their melds?')) return;

		try {
			await fetch('/api/admin/guests', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ guestId })
			});
			loadGuests();
		} catch (e) {
			error = 'Failed to delete guest';
		}
	}

	async function deleteBond(bondId: string) {
		if (!confirm('Delete this meld?')) return;

		try {
			await fetch('/api/admin/bonds', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bondId })
			});
			loadBonds();
		} catch (e) {
			error = 'Failed to delete meld';
		}
	}

	async function togglePrompt(promptId: string, isActive: boolean) {
		try {
			await fetch('/api/admin/prompts', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ promptId, isActive: !isActive })
			});
			loadPrompts();
		} catch (e) {
			error = 'Failed to update prompt';
		}
	}

	async function deletePrompt(promptId: string) {
		if (!confirm('Delete this prompt?')) return;

		try {
			await fetch('/api/admin/prompts', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ promptId })
			});
			loadPrompts();
		} catch (e) {
			error = 'Failed to delete prompt';
		}
	}

	async function addPrompt() {
		if (!newPromptWord.trim() || !pageData.eventId) return;

		try {
			await fetch('/api/admin/prompts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					word: newPromptWord.trim(),
					category: newPromptCategory,
					eventId: pageData.eventId
				})
			});
			newPromptWord = '';
			loadPrompts();
		} catch (e) {
			error = 'Failed to add prompt';
		}
	}

	async function setCurrentPhase(phaseId: string | null) {
		if (!pageData.eventId) return;

		try {
			await fetch('/api/admin/phases', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					phaseId,
					eventId: pageData.eventId
				})
			});
			currentPhaseId = phaseId;
		} catch (e) {
			error = 'Failed to update phase';
		}
	}

	async function addActivityPrompt() {
		if (!newActivityDescription.trim() || !pageData.eventId) return;

		try {
			await fetch('/api/admin/activity-prompts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					description: newActivityDescription.trim(),
					phaseNumbers: newActivityPhases,
					activityCategory: newActivityCategory,
					eventId: pageData.eventId
				})
			});
			newActivityDescription = '';
			newActivityPhases = [1];
			newActivityCategory = 'general';
			loadActivityPrompts();
		} catch (e) {
			error = 'Failed to add activity prompt';
		}
	}

	async function toggleActivityPrompt(activityPromptId: string, isActive: boolean) {
		try {
			await fetch('/api/admin/activity-prompts', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ activityPromptId, isActive: !isActive })
			});
			loadActivityPrompts();
		} catch (e) {
			error = 'Failed to update activity prompt';
		}
	}

	async function updateActivityPromptPhases(activityPromptId: string, phaseNumbers: number[]) {
		try {
			await fetch('/api/admin/activity-prompts', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ activityPromptId, phaseNumbers })
			});
			loadActivityPrompts();
		} catch (e) {
			error = 'Failed to update activity prompt phases';
		}
	}

	async function deleteActivityPrompt(activityPromptId: string) {
		if (!confirm('Delete this activity prompt?')) return;

		try {
			await fetch('/api/admin/activity-prompts', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ activityPromptId })
			});
			loadActivityPrompts();
		} catch (e) {
			error = 'Failed to delete activity prompt';
		}
	}

	async function loadTeams() {
		teamsLoading = true;
		try {
			const res = await fetch('/api/admin/guests');
			const data = await res.json();
			const guestsWithTeams = (data.guests || []) as Guest[];
			// Group by team_emoji
			const teamMap = new Map<string, string[]>();
			for (const g of guestsWithTeams) {
				const emoji = (g as any).team_emoji;
				if (emoji) {
					if (!teamMap.has(emoji)) teamMap.set(emoji, []);
					teamMap.get(emoji)!.push(g.nickname);
				}
			}
			currentTeams = Array.from(teamMap.entries()).map(([emoji, members]) => ({ emoji, members }));
		} catch (e) {
			error = 'Failed to load teams';
		} finally {
			teamsLoading = false;
		}
	}

	async function generateTeams() {
		teamsLoading = true;
		error = '';
		try {
			const res = await fetch('/api/admin/teams', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ teamSize })
			});
			if (!res.ok) {
				let msg = 'Failed to generate teams';
				try {
					const data = await res.json();
					msg = data.message || msg;
				} catch {}
				throw new Error(msg);
			}
			const data = await res.json();
			currentTeams = data.teams;
		} catch (e) {
			console.error('Generate teams error:', e);
			error = e instanceof Error ? e.message : 'Failed to generate teams';
		} finally {
			teamsLoading = false;
		}
	}

	async function clearTeams() {
		if (!confirm('Clear all team assignments?')) return;
		teamsLoading = true;
		try {
			await fetch('/api/admin/teams', { method: 'DELETE' });
			currentTeams = [];
		} catch (e) {
			error = 'Failed to clear teams';
		} finally {
			teamsLoading = false;
		}
	}

	async function bulkUpload() {
		if (!bulkCsvFile) return;
		bulkUploading = true;
		bulkResult = null;
		error = '';

		try {
			const formData = new FormData();
			formData.append('csv', bulkCsvFile);
			if (bulkPhotoFiles) {
				for (const file of bulkPhotoFiles) {
					formData.append('photos', file);
				}
			}

			const res = await fetch('/api/admin/guests/bulk', {
				method: 'POST',
				body: formData
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.message || 'Bulk upload failed');
			}
			bulkResult = data;
			loadGuests();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Bulk upload failed';
		} finally {
			bulkUploading = false;
		}
	}

	async function loadPoints() {
		loading = true;
		try {
			// Load guests too (for the dropdown)
			const guestsRes = await fetch('/api/admin/guests');
			const guestsData = await guestsRes.json();
			guests = guestsData.guests;

			const res = await fetch('/api/admin/points');
			const data = await res.json();
			ledgerEntries = data.entries;
		} catch (e) {
			error = 'Failed to load points';
		} finally {
			loading = false;
		}
	}

	async function addPoints(amount: number) {
		if (!selectedGuestId) return;

		try {
			await fetch('/api/admin/points', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					guest_id: selectedGuestId,
					points: amount,
					reason: pointsReason.trim()
				})
			});
			pointsReason = '';
			loadPoints();
		} catch (e) {
			error = 'Failed to add points';
		}
	}

	async function deleteLedgerEntry(entryId: string) {
		if (!confirm('Delete this points entry?')) return;

		try {
			await fetch('/api/admin/points', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entryId })
			});
			loadPoints();
		} catch (e) {
			error = 'Failed to delete points entry';
		}
	}

	function getCategoryEmoji(category: string): string {
		switch (category) {
			case 'character': return '👤';
			case 'theme': return '💭';
			case 'place': return '📍';
			default: return '✨';
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'pending': return 'bg-yellow-100';
			case 'accepted': return 'bg-blue-100';
			case 'completed': return 'bg-green-100';
			case 'rejected': return 'bg-red-100';
			default: return 'bg-gray-100';
		}
	}

	onMount(() => {
		loadGuests();
	});

	// Load data when tab changes
	$effect(() => {
		if (activeTab === 'guests') loadGuests();
		else if (activeTab === 'bonds') loadBonds();
		else if (activeTab === 'prompts') loadPrompts();
		else if (activeTab === 'phases') loadPhases();
		else if (activeTab === 'activities') loadActivityPrompts();
		else if (activeTab === 'teams') loadTeams();
		else if (activeTab === 'points') loadPoints();
	});
</script>

<div class="p-2 max-w-4xl mx-auto min-h-screen">
	<div class="win-window">
		<div class="win-titlebar">
			<span>Admin Panel - {pageData.guest.nickname}</span>
			<div class="flex gap-1">
				<a href="/bond" class="win-btn px-2 py-0 min-w-0 text-xs">X</a>
			</div>
		</div>

		<!-- Tabs -->
		<div class="bg-win-bg px-2 py-1 border-b border-win-btnShadow flex gap-1 flex-wrap">
			<button
				class="win-btn px-3 py-1 text-sm"
				class:bg-white={activeTab === 'guests'}
				onclick={() => activeTab = 'guests'}
			>
				Guests
			</button>
			<button
				class="win-btn px-3 py-1 text-sm"
				class:bg-white={activeTab === 'bonds'}
				onclick={() => activeTab = 'bonds'}
			>
				Melds
			</button>
			<button
				class="win-btn px-3 py-1 text-sm"
				class:bg-white={activeTab === 'prompts'}
				onclick={() => activeTab = 'prompts'}
			>
				Prompts
			</button>
			<button
				class="win-btn px-3 py-1 text-sm"
				class:bg-white={activeTab === 'phases'}
				onclick={() => activeTab = 'phases'}
			>
				Phases
			</button>
			<button
				class="win-btn px-3 py-1 text-sm"
				class:bg-white={activeTab === 'activities'}
				onclick={() => activeTab = 'activities'}
			>
				Activities
			</button>
			<button
				class="win-btn px-3 py-1 text-sm"
				class:bg-white={activeTab === 'teams'}
				onclick={() => activeTab = 'teams'}
			>
				Teams
			</button>
			<button
				class="win-btn px-3 py-1 text-sm"
				class:bg-white={activeTab === 'points'}
				onclick={() => activeTab = 'points'}
			>
				Points
			</button>
		</div>

		<div class="p-3">
			{#if error}
				<div class="win-inset p-2 bg-red-100 text-red-800 text-sm mb-3">
					{error}
					<button onclick={() => error = ''} class="ml-2 underline">dismiss</button>
				</div>
			{/if}

			{#if loading}
				<div class="text-center py-8 text-win-textDisabled">Loading...</div>
			{:else if activeTab === 'guests'}
				<!-- Guests Tab -->
				<div class="win-groupbox">
					<span class="win-groupbox-label">Guests ({guests.length})</span>
					<div class="win-inset p-2 max-h-[60vh] overflow-y-auto">
						{#if guests.length === 0}
							<div class="text-center py-4 text-win-textDisabled">No guests yet</div>
						{:else}
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-win-btnShadow">
										<th class="text-left p-1">Photo</th>
										<th class="text-left p-1">Nickname</th>
										<th class="text-left p-1">Code</th>
										<th class="text-left p-1">Admin</th>
										<th class="text-left p-1">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each guests as guest}
										<tr class="border-b border-win-btnHighlight">
											<td class="p-1">
												<img src={guest.photo_url} alt={guest.nickname} class="w-8 h-8 object-cover" />
											</td>
											<td class="p-1 font-bold">{guest.nickname}</td>
											<td class="p-1 font-mono">{guest.mask_codes?.code || '-'}</td>
											<td class="p-1">{guest.is_admin ? '✓' : ''}</td>
											<td class="p-1">
												<button
													onclick={() => deleteGuest(guest.id)}
													class="win-btn px-2 py-0 text-xs"
													disabled={guest.id === pageData.guest.id}
												>
													Delete
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
				</div>

				<!-- Bulk Upload -->
				<div class="win-groupbox mt-3">
					<span class="win-groupbox-label">Bulk Upload Guests</span>
					<div class="space-y-2 p-1">
						<div>
							<label class="text-sm block mb-1">CSV file (columns: code, nickname, intro_text)</label>
							<input
								type="file"
								accept=".csv"
								onchange={(e) => {
									const target = e.target as HTMLInputElement;
									bulkCsvFile = target.files?.[0] || null;
								}}
								class="win-input w-full text-sm"
							/>
						</div>
						<div>
							<label class="text-sm block mb-1">Photo files (named {'{nickname}.png'})</label>
							<input
								type="file"
								accept="image/*"
								multiple
								onchange={(e) => {
									const target = e.target as HTMLInputElement;
									bulkPhotoFiles = target.files;
								}}
								class="win-input w-full text-sm"
							/>
						</div>
						<button
							onclick={bulkUpload}
							disabled={!bulkCsvFile || bulkUploading}
							class="win-btn px-4 py-1"
						>
							{bulkUploading ? 'Uploading...' : 'Bulk Upload'}
						</button>

						{#if bulkResult}
							<div class="win-inset p-2 text-sm">
								<div class="text-green-700">Created: {bulkResult.created}</div>
								<div class="text-yellow-700">Skipped: {bulkResult.skipped}</div>
								{#if bulkResult.errors.length > 0}
									<div class="text-red-700 mt-1">
										Errors:
										{#each bulkResult.errors as err}
											<div class="ml-2">- {err}</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>

			{:else if activeTab === 'bonds'}
				<!-- Melds Tab -->
				<div class="win-groupbox">
					<span class="win-groupbox-label">Melds ({bonds.length})</span>
					<div class="win-inset p-2 max-h-[60vh] overflow-y-auto">
						{#if bonds.length === 0}
							<div class="text-center py-4 text-win-textDisabled">No melds yet</div>
						{:else}
							<div class="space-y-2">
								{#each bonds as bond}
									<div class="win-inset p-2 flex items-center gap-2 {getStatusColor(bond.status)}">
										<img src={bond.guest_a.photo_url} alt="" class="w-8 h-8 object-cover" />
										<span class="font-bold">{bond.guest_a.nickname}</span>
										<span>↔</span>
										<span class="font-bold">{bond.guest_b.nickname}</span>
										<img src={bond.guest_b.photo_url} alt="" class="w-8 h-8 object-cover" />
										<span class="flex-1"></span>
										{#if bond.prompt}
											<span class="text-xs">
												{getCategoryEmoji(bond.prompt.category)} {bond.prompt.word}
											</span>
										{/if}
										<span class="text-xs uppercase px-2 py-0.5 bg-white rounded">
											{bond.status}
										</span>
										<button
											onclick={() => deleteBond(bond.id)}
											class="win-btn px-2 py-0 text-xs"
										>
											Delete
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

			{:else if activeTab === 'prompts'}
				<!-- Prompts Tab -->
				<div class="space-y-3">
					<!-- Add Prompt Form -->
					<div class="win-groupbox">
						<span class="win-groupbox-label">Add Prompt</span>
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={newPromptWord}
								placeholder="Word..."
								class="win-input flex-1"
							/>
							<select bind:value={newPromptCategory} class="win-input">
								<option value="character">👤 Character</option>
								<option value="theme">💭 Theme</option>
								<option value="place">📍 Place</option>
							</select>
							<button onclick={addPrompt} class="win-btn px-4" disabled={!newPromptWord.trim()}>
								Add
							</button>
						</div>
					</div>

					<!-- Prompts List -->
					{#each ['character', 'theme', 'place'] as category}
						{@const categoryPrompts = prompts.filter(p => p.category === category)}
						<div class="win-groupbox">
							<span class="win-groupbox-label">
								{getCategoryEmoji(category)} {category.charAt(0).toUpperCase() + category.slice(1)} ({categoryPrompts.length})
							</span>
							<div class="win-inset p-2 max-h-40 overflow-y-auto">
								{#if categoryPrompts.length === 0}
									<div class="text-center py-2 text-win-textDisabled text-sm">No prompts</div>
								{:else}
									<div class="flex flex-wrap gap-1">
										{#each categoryPrompts as prompt}
											<div
												class="inline-flex items-center gap-1 px-2 py-1 text-sm rounded"
												class:bg-white={prompt.is_active}
												class:bg-gray-300={!prompt.is_active}
												class:opacity-50={!prompt.is_active}
											>
												<span>{prompt.word}</span>
												<span class="text-xs text-win-textDisabled">({prompt.times_used})</span>
												<button
													onclick={() => togglePrompt(prompt.id, prompt.is_active)}
													class="ml-1 text-xs hover:underline"
												>
													{prompt.is_active ? 'disable' : 'enable'}
												</button>
												<button
													onclick={() => deletePrompt(prompt.id)}
													class="text-xs text-red-600 hover:underline"
												>
													x
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>

			{:else if activeTab === 'phases'}
				<!-- Phases Tab -->
				<div class="space-y-3">
					<!-- Current Phase Selector -->
					<div class="win-groupbox">
						<span class="win-groupbox-label">Current Phase</span>
						<div class="flex gap-2 flex-wrap">
							{#each phases as phase}
								<button
									onclick={() => setCurrentPhase(phase.id)}
									class="win-btn px-4 py-2"
									class:bg-gradient-to-r={currentPhaseId === phase.id}
									class:from-y2k-cyan={currentPhaseId === phase.id}
									class:to-y2k-pink={currentPhaseId === phase.id}
									class:text-white={currentPhaseId === phase.id}
								>
									{phase.phase_number}. {phase.name}
									{#if currentPhaseId === phase.id}
										<span class="ml-1">✓</span>
									{/if}
								</button>
							{/each}
						</div>
						{#if phases.length === 0}
							<div class="text-center py-4 text-win-textDisabled">No phases configured</div>
						{/if}
					</div>

					<!-- Phases List -->
					<div class="win-groupbox">
						<span class="win-groupbox-label">All Phases ({phases.length})</span>
						<div class="win-inset p-2">
							{#if phases.length === 0}
								<div class="text-center py-4 text-win-textDisabled">No phases yet</div>
							{:else}
								<table class="w-full text-sm">
									<thead>
										<tr class="border-b border-win-btnShadow">
											<th class="text-left p-1">#</th>
											<th class="text-left p-1">Name</th>
											<th class="text-left p-1">Status</th>
										</tr>
									</thead>
									<tbody>
										{#each phases as phase}
											<tr class="border-b border-win-btnHighlight">
												<td class="p-1 font-mono">{phase.phase_number}</td>
												<td class="p-1 font-bold">{phase.name}</td>
												<td class="p-1">
													{#if currentPhaseId === phase.id}
														<span class="text-green-600 font-bold">ACTIVE</span>
													{:else}
														<span class="text-win-textDisabled">-</span>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						</div>
					</div>
				</div>

			{:else if activeTab === 'activities'}
				<!-- Activity Prompts Tab -->
				<div class="space-y-3">
					<!-- Add Activity Prompt Form -->
					<div class="win-groupbox">
						<span class="win-groupbox-label">Add Activity Prompt</span>
						<div class="space-y-2">
							<input
								type="text"
								bind:value={newActivityDescription}
								placeholder="Activity description..."
								class="win-input w-full"
							/>
							<div class="flex gap-2 flex-wrap items-center">
								<label class="text-sm">Category:</label>
								<select bind:value={newActivityCategory} class="win-input">
									{#each activityCategories as cat}
										<option value={cat}>{cat}</option>
									{/each}
								</select>
								<label class="text-sm ml-2">Phases:</label>
								{#each phases as phase}
									<label class="inline-flex items-center gap-1 text-sm">
										<input
											type="checkbox"
											checked={newActivityPhases.includes(phase.phase_number)}
											onchange={(e) => {
												const target = e.target as HTMLInputElement;
												if (target.checked) {
													newActivityPhases = [...newActivityPhases, phase.phase_number];
												} else {
													newActivityPhases = newActivityPhases.filter(p => p !== phase.phase_number);
												}
											}}
										/>
										{phase.phase_number}
									</label>
								{/each}
								<button onclick={addActivityPrompt} class="win-btn px-4 ml-auto" disabled={!newActivityDescription.trim()}>
									Add
								</button>
							</div>
						</div>
					</div>

					<!-- Activity Prompts List -->
					<div class="win-groupbox">
						<span class="win-groupbox-label">Activity Prompts ({activityPrompts.length})</span>
						<div class="win-inset p-2 max-h-[50vh] overflow-y-auto">
							{#if activityPrompts.length === 0}
								<div class="text-center py-4 text-win-textDisabled">No activity prompts yet</div>
							{:else}
								<div class="space-y-2">
									{#each activityPrompts as activity}
										<div
											class="win-inset p-2"
											class:bg-white={activity.is_active}
											class:bg-gray-200={!activity.is_active}
											class:opacity-50={!activity.is_active}
										>
											<div class="flex items-start gap-2">
												<div class="flex-1">
													<div class="font-bold text-sm">{activity.description}</div>
													<div class="text-xs text-win-textDisabled mt-1 flex gap-2 flex-wrap">
														<span class="bg-win-bg px-1 rounded">{activity.activity_category}</span>
														<span>Phases: {activity.phase_numbers?.join(', ') || '1'}</span>
														<span>Used: {activity.times_used}x</span>
													</div>
												</div>
												<div class="flex gap-1">
													<button
														onclick={() => toggleActivityPrompt(activity.id, activity.is_active)}
														class="win-btn px-2 py-0 text-xs"
													>
														{activity.is_active ? 'disable' : 'enable'}
													</button>
													<button
														onclick={() => deleteActivityPrompt(activity.id)}
														class="win-btn px-2 py-0 text-xs text-red-600"
													>
														x
													</button>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{:else if activeTab === 'points'}
				<!-- Points Tab -->
				<div class="space-y-3">
					<div class="win-groupbox">
						<span class="win-groupbox-label">Add Points</span>
						<div class="space-y-2">
							<select bind:value={selectedGuestId} class="win-input w-full">
								<option value="">Select guest...</option>
								{#each guests as guest}
									<option value={guest.id}>{guest.nickname}</option>
								{/each}
							</select>
							<input
								type="text"
								bind:value={pointsReason}
								placeholder="Reason (optional)"
								class="win-input w-full"
							/>
							<div class="flex gap-2 flex-wrap">
								<button onclick={() => addPoints(-10)} class="win-btn px-3 py-1" disabled={!selectedGuestId}>-10</button>
								<button onclick={() => addPoints(-1)} class="win-btn px-3 py-1" disabled={!selectedGuestId}>-1</button>
								<button onclick={() => addPoints(1)} class="win-btn px-3 py-1" disabled={!selectedGuestId}>+1</button>
								<button onclick={() => addPoints(10)} class="win-btn px-3 py-1" disabled={!selectedGuestId}>+10</button>
							</div>
						</div>
					</div>

					<div class="win-groupbox">
						<span class="win-groupbox-label">Points History ({ledgerEntries.length})</span>
						<div class="win-inset p-2 max-h-[50vh] overflow-y-auto">
							{#if ledgerEntries.length === 0}
								<div class="text-center py-4 text-win-textDisabled">No point adjustments yet</div>
							{:else}
								<table class="w-full text-sm">
									<thead>
										<tr class="border-b border-win-btnShadow">
											<th class="text-left p-1">Guest</th>
											<th class="text-left p-1">Points</th>
											<th class="text-left p-1">Reason</th>
											<th class="text-left p-1">Time</th>
											<th class="text-left p-1">Actions</th>
										</tr>
									</thead>
									<tbody>
										{#each ledgerEntries as entry}
											<tr class="border-b border-win-btnHighlight">
												<td class="p-1 font-bold">{entry.guest?.nickname || '?'}</td>
												<td class="p-1 font-mono {entry.points > 0 ? 'text-green-700' : 'text-red-700'}">
													{entry.points > 0 ? '+' : ''}{entry.points}
												</td>
												<td class="p-1 text-win-textDisabled">{entry.reason || '-'}</td>
												<td class="p-1 text-xs text-win-textDisabled">
													{new Date(entry.created_at).toLocaleString()}
												</td>
												<td class="p-1">
													<button
														onclick={() => deleteLedgerEntry(entry.id)}
														class="win-btn px-2 py-0 text-xs"
													>
														Delete
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						</div>
					</div>
				</div>

			{:else if activeTab === 'teams'}
				<!-- Teams Tab -->
				<div class="space-y-3">
					<div class="win-groupbox">
						<span class="win-groupbox-label">Generate Teams</span>
						<div class="flex gap-2 items-center flex-wrap">
							<label class="text-sm">Team size:</label>
							<input
								type="number"
								bind:value={teamSize}
								min="2"
								max="20"
								class="win-input w-20 text-center"
							/>
							<button
								onclick={generateTeams}
								class="win-btn px-4"
								disabled={teamsLoading}
							>
								{teamsLoading ? 'Generating...' : 'Generate Teams'}
							</button>
							<button
								onclick={clearTeams}
								class="win-btn px-4"
								disabled={teamsLoading || currentTeams.length === 0}
							>
								Clear Teams
							</button>
						</div>
					</div>

					<div class="win-groupbox">
						<span class="win-groupbox-label">Current Teams ({currentTeams.length})</span>
						<div class="win-inset p-2 max-h-[50vh] overflow-y-auto">
							{#if currentTeams.length === 0}
								<div class="text-center py-4 text-win-textDisabled">No teams assigned</div>
							{:else}
								<div class="grid grid-cols-2 gap-2">
									{#each currentTeams as team}
										<div class="win-inset p-2">
											<div class="text-2xl text-center mb-1">{team.emoji}</div>
											<div class="space-y-0.5">
												{#each team.members as member}
													<div class="text-sm text-center">{member}</div>
												{/each}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Status Bar -->
		<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm flex">
			<div class="win-inset px-2 flex-1">
				{#if activeTab === 'guests'}
					{guests.length} guests registered
				{:else if activeTab === 'bonds'}
					{bonds.length} melds total
				{:else if activeTab === 'prompts'}
					{prompts.length} prompts configured
				{:else if activeTab === 'phases'}
					{phases.length} phases | Current: {phases.find(p => p.id === currentPhaseId)?.name || 'None'}
				{:else if activeTab === 'activities'}
					{activityPrompts.length} activity prompts
				{:else if activeTab === 'teams'}
					{currentTeams.length} teams
				{:else if activeTab === 'points'}
					{ledgerEntries.length} point adjustments
				{/if}
			</div>
			<div class="win-inset px-2 ml-1">
				<a href="/showcase" class="hover:underline">View Showcase</a>
			</div>
		</div>
	</div>
</div>
