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

<div class="p-2 max-w-md mx-auto min-h-screen">
	<!-- Main Window -->
	<div class="win-window">
		<!-- Title Bar -->
		<div class="win-titlebar">
			<span>The Gooeb - Bond Manager</span>
			<div class="flex gap-1">
				<button class="win-btn px-2 py-0 min-w-0 text-xs">_</button>
				<button class="win-btn px-2 py-0 min-w-0 text-xs">□</button>
			</div>
		</div>

		<!-- Menu Bar -->
		<div class="bg-win-bg px-2 py-1 border-b border-win-btnShadow flex gap-4 text-sm">
			<span class="underline">F</span>ile
			<span class="underline">B</span>ond
			<span class="underline">H</span>elp
		</div>

		<!-- Window Content -->
		<div class="p-3 space-y-3">

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
				<div class="win-groupbox">
					<span class="win-groupbox-label">!! Active Bond !!</span>
					{#each $activeBonds as bond}
						<div class="win-inset p-3">
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
							{#if bond.prompt}
								<div class="text-center py-3 bg-win-bg win-panel">
									<div class="text-sm mb-1">Your prompt:</div>
									<div class="text-2xl font-bold text-win-title">
										{getCategoryEmoji(bond.prompt.category)} {bond.prompt.word}
									</div>
									<div class="text-xs mt-1 uppercase">[{bond.prompt.category}]</div>
								</div>
								<a
									href="/bond/{bond.id}/complete"
									class="win-btn bg-win-title text-white w-full block text-center mt-3 py-2"
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
				<div class="win-groupbox">
					<span class="win-groupbox-label">Incoming ({$pendingIncoming.length})</span>
					<div class="space-y-2">
						{#each $pendingIncoming as bond}
							<div class="win-inset p-2 flex items-center gap-2">
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
									class="win-btn text-sm py-0.5 min-w-0 px-2"
								>
									Accept
								</button>
								<button
									onclick={() => rejectBond(bond.id)}
									class="win-btn text-sm py-0.5 min-w-0 px-2"
								>
									Decline
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
							class="win-input w-full text-center text-2xl tracking-[0.3em] font-mono font-bold py-2"
						/>
					</div>

					{#if error}
						<div class="win-inset p-2 bg-red-100 text-red-800 text-sm">
							{error}
						</div>
					{/if}

					{#if successMessage}
						<div class="win-inset p-2 bg-green-100 text-green-800 text-sm">
							{successMessage}
						</div>
					{/if}

					<button
						type="submit"
						disabled={isSubmitting || targetCode.length !== 4}
						class="win-btn bg-win-title text-white w-full py-2"
					>
						{isSubmitting ? 'Sending...' : 'Send Invite'}
					</button>
				</form>
			</div>

			<!-- Outgoing Invites -->
			{#if $pendingOutgoing.length > 0}
				<div class="win-groupbox">
					<span class="win-groupbox-label">Waiting...</span>
					<div class="space-y-1">
						{#each $pendingOutgoing as bond}
							<div class="flex items-center gap-2 text-sm">
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
						{#each $completedBonds as bond}
							<div class="flex items-center gap-2 py-1 border-b border-win-btnShadow last:border-0">
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
