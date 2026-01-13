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

<div class="min-h-screen bg-gradient-to-b from-gooeb-50 to-white p-4 safe-area-pt">
	<div class="max-w-md mx-auto pt-4">
		<!-- Header -->
		<div class="text-center mb-6">
			<h1 class="text-2xl font-bold text-gray-900">Create Your Profile</h1>
			{#if code}
				<p class="text-gray-500 mt-1">
					Mask code: <span class="font-mono font-bold text-gooeb-600">{code}</span>
				</p>
			{/if}
		</div>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="space-y-6"
		>
			<!-- Photo capture -->
			<div>
				<p class="block text-sm font-medium text-gray-700 mb-2">Your Photo</p>
				<PhotoCapture onCapture={handlePhotoCapture} />
				<p class="text-xs text-gray-400 mt-2 text-center">
					This will be shown on the network graph
				</p>
			</div>

			<!-- Nickname input -->
			<div>
				<label for="nickname" class="block text-sm font-medium text-gray-700 mb-2">
					Nickname
				</label>
				<input
					id="nickname"
					type="text"
					bind:value={nickname}
					placeholder="What should we call you?"
					maxlength="20"
					autocomplete="off"
					class="input-field"
				/>
				<p class="text-xs text-gray-400 mt-1">Max 20 characters</p>
			</div>

			<!-- Error message -->
			{#if error}
				<div class="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center">
					{error}
				</div>
			{/if}

			<!-- Submit button -->
			<button
				type="submit"
				disabled={isSubmitting || !nickname.trim() || !photoDataUrl}
				class="btn-primary w-full text-lg"
			>
				{#if isSubmitting}
					<span class="inline-flex items-center gap-2">
						<span
							class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
						></span>
						Joining...
					</span>
				{:else}
					Join the Party!
				{/if}
			</button>
		</form>

		<!-- Back link -->
		<div class="mt-6 text-center">
			<a href="/" class="text-gray-500 hover:text-gray-700 text-sm"> ← Use a different code </a>
		</div>
	</div>
</div>
