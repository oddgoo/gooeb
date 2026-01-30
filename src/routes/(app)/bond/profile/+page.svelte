<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import PhotoCapture from '$lib/components/PhotoCapture.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import { bonds, completedBonds } from '$lib/stores/bonds';
	import type { LayoutData } from '../../$types';

	let layoutData = $derived($page.data as LayoutData & { guest: { intro_text?: string | null } });
	let guest = $derived(layoutData.guest);
	let maskCode = $derived(layoutData.maskCode);

	let nickname = $state('');
	let photoData = $state<string | null>(null);
	let isSubmitting = $state(false);
	let error = $state('');
	let successMessage = $state('');

	// Initialize nickname from guest data
	$effect(() => {
		if (guest?.nickname && !nickname) {
			nickname = guest.nickname;
		}
	});

	// Load bonds on mount
	onMount(() => {
		bonds.load();
	});

	onDestroy(() => {
		bonds.cleanup();
	});

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

	function handlePhotoCapture(dataUrl: string) {
		photoData = dataUrl;
	}

	function signOut() {
		if (!confirm('Are you sure you want to sign out?')) {
			return;
		}
		// Clear localStorage
		localStorage.removeItem('gooeb_code');
		// Clear cookie
		document.cookie = 'gooeb_code=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
		// Redirect to home
		window.location.href = '/';
	}

	async function saveProfile() {
		if (!nickname.trim()) {
			error = 'Please enter a nickname';
			return;
		}

		isSubmitting = true;
		error = '';
		successMessage = '';

		try {
			const response = await fetch('/api/profile/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nickname: nickname.trim(),
					photo: photoData
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to update profile');
			}

			successMessage = 'Profile updated!';
			// Reload page to get fresh data
			setTimeout(() => {
				window.location.reload();
			}, 1000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update profile';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="min-h-screen flex flex-col">
	<!-- Main Window -->
	<div class="win-window flex-1 flex flex-col m-0 sm:m-4 sm:max-w-lg sm:mx-auto sm:flex-initial">
		<!-- Title Bar -->
		<div class="win-titlebar">
			<span>Profile Settings</span>
			<div class="flex items-center gap-2">
				<a href="/bond" class="win-btn px-2 py-0 min-w-0 text-xs">X</a>
			</div>
		</div>

		<!-- Window Content -->
		<div class="p-4 space-y-4 flex-1 overflow-y-auto">
			<!-- Current Info -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Your Code</span>
				<div class="text-center py-2">
					<span class="font-mono text-2xl tracking-[0.3em] bg-win-window px-4 py-1 win-inset">{maskCode}</span>
				</div>
			</div>

			<!-- Photo Section -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Profile Photo</span>
				<PhotoCapture onCapture={handlePhotoCapture} initialPhoto={guest.photo_url} />
			</div>

			<!-- Nickname Section -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Nickname</span>
				<input
					type="text"
					bind:value={nickname}
					placeholder="Enter your nickname"
					maxlength="20"
					class="win-input w-full text-lg py-2"
				/>
			</div>

			{#if guest.intro_text}
				<div class="win-groupbox">
					<span class="win-groupbox-label">About You</span>
					<div class="win-inset p-2 text-sm text-win-text">
						{guest.intro_text}
					</div>
				</div>
			{/if}

			<!-- Completed Melds -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Completed Melds ({$completedBonds.length})</span>
				{#if $bonds.loading}
					<div class="text-center py-4">
						<LoadingSpinner size="lg" color="pink" />
						<div class="text-sm mt-2 text-win-textDisabled">Loading melds...</div>
					</div>
				{:else if $completedBonds.length === 0}
					<div class="text-center py-3 text-win-textDisabled">
						<div class="text-2xl mb-1">🧠</div>
						<div class="text-sm">No melds yet</div>
					</div>
				{:else}
					<div class="win-inset p-2 max-h-60 overflow-y-auto">
						{#each $completedBonds as bond (bond.id)}
							<div class="flex items-center gap-2 py-2 border-b border-win-btnShadow last:border-0" transition:fly={{ x: 20, duration: 250 }}>
								<div class="win-inset p-0.5">
									<img
										src={bond.partner.photo_url}
										alt={bond.partner.nickname}
										class="w-8 h-8 object-cover"
									/>
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-bold text-sm truncate">{bond.partner.nickname}</div>
									{#if bond.prompt}
										<div class="text-xs text-win-textDisabled">
											{getCategoryEmoji(bond.prompt.category)} {bond.prompt.word}
										</div>
									{/if}
								</div>
								{#if bond.photo_url}
									<div class="win-inset p-0.5 flex-shrink-0">
										<img
											src={bond.photo_url}
											alt="Meld photo"
											class="w-10 h-10 object-cover"
										/>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
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

			<!-- Actions -->
			<div class="space-y-2">
				<button
					onclick={saveProfile}
					disabled={isSubmitting}
					class="win-btn bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white w-full py-2"
				>
					{#if isSubmitting}
						<LoadingSpinner size="sm" color="white" /> Saving...
					{:else}
						Save Changes
					{/if}
				</button>

				<a
					href="/bond"
					class="win-btn w-full block text-center py-2"
				>
					Back to Melding
				</a>
			</div>

			<!-- Sign Out -->
			<div class="pt-4 border-t border-win-btnShadow">
				<button
					onclick={signOut}
					class="win-btn w-full py-2 text-red-700"
				>
					Sign Out
				</button>
			</div>
		</div>

		<!-- Status Bar -->
		<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm flex">
			<div class="win-inset px-2 flex-1">Edit your profile</div>
		</div>
	</div>
</div>
