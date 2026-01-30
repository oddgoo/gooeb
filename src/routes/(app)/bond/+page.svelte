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
		completedBonds,
		myPoints,
		myTeamEmoji
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
	let loadingBonds = $state<Record<string, 'accept' | 'reject'>>({});
	let completingBondId = $state<string | null>(null); // Track which bond is being navigated to complete
	let cancellingBondId = $state<string | null>(null); // Track which bond is being cancelled
	let confirmCancelBondId = $state<string | null>(null); // Track which bond has cancel confirmation dialog open

	// Profile lookup modal state
	let lookupTarget = $state<{ id: string; nickname: string; photo_url: string; intro_text: string | null; code: string } | null>(null);
	let showProfileModal = $state(false);
	let isLookingUp = $state(false);

	// Global processing state - true when ANY async operation is in progress
	let isProcessing = $derived(isSubmitting || Object.keys(loadingBonds).length > 0 || completingBondId !== null || cancellingBondId !== null || isLookingUp);

	// Load bonds on mount + handle ?invite= param
	onMount(() => {
		bonds.load();

		const inviteCode = $page.url.searchParams.get('invite');
		if (inviteCode) {
			// Clear the URL param without navigation
			const url = new URL(window.location.href);
			url.searchParams.delete('invite');
			window.history.replaceState({}, '', url.toString());

			// Auto-trigger lookup
			targetCode = formatCode(inviteCode);
			lookupGuest(inviteCode);
		}
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

	async function lookupGuest(code?: string) {
		const codeToLookup = code || targetCode;

		if (!validateCode(codeToLookup)) {
			error = 'Please enter a valid 3-digit code';
			return;
		}

		if (codeToLookup === maskCode) {
			error = "That's your own code!";
			return;
		}

		isLookingUp = true;
		error = '';

		try {
			const response = await fetch(`/api/guest/lookup?code=${encodeURIComponent(codeToLookup)}`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Guest not found');
			}

			lookupTarget = { ...result, code: codeToLookup };
			showProfileModal = true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to look up guest';
		} finally {
			isLookingUp = false;
		}
	}

	function closeProfileModal() {
		showProfileModal = false;
		lookupTarget = null;
	}

	async function sendInvite(codeOverride?: string) {
		const codeToSend = codeOverride || targetCode;

		if (!validateCode(codeToSend)) {
			error = 'Please enter a valid 3-digit code';
			return;
		}

		if (codeToSend === maskCode) {
			error = "That's your own code!";
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			const response = await fetch('/api/bond/invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetCode: codeToSend })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to send invite');
			}

			// Close modal if open
			showProfileModal = false;
			lookupTarget = null;

			// Success - optimistic update for instant feedback
			targetCode = '';
			if (result.autoAccepted) {
				successMessage = `Melded with ${result.targetNickname}! Check your prompt above.`;
				// For auto-accept, we need full data so reload
				bonds.load();
			} else {
				successMessage = `Meld invite sent to ${result.targetNickname}!`;
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
			// Close modal on error so user sees the error message
			showProfileModal = false;
			lookupTarget = null;
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
			error = e instanceof Error ? e.message : 'Failed to accept meld';
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
			error = e instanceof Error ? e.message : 'Failed to reject meld';
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

	function handleCompleteMeld(bondId: string) {
		completingBondId = bondId;
		// Navigation happens via the href - the loading state provides visual feedback
	}

	function showCancelConfirm(bondId: string) {
		confirmCancelBondId = bondId;
	}

	function hideCancelConfirm() {
		confirmCancelBondId = null;
	}

	async function cancelBond(bondId: string) {
		confirmCancelBondId = null;
		cancellingBondId = bondId;
		try {
			const response = await fetch('/api/bond/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bondId })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.message || 'Failed to cancel meld');
			}

			bonds.load();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to cancel meld';
		} finally {
			cancellingBondId = null;
		}
	}
</script>

<div class="h-screen flex flex-col overflow-hidden">
	<!-- Main Window - fills screen on mobile -->
	<div class="win-window flex-1 flex flex-col m-0 sm:m-4 sm:max-w-lg sm:mx-auto sm:h-auto sm:max-h-[90vh]">
		<!-- Title Bar -->
		<div class="win-titlebar">
			<span>Mind Meld Manager{#if $myTeamEmoji} | Team {$myTeamEmoji}{/if}</span>
			<div class="flex items-center gap-2">
				<span class="text-sm font-normal opacity-90">{guest.nickname}</span>
				<span class="text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded">{maskCode}</span>
				<a href="/bond/profile" class="win-btn px-2 py-0 min-w-0 text-xs">👤</a>
			</div>
		</div>

		<!-- Menu Bar -->
		<!-- <div class="bg-win-bg px-2 py-1 border-b border-win-btnShadow flex gap-4 text-sm">
			<span class="underline">F</span>ile
			<span class="underline">B</span>ond
			<span class="underline">H</span>elp
		</div> -->

		<!-- Window Content - scrollable with profile background -->
		<div class="p-3 space-y-3 flex-1 overflow-y-auto relative">
			<!-- Profile picture background -->
			<div
				class="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none"
				style="background-image: url({guest.photo_url});"
			></div>

			<!-- Content layer -->
			<div class="relative space-y-3">

			<!-- Active Melds -->
			{#if $activeBonds.length > 0}
				<div class="win-groupbox" transition:slide={{ duration: 300 }}>
					<span class="win-groupbox-label animate-pulse-glow">!! Active Meld !!</span>
					{#each $activeBonds as bond (bond.id)}
						<div class="win-inset p-3 animate-fade-in-scale relative">
							<!-- Cancel button -->
							{#if cancellingBondId === bond.id}
								<button
									disabled
									class="absolute top-2 right-2 win-btn px-2 py-0.5 min-w-0 text-xs cursor-wait"
								>
									<LoadingSpinner size="sm" color="current" />
								</button>
							{:else}
								<button
									onclick={() => showCancelConfirm(bond.id)}
									disabled={isProcessing}
									class="absolute top-2 right-2 win-btn px-2 py-0.5 min-w-0 text-xs hover:bg-red-100"
									title="Cancel this meld"
								>
									✕
								</button>
							{/if}

							<div class="flex items-center gap-3 mb-3 pr-8">
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

							{#if completingBondId === bond.id}
								<span class="win-btn bg-gradient-to-r from-y2k-cyan to-y2k-pink text-white w-full flex items-center justify-center gap-2 py-2 cursor-wait">
									<LoadingSpinner size="sm" color="white" />
									<span>Loading...</span>
								</span>
							{:else if isProcessing}
								<span class="win-btn bg-gray-400 text-gray-200 w-full block text-center py-2 cursor-not-allowed">
									Complete Meld
								</span>
							{:else}
								<a
									href="/bond/{bond.id}/complete"
									onclick={() => handleCompleteMeld(bond.id)}
									class="win-btn bg-gradient-to-r from-y2k-cyan to-y2k-pink text-white w-full block text-center py-2"
								>
									Complete Meld
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
				<span class="win-groupbox-label">New Meld</span>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						lookupGuest();
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
							placeholder="000"
							maxlength="3"
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
						disabled={isProcessing || targetCode.length !== 3}
						class="win-btn bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white w-full py-2"
					>
						{#if isLookingUp}
							<LoadingSpinner size="sm" color="white" /> Looking up...
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

				</div><!-- End content layer -->
		</div>

		<!-- Status Bar -->
		<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm flex">
			<div class="win-inset px-2 flex-1 flex items-center gap-2">
				{#if $bonds.loading}
					<LoadingSpinner size="sm" color="current" />
					<span>Loading...</span>
				{:else}
					Ready
				{/if}
			</div>
			<div class="win-inset px-2 ml-1">{$myPoints} pts</div>
		</div>
	</div>
</div>

<!-- Profile Preview Modal -->
{#if showProfileModal && lookupTarget}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
		onclick={closeProfileModal}
		onkeydown={(e) => e.key === 'Escape' && closeProfileModal()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="win-window max-w-sm w-full"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
			role="document"
		>
			<div class="win-titlebar">
				<span>Guest Profile</span>
				<button onclick={closeProfileModal} class="win-btn px-2 py-0 min-w-0 text-xs">✕</button>
			</div>
			<div class="p-4 space-y-4">
				<div class="flex flex-col items-center gap-3">
					<div class="win-inset p-1">
						<img
							src={lookupTarget.photo_url}
							alt={lookupTarget.nickname}
							class="w-32 h-32 object-cover"
						/>
					</div>
					<div class="text-center">
						<div class="text-lg font-bold">{lookupTarget.nickname}</div>
						{#if lookupTarget.intro_text}
							<div class="text-sm text-win-textDisabled mt-1">{lookupTarget.intro_text}</div>
						{/if}
					</div>
				</div>
				<div class="flex gap-2">
					<button
						onclick={closeProfileModal}
						class="win-btn px-4 py-1.5 flex-1"
					>
						Cancel
					</button>
					<button
						onclick={() => lookupTarget && sendInvite(lookupTarget.code)}
						disabled={isSubmitting}
						class="win-btn bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white px-4 py-1.5 flex-1"
					>
						{#if isSubmitting}
							<LoadingSpinner size="sm" color="white" /> Sending...
						{:else}
							Send Meld Request
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Cancel Confirmation Dialog -->
{#if confirmCancelBondId}
	{@const bondToCancel = $activeBonds.find(b => b.id === confirmCancelBondId)}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
		onclick={hideCancelConfirm}
		onkeydown={(e) => e.key === 'Escape' && hideCancelConfirm()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="win-window max-w-sm w-full"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
			role="document"
		>
			<div class="win-titlebar">
				<span>Cancel Meld</span>
				<button onclick={hideCancelConfirm} class="win-btn px-2 py-0 min-w-0 text-xs">✕</button>
			</div>
			<div class="p-4 space-y-4">
				<div class="flex items-center gap-3">
					<span class="text-3xl">⚠️</span>
					<div>
						<div class="font-bold">Cancel this meld?</div>
						{#if bondToCancel}
							<div class="text-sm text-win-textDisabled">
								Your meld with <strong>{bondToCancel.partner.nickname}</strong> will be cancelled.
							</div>
						{/if}
					</div>
				</div>
				<div class="flex gap-2 justify-end">
					<button
						onclick={hideCancelConfirm}
						class="win-btn px-4 py-1"
					>
						Keep Meld
					</button>
					<button
						onclick={() => confirmCancelBondId && cancelBond(confirmCancelBondId)}
						class="win-btn px-4 py-1 bg-red-500 text-white hover:bg-red-600"
					>
						Cancel Meld
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
