<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import PhotoCapture from '$lib/components/PhotoCapture.svelte';

	let nickname = $state('');
	let photoDataUrl: string | null = $state(null);
	let isSubmitting = $state(false);
	let error = $state('');

	// Get registration context from URL params
	const maskCodeId = $page.url.searchParams.get('maskCodeId');
	const eventId = $page.url.searchParams.get('eventId');
	const code = $page.url.searchParams.get('code');

	// Redirect if missing required params
	$effect(() => {
		if (!maskCodeId || !eventId) {
			goto('/');
		}
	});

	function handlePhotoCapture(dataUrl: string) {
		photoDataUrl = dataUrl;
		error = '';
	}

	async function handleSubmit() {
		if (!nickname.trim()) {
			error = 'Please enter a nickname';
			return;
		}

		if (!photoDataUrl) {
			error = 'Please take or upload a photo';
			return;
		}

		if (!maskCodeId || !eventId) {
			error = 'Invalid registration session. Please start over.';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			const response = await fetch('/api/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nickname: nickname.trim(),
					photoDataUrl,
					maskCodeId,
					eventId,
					code
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Registration failed');
			}

			// Set auth code and redirect to bond page
			auth.setCode(result.code);
			goto('/bond');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Registration failed. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	$effect(() => {
		// Clear error when inputs change
		if (nickname || photoDataUrl) {
			error = '';
		}
	});
</script>

<div class="min-h-screen flex flex-col">
	<!-- Main Window - fills screen on mobile -->
	<div class="win-window flex-1 flex flex-col m-0 sm:m-auto sm:max-w-sm sm:flex-initial sm:my-8">
		<!-- Title Bar -->
		<div class="win-titlebar">
			<span>New User Setup</span>
			<div class="flex gap-1">
				<button class="win-btn px-2 py-0 min-w-0 text-xs">?</button>
			</div>
		</div>

		<!-- Window Content - scrollable -->
		<div class="p-4 space-y-4 flex-1 overflow-y-auto">
			{#if code}
				<div class="text-center">
					<span class="text-sm">Registering code:</span>
					<span class="font-mono font-bold text-win-title text-xl ml-2">{code}</span>
				</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="space-y-4"
			>
				<!-- Photo capture -->
				<div class="win-groupbox">
					<span class="win-groupbox-label">Your Photo</span>
					<PhotoCapture onCapture={handlePhotoCapture} />
					<p class="text-xs text-win-textDisabled mt-2 text-center">
						This will appear on the network graph
					</p>
				</div>

				<!-- Nickname input -->
				<div class="win-groupbox">
					<span class="win-groupbox-label">Nickname</span>
					<input
						id="nickname"
						type="text"
						bind:value={nickname}
						placeholder="What should we call you?"
						maxlength="20"
						autocomplete="off"
						class="win-input w-full py-2 text-lg"
					/>
					<p class="text-xs text-win-textDisabled mt-1">Max 20 characters</p>
				</div>

				<!-- Error message -->
				{#if error}
					<div class="win-inset p-2 bg-red-100 text-red-800 text-sm">
						{error}
					</div>
				{/if}

				<!-- Submit button -->
				<button
					type="submit"
					disabled={isSubmitting || !nickname.trim() || !photoDataUrl}
					class="win-btn bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white w-full py-2 text-lg"
				>
					{#if isSubmitting}
						Installing...
					{:else}
						Install
					{/if}
				</button>
			</form>

			<!-- Back link -->
			<div class="text-center">
				<a href="/" class="text-sm text-win-title underline">
					&lt; Use different code
				</a>
			</div>
		</div>

		<!-- Status Bar -->
		<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm">
			<div class="win-inset px-2">Setup wizard</div>
		</div>
	</div>
</div>
