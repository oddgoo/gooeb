<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { formatCode, validateCode } from '$lib/utils/codes';
	import {
		bonds,
		pendingIncoming,
		pendingOutgoing,
		activeBonds,
		completedBonds
	} from '$lib/stores/bonds';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import type { LayoutData } from '../$types';

	let layoutData = $derived($page.data as LayoutData);
	let guest = $derived(layoutData.guest);
	let maskCode = $derived(layoutData.maskCode);

	let targetCode = $state('');
	let error = $state('');
	let isSubmitting = $state(false);
	let successMessage = $state('');
	let loadingBonds = $state<Record<string, 'accept' | 'reject'>>({}); // Track loading state per bond

	// Global processing state - true when ANY async operation is in progress
	let isProcessing = $derived(isSubmitting || Object.keys(loadingBonds).length > 0);

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

			// Success - optimistic update for instant feedback
			targetCode = '';
			if (result.autoAccepted) {
				successMessage = `Bonded with ${result.targetNickname}! Check your prompt above.`;
				// For auto-accept, we need full data so reload
				bonds.load();
			} else {
				successMessage = `Invite sent to ${result.targetNickname}!`;
				// Optimistic update - add pending bond immediately
				bonds.addPendingBond(result.bondId, {
					id: result.targetId,
					nickname: result.targetNickname,
					photo_url: result.targetPhoto
				});
				// Realtime/polling will sync eventual consistency
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to send invite';
		} finally {
			isSubmitting = false;
		}
	}

	async function acceptBond(bondId: string) {
		loadingBonds = { ...loadingBonds, [bondId]: 'accept' };
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
		} finally {
			const { [bondId]: _, ...rest } = loadingBonds;
			loadingBonds = rest;
		}
	}

	async function rejectBond(bondId: string) {
		loadingBonds = { ...loadingBonds, [bondId]: 'reject' };
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
		} finally {
			const { [bondId]: _, ...rest } = loadingBonds;
			loadingBonds = rest;
		}
	}

	function getCategoryEmoji(category: string): string {
		switch (category) {
			case 'character':
				return '👤';
			case 'theme':
				return '💭';
			case 'place':
				return '📍';
			default:
				return '✨';
		}
	}
</script>

<div class="min-h-screen flex flex-col">
	<!-- Main Window - fills screen on mobile -->
	<div class="win-window flex-1 flex flex-col m-0 sm:m-4 sm:max-w-lg sm:mx-auto sm:flex-initial">
		<!-- Title Bar -->
		<div class="win-titlebar">
			<span>The Gooeb - Bond Manager</span>
			<div class="flex gap-1">
				<button class="win-btn px-2 py-0 min-w-0 text-xs">_</button>
				<button class="win-btn px-2 py-0 min-w-0 text-xs">□</button>
			</div>
		</div>

		<!-- Menu Bar -->
		<!-- <div class="bg-win-bg px-2 py-1 border-b border-win-btnShadow flex gap-4 text-sm">
			<span class="underline">F</span>ile
			<span class="underline">B</span>ond
			<span class="underline">H</span>elp
		</div> -->

		<!-- Window Content - scrollable -->
		<div class="p-3 space-y-3 flex-1 overflow-y-auto">

			<!-- User Info Panel -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Your Profile</span>
				<div class="flex items-center gap-3">
					<div class="win-inset p-1">
						<img
							src={guest.photo_url}
							alt={guest.nickname}
							class="w-12 h-12 object-cover"
						/>
					</div>
					<div>
						<div class="font-bold text-lg">{guest.nickname}</div>
						<div class="text-sm">Code: <span class="font-mono bg-win-window px-2">{maskCode}</span></div>
					</div>
				</div>
			</div>

			<!-- Active Bonds -->
			{#if $activeBonds.length > 0}
				<div class="win-groupbox" transition:slide={{ duration: 300 }}>
					<span class="win-groupbox-label animate-pulse-glow">!! Active Bond !!</span>
					{#each $activeBonds as bond (bond.id)}
						<div class="win-inset p-3 animate-fade-in-scale">
							<div class="flex items-center gap-3 mb-3">
								<div class="win-inset p-1">
									<img
										src={bond.partner.photo_url}
										alt={bond.partner.nickname}
										class="w-10 h-10 object-cover"
									/>
								</div>
								<span class="font-bold">{bond.partner.nickname}</span>
							</div>

							<!-- Individual Prompts -->
							<div class="grid grid-cols-2 gap-2 mb-3">
								<!-- My Prompt -->
								{#if bond.myPrompt}
									<div class="text-center py-2 bg-win-bg win-panel">
										<div class="text-xs mb-1">Your prompt:</div>
										<div class="text-lg font-bold text-win-title">
											{getCategoryEmoji(bond.myPrompt.category)} {bond.myPrompt.word}
										</div>
										<div class="text-xs uppercase">[{bond.myPrompt.category}]</div>
									</div>
								{:else if bond.prompt}
									<!-- Legacy single prompt fallback -->
									<div class="text-center py-2 bg-win-bg win-panel col-span-2">
										<div class="text-xs mb-1">Your prompt:</div>
										<div class="text-lg font-bold text-win-title">
											{getCategoryEmoji(bond.prompt.category)} {bond.prompt.word}
										</div>
										<div class="text-xs uppercase">[{bond.prompt.category}]</div>
									</div>
								{/if}

								<!-- Partner's Prompt -->
								{#if bond.partnerPrompt}
									<div class="text-center py-2 bg-win-bg win-panel">
										<div class="text-xs mb-1">{bond.partner.nickname}'s:</div>
										<div class="text-lg font-bold text-win-title">
											{getCategoryEmoji(bond.partnerPrompt.category)} {bond.partnerPrompt.word}
										</div>
										<div class="text-xs uppercase">[{bond.partnerPrompt.category}]</div>
									</div>
								{/if}
							</div>

							<!-- Shared Activity -->
							{#if bond.activityPrompt}
								<div class="text-center py-3 bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white rounded mb-3">
									<div class="text-xs mb-1 opacity-80">Shared Activity:</div>
									<div class="text-base font-bold">
										{bond.activityPrompt.description}
									</div>
								</div>
							{/if}

							{#if isProcessing}
								<span class="win-btn bg-gray-400 text-gray-200 w-full block text-center py-2 cursor-not-allowed">
									Complete Bond
								</span>
							{:else}
								<a
									href="/bond/{bond.id}/complete"
									class="win-btn bg-gradient-to-r from-y2k-cyan to-y2k-pink text-white w-full block text-center py-2"
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
				<div class="win-groupbox" transition:slide={{ duration: 300 }}>
					<span class="win-groupbox-label">Incoming ({$pendingIncoming.length})</span>
					<div class="space-y-2">
						{#each $pendingIncoming as bond (bond.id)}
							<div class="win-inset p-2 flex items-center gap-2" transition:fly={{ y: -20, duration: 250 }}>
								<div class="win-inset p-0.5">
									<img
										src={bond.partner.photo_url}
										alt={bond.partner.nickname}
										class="w-8 h-8 object-cover"
									/>
								</div>
								<span class="flex-1 font-bold">{bond.partner.nickname}</span>
								<button
									onclick={() => acceptBond(bond.id)}
									disabled={isProcessing}
									class="win-btn text-sm py-0.5 min-w-0 px-2"
								>
									{#if loadingBonds[bond.id] === 'accept'}
										<LoadingSpinner size="sm" color="current" />
									{:else}
										Accept
									{/if}
								</button>
								<button
									onclick={() => rejectBond(bond.id)}
									disabled={isProcessing}
									class="win-btn text-sm py-0.5 min-w-0 px-2"
								>
									{#if loadingBonds[bond.id] === 'reject'}
										<LoadingSpinner size="sm" color="current" />
									{:else}
										Decline
									{/if}
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Send Invite -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">New Bond</span>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						sendInvite();
					}}
					class="space-y-3"
				>
					<div>
						<label for="targetCode" class="block text-sm mb-1">Enter mask code:</label>
						<input
							id="targetCode"
							type="text"
							inputmode="numeric"
							pattern="[0-9]*"
							value={targetCode}
							oninput={handleInput}
							placeholder="0000"
							maxlength="4"
							autocomplete="off"
							disabled={isProcessing}
							class="win-input w-full text-center text-2xl tracking-[0.3em] font-mono font-bold py-2"
						/>
					</div>

					{#if error}
						<div class="win-inset p-2 bg-red-100 text-red-800 text-sm animate-shake" transition:slide={{ duration: 200 }}>
							{error}
						</div>
					{/if}

					{#if successMessage}
						<div class="win-inset p-2 bg-green-100 text-green-800 text-sm animate-bounce-in" transition:slide={{ duration: 200 }}>
							{successMessage}
						</div>
					{/if}

					<button
						type="submit"
						disabled={isProcessing || targetCode.length !== 4}
						class="win-btn bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white w-full py-2"
					>
						{#if isSubmitting}
							<LoadingSpinner size="sm" color="white" /> Sending...
						{:else}
							Send Invite
						{/if}
					</button>
				</form>
			</div>

			<!-- Outgoing Invites -->
			{#if $pendingOutgoing.length > 0}
				<div class="win-groupbox" transition:slide={{ duration: 300 }}>
					<span class="win-groupbox-label">Waiting...</span>
					<div class="space-y-1">
						{#each $pendingOutgoing as bond (bond.id)}
							<div class="flex items-center gap-2 text-sm" transition:fade={{ duration: 200 }}>
								<span class="animate-pulse">⏳</span>
								<span>{bond.partner.nickname}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Completed Bonds -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Completed ({$completedBonds.length})</span>
				{#if $completedBonds.length === 0}
					<div class="text-center py-3 text-win-textDisabled">
						<div class="text-2xl mb-1">🤝</div>
						<div class="text-sm">No bonds yet</div>
					</div>
				{:else}
					<div class="win-inset p-2 max-h-40 overflow-y-auto">
						{#each $completedBonds as bond (bond.id)}
							<div class="flex items-center gap-2 py-1 border-b border-win-btnShadow last:border-0" transition:fly={{ x: 20, duration: 250 }}>
								<div class="win-inset p-0.5">
									<img
										src={bond.partner.photo_url}
										alt={bond.partner.nickname}
										class="w-6 h-6 object-cover"
									/>
								</div>
								<div class="flex-1">
									<span class="font-bold text-sm">{bond.partner.nickname}</span>
									{#if bond.prompt}
										<span class="text-xs ml-2">
											{getCategoryEmoji(bond.prompt.category)} {bond.prompt.word}
										</span>
									{/if}
								</div>
								{#if bond.photo_url}
									<div class="win-inset p-0.5">
										<img
											src={bond.photo_url}
											alt="Done"
											class="w-8 h-8 object-cover"
										/>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

		</div>

		<!-- Status Bar -->
		<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm flex">
			<div class="win-inset px-2 flex-1">Ready</div>
			<div class="win-inset px-2 ml-1">{$completedBonds.length} bonds</div>
		</div>
	</div>
</div>
