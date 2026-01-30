<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let isConfirming = $state(false);
	let error = $state('');

	onMount(() => {
		// Only auto-redirect for unclaimed codes without pre-populated data
		if (!data.isClaimed && !data.prePopulated) {
			const params = new URLSearchParams({
				code: data.code,
				maskCodeId: data.maskCodeId,
				eventId: data.eventId
			});
			goto(`/register?${params.toString()}`);
		}
	});

	async function handleConfirm() {
		isConfirming = true;
		error = '';

		try {
			const response = await fetch('/api/reclaim', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: data.code })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to reclaim');
			}

			// Set client-side auth state
			auth.setCode(result.code);
			goto('/bond');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			isConfirming = false;
		}
	}

	async function handleClaimPrePopulated() {
		isConfirming = true;
		error = '';

		try {
			const response = await fetch('/api/register/claim', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: data.code, maskCodeId: data.maskCodeId })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to claim');
			}

			auth.setCode(result.code);
			goto('/bond');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			isConfirming = false;
		}
	}

	function handleDecline() {
		goto('/?message=reclaim_declined');
	}
</script>

{#if data.isClaimed && data.claimedGuest}
	<div class="min-h-screen flex flex-col bg-win-bg">
		<div class="win-window flex-1 flex flex-col m-0 sm:m-auto sm:max-w-sm sm:flex-initial sm:my-8">
			<div class="win-titlebar">
				<span>Identity Confirmation</span>
				<div class="flex gap-1">
					<button class="win-btn px-2 py-0 min-w-0 text-xs">?</button>
				</div>
			</div>

			<div class="p-4 space-y-4 flex-1 flex flex-col justify-center">
				<div class="text-center">
					<span class="text-sm">Code:</span>
					<span class="font-mono font-bold text-win-title text-xl ml-2">{data.code}</span>
				</div>

				<div class="win-groupbox text-center">
					<span class="win-groupbox-label">Is this you?</span>

					<div class="flex flex-col items-center py-4">
						<div class="win-inset p-2 mb-3">
							<img
								src={data.claimedGuest.photo_url}
								alt={data.claimedGuest.nickname}
								class="w-24 h-24 object-cover"
							/>
						</div>
						<div class="font-bold text-xl text-win-title">
							{data.claimedGuest.nickname}
						</div>
					</div>
				</div>

				{#if error}
					<div class="win-inset p-2 bg-red-100 text-red-800 text-sm">
						{error}
					</div>
				{/if}

				<div class="space-y-2">
					<button
						onclick={handleConfirm}
						disabled={isConfirming}
						class="win-btn bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white w-full py-2 text-lg disabled:opacity-50"
					>
						{#if isConfirming}
							Confirming...
						{:else}
							Yes, that's me!
						{/if}
					</button>

					<button
						onclick={handleDecline}
						disabled={isConfirming}
						class="win-btn w-full py-2 disabled:opacity-50"
					>
						No, not me
					</button>
				</div>

				<div class="win-inset p-2 text-sm text-center text-win-text">
					<span>If this isn't you, please find Cuauh for help.</span>
				</div>
			</div>

			<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm">
				<div class="win-inset px-2">Identity verification</div>
			</div>
		</div>
	</div>
{:else if !data.isClaimed && data.prePopulated && data.prePopulatedGuest}
	<!-- Pre-populated guest confirmation -->
	<div class="min-h-screen flex flex-col bg-win-bg">
		<div class="win-window flex-1 flex flex-col m-0 sm:m-auto sm:max-w-sm sm:flex-initial sm:my-8">
			<div class="win-titlebar">
				<span>Identity Confirmation</span>
				<div class="flex gap-1">
					<button class="win-btn px-2 py-0 min-w-0 text-xs">?</button>
				</div>
			</div>

			<div class="p-4 space-y-4 flex-1 flex flex-col justify-center">
				<div class="text-center">
					<span class="text-sm">Code:</span>
					<span class="font-mono font-bold text-win-title text-xl ml-2">{data.code}</span>
				</div>

				<div class="win-groupbox text-center">
					<span class="win-groupbox-label">Is this you?</span>

					<div class="flex flex-col items-center py-4">
						<div class="win-inset p-2 mb-3">
							<img
								src={data.prePopulatedGuest.photo_url}
								alt={data.prePopulatedGuest.nickname}
								class="w-24 h-24 object-cover"
							/>
						</div>
						<div class="font-bold text-xl text-win-title">
							{data.prePopulatedGuest.nickname}
						</div>
					</div>
				</div>

				{#if data.prePopulatedGuest.intro_text}
					<div class="win-groupbox">
						<span class="win-groupbox-label">About you</span>
						<div class="p-2 text-sm text-win-text">
							{data.prePopulatedGuest.intro_text}
						</div>
					</div>
				{/if}

				{#if error}
					<div class="win-inset p-2 bg-red-100 text-red-800 text-sm">
						{error}
					</div>
				{/if}

				<div class="space-y-2">
					<button
						onclick={handleClaimPrePopulated}
						disabled={isConfirming}
						class="win-btn bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white w-full py-2 text-lg disabled:opacity-50"
					>
						{#if isConfirming}
							Confirming...
						{:else}
							That's me!
						{/if}
					</button>

					<button
						onclick={handleDecline}
						disabled={isConfirming}
						class="win-btn w-full py-2 disabled:opacity-50"
					>
						Not me
					</button>
				</div>

				<div class="win-inset p-2 text-sm text-center text-win-text">
					<span>If this isn't you, please find Cuauh for help.</span>
				</div>
			</div>

			<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm">
				<div class="win-inset px-2">Identity verification</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Loading/redirect state for unclaimed codes -->
	<div class="min-h-screen flex items-center justify-center">
		<div class="win-window p-6 text-center">
			<div
				class="w-12 h-12 border-4 border-y2k-pink border-t-transparent rounded-full animate-spin mx-auto mb-4"
			></div>
			<p class="text-win-text">Preparing your registration...</p>
		</div>
	</div>
{/if}
