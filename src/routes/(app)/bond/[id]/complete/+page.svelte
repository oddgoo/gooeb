<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import PhotoCapture from '$lib/components/PhotoCapture.svelte';

	let pageData = $derived($page.data as {
		bond: {
			id: string;
			prompt: { id: string; word: string; category: string } | null;
			myPrompt: { id: string; word: string; category: string } | null;
			partnerPrompt: { id: string; word: string; category: string } | null;
			partner: { id: string; nickname: string; photo_url: string };
		};
	});

	let bond = $derived(pageData.bond);

	let photoDataUrl: string | null = $state(null);
	let isSubmitting = $state(false);
	let error = $state('');

	function handlePhotoCapture(dataUrl: string) {
		photoDataUrl = dataUrl;
		error = '';
	}

	async function handleSubmit() {
		if (!photoDataUrl) {
			error = 'Please take a photo to complete the bond';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			const response = await fetch(`/api/bond/${bond.id}/complete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ photoDataUrl })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to complete bond');
			}

			// Success! Go back to bond page
			goto('/bond');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to complete bond';
		} finally {
			isSubmitting = false;
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
			<span>Complete Bond</span>
			<div class="flex gap-1">
				<a href="/bond" class="win-btn px-2 py-0 min-w-0 text-xs">X</a>
			</div>
		</div>

		<!-- Window Content - scrollable -->
		<div class="p-3 space-y-3 flex-1 overflow-y-auto">

			<!-- Partner Info -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Bonding with</span>
				<div class="flex items-center gap-3">
					<div class="win-inset p-1">
						<img
							src={bond.partner.photo_url}
							alt={bond.partner.nickname}
							class="w-12 h-12 object-cover"
						/>
					</div>
					<div class="font-bold text-lg">{bond.partner.nickname}</div>
				</div>
			</div>

			<!-- Dual Prompts Display -->
			{#if bond.myPrompt || bond.partnerPrompt}
				<div class="win-groupbox">
					<span class="win-groupbox-label">Your Prompts</span>
					<div class="grid grid-cols-2 gap-2">
						{#if bond.myPrompt}
							<div class="text-center py-3 win-inset">
								<div class="text-xs mb-1">Your prompt:</div>
								<div class="text-xl font-bold text-win-title">
									{getCategoryEmoji(bond.myPrompt.category)} {bond.myPrompt.word}
								</div>
								<div class="text-xs mt-1 uppercase text-win-textDisabled">
									[{bond.myPrompt.category}]
								</div>
							</div>
						{/if}
						{#if bond.partnerPrompt}
							<div class="text-center py-3 win-inset">
								<div class="text-xs mb-1">{bond.partner.nickname}'s:</div>
								<div class="text-xl font-bold text-win-title">
									{getCategoryEmoji(bond.partnerPrompt.category)} {bond.partnerPrompt.word}
								</div>
								<div class="text-xs mt-1 uppercase text-win-textDisabled">
									[{bond.partnerPrompt.category}]
								</div>
							</div>
						{/if}
					</div>
				</div>
			{:else if bond.prompt}
				<!-- Legacy single prompt fallback -->
				<div class="win-groupbox">
					<span class="win-groupbox-label">Your Prompt</span>
					<div class="text-center py-4 win-inset">
						<div class="text-3xl font-bold text-win-title">
							{getCategoryEmoji(bond.prompt.category)} {bond.prompt.word}
						</div>
						<div class="text-xs mt-2 uppercase text-win-textDisabled">
							[{bond.prompt.category}]
						</div>
					</div>
				</div>
			{/if}

			<!-- Photo Capture -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Completion Photo</span>
				<p class="text-sm text-win-textDisabled mb-2">
					Take a photo together that represents your prompt!
				</p>
				<PhotoCapture onCapture={handlePhotoCapture} />
			</div>

			<!-- Error -->
			{#if error}
				<div class="win-inset p-2 bg-red-100 text-red-800 text-sm">
					{error}
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex gap-2">
				<a href="/bond" class="win-btn flex-1 text-center py-2">
					Cancel
				</a>
				<button
					type="button"
					onclick={handleSubmit}
					disabled={isSubmitting || !photoDataUrl}
					class="win-btn bg-gradient-to-r from-y2k-cyan to-y2k-pink text-white flex-1 py-2"
				>
					{isSubmitting ? 'Uploading...' : 'Complete Bond'}
				</button>
			</div>

		</div>

		<!-- Status Bar -->
		<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm">
			<div class="win-inset px-2">
				{#if photoDataUrl}
					Photo ready
				{:else}
					Waiting for photo...
				{/if}
			</div>
		</div>
	</div>
</div>
