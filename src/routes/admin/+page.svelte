<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	type Guest = {
		id: string;
		nickname: string;
		photo_url: string;
		is_admin: boolean;
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

	let pageData = $derived($page.data as { guest: { id: string; nickname: string }; eventId: string | null });

	let activeTab = $state<'guests' | 'bonds' | 'prompts'>('guests');
	let guests = $state<Guest[]>([]);
	let bonds = $state<Bond[]>([]);
	let prompts = $state<Prompt[]>([]);
	let loading = $state(false);
	let error = $state('');

	// New prompt form
	let newPromptWord = $state('');
	let newPromptCategory = $state<'character' | 'theme' | 'place'>('character');

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
		<div class="bg-win-bg px-2 py-1 border-b border-win-btnShadow flex gap-1">
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
			{/if}
		</div>

		<!-- Status Bar -->
		<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm flex">
			<div class="win-inset px-2 flex-1">
				{#if activeTab === 'guests'}
					{guests.length} guests registered
				{:else if activeTab === 'bonds'}
					{bonds.length} melds total
				{:else}
					{prompts.length} prompts configured
				{/if}
			</div>
			<div class="win-inset px-2 ml-1">
				<a href="/showcase" class="hover:underline">View Showcase</a>
			</div>
		</div>
	</div>
</div>
