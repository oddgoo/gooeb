<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { formatCode, validateCode } from '$lib/utils/codes';
	import {
		bonds,
		pendingIncoming,
		pendingOutgoing,
		activeBonds,
		completedBonds
	} from '$lib/stores/bonds';
	import type { LayoutData } from '../$types';

	let layoutData = $derived($page.data as LayoutData);
	let guest = $derived(layoutData.guest);
	let maskCode = $derived(layoutData.maskCode);

	let targetCode = $state('');
	let error = $state('');
	let isSubmitting = $state(false);
	let successMessage = $state('');

	// Load bonds on mount
	onMount(() => {
		bonds.load();
	});

	onDestroy(() => {
		bonds.cleanup();
	});

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		targetCode = formatCode(input.value);
		error = '';
		successMessage = '';
	}

	async function sendInvite() {
		if (!validateCode(targetCode)) {
			error = 'Please enter a valid 4-digit code';
			return;
		}

		if (targetCode === maskCode) {
			error = "That's your own code!";
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			const response = await fetch('/api/bond/invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetCode })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to send invite');
			}

			// Success - reload bonds
			targetCode = '';
			if (result.autoAccepted) {
				successMessage = `Bonded with ${result.targetNickname}! Check your prompt above.`;
			} else {
				successMessage = `Invite sent to ${result.targetNickname}!`;
			}
			bonds.load();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to send invite';
		} finally {
			isSubmitting = false;
		}
	}

	async function acceptBond(bondId: string) {
		try {
			const response = await fetch('/api/bond/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bondId })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.message || 'Failed to accept');
			}

			bonds.load();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to accept bond';
		}
	}

	async function rejectBond(bondId: string) {
		try {
			const response = await fetch('/api/bond/reject', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bondId })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.message || 'Failed to reject');
			}

			bonds.load();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to reject bond';
		}
	}

	function getCategoryEmoji(category: string): string {
		switch (category) {
			case 'character':
				return '🎭';
			case 'theme':
				return '💭';
			case 'place':
				return '📍';
			default:
				return '✨';
		}
	}
</script>

<div class="p-4 max-w-md mx-auto">
	<!-- Header with user info -->
	<header class="flex items-center gap-3 mb-6 pt-2">
		<img
			src={guest.photo_url}
			alt={guest.nickname}
			class="w-12 h-12 rounded-full object-cover border-2 border-gooeb-500"
		/>
		<div class="flex-1">
			<h1 class="font-bold text-gray-900">{guest.nickname}</h1>
			<p class="text-sm text-gray-500">
				Your code: <span class="font-mono font-bold text-gooeb-600">{maskCode}</span>
			</p>
		</div>
	</header>

	<!-- Active Bonds (with prompts to complete) -->
	{#if $activeBonds.length > 0}
		<div class="card mb-6 border-2 border-gooeb-500">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Active Bond</h2>
			{#each $activeBonds as bond}
				<div class="bg-gooeb-50 rounded-xl p-4">
					<div class="flex items-center gap-3 mb-3">
						<img
							src={bond.partner.photo_url}
							alt={bond.partner.nickname}
							class="w-10 h-10 rounded-full object-cover"
						/>
						<span class="font-medium">{bond.partner.nickname}</span>
					</div>
					{#if bond.prompt}
						<div class="text-center py-4">
							<p class="text-sm text-gray-500 mb-1">Your prompt:</p>
							<p class="text-3xl font-bold text-gooeb-600">
								{getCategoryEmoji(bond.prompt.category)} {bond.prompt.word}
							</p>
							<p class="text-xs text-gray-400 mt-2 capitalize">{bond.prompt.category}</p>
						</div>
						<a
							href="/bond/{bond.id}/complete"
							class="btn-primary w-full text-center block mt-4"
						>
							Complete Bond
						</a>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Incoming Invites -->
	{#if $pendingIncoming.length > 0}
		<div class="card mb-6 border-2 border-amber-400">
			<h3 class="font-semibold text-gray-900 mb-3">
				Incoming Invites ({$pendingIncoming.length})
			</h3>
			<div class="space-y-3">
				{#each $pendingIncoming as bond}
					<div class="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
						<img
							src={bond.partner.photo_url}
							alt={bond.partner.nickname}
							class="w-10 h-10 rounded-full object-cover"
						/>
						<span class="flex-1 font-medium">{bond.partner.nickname}</span>
						<button
							onclick={() => acceptBond(bond.id)}
							class="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
						>
							Accept
						</button>
						<button
							onclick={() => rejectBond(bond.id)}
							class="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-300"
						>
							Decline
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Send Invite Form -->
	<div class="card mb-6">
		<h2 class="text-xl font-bold text-gray-900 mb-2 text-center">Bond with Someone</h2>
		<p class="text-gray-500 text-sm text-center mb-6">
			Enter their mask code or tap their NFC tag
		</p>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				sendInvite();
			}}
			class="space-y-4"
		>
			<div>
				<input
					type="text"
					inputmode="numeric"
					pattern="[0-9]*"
					value={targetCode}
					oninput={handleInput}
					placeholder="0000"
					maxlength="4"
					autocomplete="off"
					class="w-full text-center text-4xl tracking-[0.5em] font-mono font-bold
					       p-4 border-2 border-gray-200 rounded-2xl
					       focus:border-gooeb-500 focus:outline-none transition-colors
					       placeholder:text-gray-300 placeholder:tracking-[0.5em]"
				/>
			</div>

			{#if error}
				<div class="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center">
					{error}
				</div>
			{/if}

			{#if successMessage}
				<div class="bg-green-50 text-green-600 p-3 rounded-xl text-sm text-center">
					{successMessage}
				</div>
			{/if}

			<button
				type="submit"
				disabled={isSubmitting || targetCode.length !== 4}
				class="btn-primary w-full text-lg"
			>
				{isSubmitting ? 'Sending...' : 'Send Bond Invite'}
			</button>
		</form>
	</div>

	<!-- Outgoing Invites (waiting for response) -->
	{#if $pendingOutgoing.length > 0}
		<div class="card mb-6">
			<h3 class="font-semibold text-gray-900 mb-3">Waiting for Response</h3>
			<div class="space-y-2">
				{#each $pendingOutgoing as bond}
					<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
						<img
							src={bond.partner.photo_url}
							alt={bond.partner.nickname}
							class="w-8 h-8 rounded-full object-cover"
						/>
						<span class="flex-1 text-sm">{bond.partner.nickname}</span>
						<span class="text-xs text-gray-400">Pending...</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Completed Bonds -->
	<div class="card">
		<h3 class="font-semibold text-gray-900 mb-3">
			Completed Bonds ({$completedBonds.length})
		</h3>
		{#if $completedBonds.length === 0}
			<div class="text-center py-4 text-gray-400">
				<div class="text-3xl mb-2">🤝</div>
				<p class="text-sm">Complete bonds will appear here</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each $completedBonds as bond}
					<div class="flex items-center gap-3 p-3 bg-gooeb-50 rounded-xl">
						<img
							src={bond.partner.photo_url}
							alt={bond.partner.nickname}
							class="w-10 h-10 rounded-full object-cover"
						/>
						<div class="flex-1">
							<p class="font-medium">{bond.partner.nickname}</p>
							{#if bond.prompt}
								<p class="text-xs text-gray-500">
									{getCategoryEmoji(bond.prompt.category)} {bond.prompt.word}
								</p>
							{/if}
						</div>
						{#if bond.photo_url}
							<img
								src={bond.photo_url}
								alt="Completed"
								class="w-12 h-12 rounded-lg object-cover"
							/>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
